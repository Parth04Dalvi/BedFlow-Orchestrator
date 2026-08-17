import uuid
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import redis.asyncio as aioredis
from app.core.database import get_db
from app.core.config import settings
from app.models.hospital import Bed, Unit, Patient
from app.schemas.hospital import (
    UnitCreate, UnitResponse, BedCreate, BedResponse,
    BedStatusUpdate, PatientCreate, PatientResponse,
    AllocationRequest, AllocationResponse
)
from app.services.matcher import match_and_allocate_bed

api_router = APIRouter()

async def get_redis():
    client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        yield client
    finally:
        await client.close()

@api_router.get("/health")
async def health_check():
    return {"status": "online", "service": "BedFlow-Orchestrator"}

@api_router.post("/units", response_model=UnitResponse)
async def create_unit(payload: UnitCreate, db: AsyncSession = Depends(get_db)):
    unit = Unit(**payload.model_dump())
    db.add(unit)
    await db.commit()
    await db.refresh(unit)
    return unit

@api_router.post("/beds", response_model=BedResponse)
async def create_bed(payload: BedCreate, db: AsyncSession = Depends(get_db)):
    bed = Bed(**payload.model_dump())
    db.add(bed)
    await db.commit()
    await db.refresh(bed)
    return bed

@api_router.post("/beds/{bed_id}/status", response_model=BedResponse)
async def update_bed_status(
    bed_id: uuid.UUID,
    payload: BedStatusUpdate,
    db: AsyncSession = Depends(get_db),
    redis_client: aioredis.Redis = Depends(get_redis)
):
    stmt = select(Bed).where(Bed.id == bed_id)
    res = await db.execute(stmt)
    bed = res.scalar_one_or_none()
    if not bed:
        raise HTTPException(status_code=404, detail="Bed not found")

    bed.status = payload.status
    bed.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(bed)

    event = {
        "type": "BED_STATUS_MUTATION",
        "bed_id": str(bed.id),
        "status": bed.status.value,
        "room_number": bed.room_number
    }
    await redis_client.publish("bed_updates", json.dumps(event))
    return bed

@api_router.post("/patients", response_model=PatientResponse)
async def create_patient(payload: PatientCreate, db: AsyncSession = Depends(get_db)):
    patient = Patient(**payload.model_dump())
    db.add(patient)
    await db.commit()
    await db.refresh(patient)
    return patient

@api_router.post("/allocations/request", response_model=AllocationResponse)
async def request_bed_allocation(
    payload: AllocationRequest,
    db: AsyncSession = Depends(get_db),
    redis_client: aioredis.Redis = Depends(get_redis)
):
    try:
        ticket = await match_and_allocate_bed(
            db=db,
            redis_client=redis_client,
            patient_id=payload.patient_id,
            target_tier=payload.target_tier,
            wait_time_minutes=payload.wait_time_minutes
        )
        return AllocationResponse(
            ticket_id=ticket.id,
            patient_id=ticket.patient_id,
            assigned_bed_id=ticket.assigned_bed_id,
            status=ticket.status,
            priority_score=ticket.priority_score
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
