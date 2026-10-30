"""Relational persistence with explicit references and append-only audit records."""
import os
from pathlib import Path
from sqlalchemy import JSON, ForeignKey, String, Integer, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

DATA_DIR = Path(os.getenv('SONORESCUE_DATA_DIR', 'data')).resolve()
DATA_DIR.mkdir(parents=True, exist_ok=True)
DATABASE_URL = os.getenv('DATABASE_URL', f'sqlite:///{DATA_DIR / "sonorescue.db"}')
engine = create_engine(DATABASE_URL, connect_args={'check_same_thread': False} if DATABASE_URL.startswith('sqlite') else {}, pool_pre_ping=True)
if DATABASE_URL.startswith('sqlite'):
    @event.listens_for(engine, 'connect')
    def sqlite_settings(connection, _):
        connection.execute('PRAGMA foreign_keys=ON')
        connection.execute('PRAGMA journal_mode=WAL')
Session = sessionmaker(engine, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

class Patient(Base):
    __tablename__ = 'patient_identities'
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    authority: Mapped[str] = mapped_column(String(100))

class Device(Base):
    __tablename__ = 'devices'
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    modality: Mapped[str] = mapped_column(String(8))

class Order(Base):
    __tablename__ = 'imaging_orders'
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    patient_id: Mapped[str] = mapped_column(ForeignKey('patient_identities.id'))
    accession: Mapped[str] = mapped_column(String(100), index=True)
    payload: Mapped[dict] = mapped_column(JSON)

class Study(Base):
    __tablename__ = 'imaging_studies'
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    uid: Mapped[str] = mapped_column(String(64), unique=True)
    device_id: Mapped[str] = mapped_column(ForeignKey('devices.id'))
    patient_value: Mapped[str] = mapped_column(String(100), index=True)
    payload: Mapped[dict] = mapped_column(JSON)

class WorkflowEvent(Base):
    __tablename__ = 'workflow_events'
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    study_id: Mapped[str] = mapped_column(ForeignKey('imaging_studies.id'), index=True)
    source: Mapped[str] = mapped_column(String(100))
    timestamp: Mapped[str] = mapped_column(String(40), index=True)
    payload: Mapped[dict] = mapped_column(JSON)

class Investigation(Base):
    __tablename__ = 'investigations'
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    study_id: Mapped[str] = mapped_column(ForeignKey('imaging_studies.id'), unique=True)
    payload: Mapped[dict] = mapped_column(JSON)

class Recovery(Base):
    __tablename__ = 'recovery_actions'
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    investigation_id: Mapped[str] = mapped_column(ForeignKey('investigations.id'))
    payload: Mapped[dict] = mapped_column(JSON)

class Audit(Base):
    __tablename__ = 'audit_entries'
    sequence: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    payload: Mapped[dict] = mapped_column(JSON)
    previous_hash: Mapped[str] = mapped_column(String(64))
    digest: Mapped[str] = mapped_column(String(64))

class Experiment(Base):
    __tablename__ = 'experiments'
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    payload: Mapped[dict] = mapped_column(JSON)

class Idempotency(Base):
    __tablename__ = 'idempotency_keys'
    id: Mapped[str] = mapped_column(String(200), primary_key=True)
    request_hash: Mapped[str] = mapped_column(String(64))
    response: Mapped[dict] = mapped_column(JSON)
