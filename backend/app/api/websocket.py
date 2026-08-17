import json
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import redis.asyncio as aioredis
from app.models.hospital import Bed, Unit, Patient, AllocationTicket, BedStatus, CareTier, TriageAcuity

def compute_priority_score(acuity: TriageAcuity, wait_minutes: float, requires_vent: bool, requires_iso: bool) -> float:
    weights = {
        TriageAcuity.ESI_1: 1000.0,
        TriageAcuity.ESI_2: 500.0,
        TriageAcuity.ESI_3: 200.0,
        TriageAcuity.ESI_4: 50.0,
        TriageAcuity.ESI_5: 10.0,
    }
    base = weights.get(acuity, 10.0)
    wait_factor = wait_minutes * 3.5
    equipment_factor = (300.0 if requires_vent else 0.0) + (150.0 if requires_iso else 0.0)
    return base + wait_factor + equipment_factor

async def match_and_allocate_bed(
    db: AsyncSession,
    redis_client: aioredis.Redis,
    patient_id,
    target_tier: CareTier,
    wait_time_minutes: float = 0.0
) -> AllocationTicket:
    patient_stmt = select(Patient).where(Patient.id == patient_id)
    patient_res = await db.execute(patient_stmt)
    patient = patient_res.scalar_one_or_none()

    if not patient:
        raise ValueError("Patient record not found")

    score = compute_priority_score(
        patient.acuity,
        wait_time_minutes,
        patient.requires_ventilator,
        patient.requires_isolation
    )

    ticket = AllocationTicket(
        patient_id=patient.id,
        target_tier=target_tier,
        status="PENDING",
        priority_score=score
    )
    db.add(ticket)
    await db.flush()

    # Pessimistic concurrency: lock matched bed to avoid race conditions
    query = (
        select(Bed)
        .join(Unit)
        .where(
            Bed.status == BedStatus.AVAILABLE,
            Unit.tier == target_tier,
            Bed.has_ventilator >= patient.requires_ventilator,
            Bed.has_negative_pressure >= patient.requires_isolation,
            Bed.has_dialysis_hookup >= patient.requires_dialysis
        )
        .with_for_update(skip_locked=True)
        .limit(1)
    )

    bed_res = await db.execute(query)
    bed = bed_res.scalar_one_or_none()

    if bed:
        bed.status = BedStatus.RESERVED
        bed.updated_at = datetime.utcnow()
        ticket.assigned_bed_id = bed.id
        ticket.status = "ASSIGNED"
        ticket.assigned_at = datetime.utcnow()

        event = {
            "type": "BED_STATUS_MUTATION",
            "bed_id": str(bed.id),
            "status": bed.status.value,
            "room_number": bed.room_number,
            "patient_id": str(patient.id)
        }
        await redis_client.publish("bed_updates", json.dumps(event))

    await db.commit()
    await db.refresh(ticket)
    return ticket
