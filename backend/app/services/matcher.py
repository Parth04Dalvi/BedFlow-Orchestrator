import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.models.hospital import BedStatus, CareTier, TriageAcuity

class UnitCreate(BaseModel):
    name: str
    wing: str
    floor: int
    tier: CareTier

class UnitResponse(UnitCreate):
    id: uuid.UUID
    model_config = ConfigDict(from_attributes=True)

class BedCreate(BaseModel):
    unit_id: uuid.UUID
    room_number: str
    bed_identifier: str
    has_ventilator: bool = False
    has_negative_pressure: bool = False
    has_dialysis_hookup: bool = False

class BedStatusUpdate(BaseModel):
    status: BedStatus

class BedResponse(BedCreate):
    id: uuid.UUID
    status: BedStatus
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class PatientCreate(BaseModel):
    mrn: str
    first_name: str
    last_name: str
    acuity: TriageAcuity
    requires_ventilator: bool = False
    requires_isolation: bool = False
    requires_dialysis: bool = False

class PatientResponse(PatientCreate):
    id: uuid.UUID
    admitted_at: datetime
    model_config = ConfigDict(from_attributes=True)

class AllocationRequest(BaseModel):
    patient_id: uuid.UUID
    target_tier: CareTier
    wait_time_minutes: float = 0.0

class AllocationResponse(BaseModel):
    ticket_id: uuid.UUID
    patient_id: uuid.UUID
    assigned_bed_id: uuid.UUID | None
    status: str
    priority_score: float
