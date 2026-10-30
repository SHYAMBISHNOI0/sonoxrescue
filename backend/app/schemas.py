from typing import Literal
from pydantic import BaseModel, Field, ConfigDict

Role = Literal['Administrator', 'Imaging technician', 'Radiology reviewer', 'Clinical safety reviewer', 'Read-only observer']
Scenario = Literal['healthy', 'worklist', 'accession', 'identity', 'transfer', 'acknowledgement', 'duplicate', 'compound']

class ExperimentConfig(BaseModel):
    model_config = ConfigDict(extra='forbid')
    seed: int = Field(42, ge=1, le=999999)
    count: int = Field(400, ge=16, le=10000)
    missing: float = Field(.1, ge=0, le=.9)
    noise: float = Field(5, ge=0, le=60)
    corruption: float = Field(.05, ge=0, le=.9)
    faults: int = Field(1, ge=1, le=3)
    threshold: float = Field(.5, ge=0, le=1)
    abstention: float = Field(.8, ge=0, le=1)

class Command(BaseModel):
    model_config = ConfigDict(extra='forbid')
    type: Literal['simulate', 'approve', 'reject', 'execute', 'verify', 'assign', 'analyze', 'reset', 'experiment']
    id: str | None = Field(None, max_length=100)
    scenario: Scenario = 'healthy'
    reason: str = Field('', max_length=2000)
    evidence: str = Field('', max_length=500)
    config: ExperimentConfig | None = None

class Login(BaseModel):
    role: Role
    password: str = Field(min_length=1, max_length=256)

class SimulationRequest(BaseModel):
    scenario: Scenario = 'healthy'

class Decision(BaseModel):
    reason: str = Field('', max_length=2000)
    evidence: str = Field('', max_length=500)
