from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from models.sql_models import UserRole

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: UserRole = UserRole.CITIZEN

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    role: UserRole
    is_active: bool

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[UserRole] = None

class ForecastRequest(BaseModel):
    lat: float
    lon: float
    hours: int = 24

class ForecastResponse(BaseModel):
    timestamp: datetime
    pm25: float
    pm10: float
    no2: float
    so2: float
    aqi: float

class SourceAttributionResponse(BaseModel):
    source_type: str
    contribution_pct: float
    confidence_score: float
    evidence_log: str
    evidence_lat: float
    evidence_lon: float

class AgentQuery(BaseModel):
    query: str
    lat: Optional[float] = None
    lon: Optional[float] = None

class AgentResponse(BaseModel):
    response: str

class HotspotDetail(BaseModel):
    source_type: str
    contribution_pct: float
    hotspot_lat: float
    hotspot_lon: float

class EnforcementResponse(BaseModel):
    primary_hotspot: HotspotDetail
    inspection_target: str
    governing_regulation: str
    recommended_actions: str
    estimated_impact: str
    geospatial_evidence: str
    timestamp: str

class AgentWorkflowResponse(BaseModel):
    lat: float
    lon: float
    spike_detected: bool
    messages: List[str]
    forecast: Optional[List[Dict[str, Any]]] = None
    attribution: Optional[List[Dict[str, Any]]] = None
    enforcement_plan: Optional[Dict[str, Any]] = None
    health_advisory: Optional[Dict[str, Any]] = None
    policy_plan: Optional[Dict[str, Any]] = None
