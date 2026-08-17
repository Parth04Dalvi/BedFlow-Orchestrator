import uuid
import enum
from datetime import datetime
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class BedStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    RESERVED = "RESERVED"
    OCCUPIED = "OCCUPIED"
    CLEANING_IN_PROGRESS = "CLEANING_IN_PROGRESS"
    MAINTENANCE = "MAINTENANCE"

class CareTier(str, enum.Enum):
    GENERAL = "GENERAL"
    STEP_DOWN = "STEP_DOWN"
    ICU = "ICU"
    ISOLATION = "ISOLATION"

class TriageAcuity(str, enum.Enum):
    ESI_1 = "ESI_1"
    ESI_2 = "ESI_2"
    ESI_3 = "ESI_3"
    ESI_4 = "ESI_4"
    ESI_5 = "ESI_5"

class Unit(Base):
    __tablename__ = "units"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(64), nullable=False)
    wing: Mapped[str] = mapped_column(String(32), nullable=False)
    floor: Mapped[int] = mapped_column(Integer, nullable=False)
    tier: Mapped[CareTier] = mapped_column(SQLEnum(CareTier), nullable=False)
    beds: Mapped[list["Bed"]] = relationship("Bed", back_populates="unit", cascade="all, delete-orphan")

class Bed(Base):
    __tablename__ = "beds"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    unit_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("units.id", ondelete="CASCADE"))
    room_number: Mapped[str] = mapped_column(String(16), nullable=False)
    bed_identifier: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[BedStatus] = mapped_column(SQLEnum(BedStatus), default=BedStatus.AVAILABLE, index=True)
    has_ventilator: Mapped[bool] = mapped_column(Boolean, default=False)
    has_negative_pressure: Mapped[bool] = mapped_column(Boolean, default=False)
    has_dialysis_hookup: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    unit: Mapped["Unit"] = relationship("Unit", back_populates="beds")

class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    mrn: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    first_name: Mapped[str] = mapped_column(String(64), nullable=False)
    last_name: Mapped[str] = mapped_column(String(64), nullable=False)
    acuity: Mapped[TriageAcuity] = mapped_column(SQLEnum(TriageAcuity), nullable=False)
    requires_ventilator: Mapped[bool] = mapped_column(Boolean, default=False)
    requires_isolation: Mapped[bool] = mapped_column(Boolean, default=False)
    requires_dialysis: Mapped[bool] = mapped_column(Boolean, default=False)
    admitted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class AllocationTicket(Base):
    __tablename__ = "allocation_tickets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"))
    target_tier: Mapped[CareTier] = mapped_column(SQLEnum(CareTier), nullable=False)
    assigned_bed_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("beds.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="PENDING")
    priority_score: Mapped[float] = mapped_column(nullable=False)
    requested_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
