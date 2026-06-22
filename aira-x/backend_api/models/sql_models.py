from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
import enum
from datetime import datetime
from db.database import Base

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    ANALYST = "analyst"
    CITIZEN = "citizen"
    ENFORCEMENT = "enforcement"

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.CITIZEN, nullable=False)
    is_active = Column(Boolean, default=True)

class Sensor(Base):
    __tablename__ = "sensors"
    
    id = Column(Integer, primary_key=True, index=True)
    sensor_id = Column(String, unique=True, index=True, nullable=False)
    source = Column(String, nullable=False) # e.g. CPCB, OpenAQ
    geom = Column(Geometry(geometry_type='POINT', srid=4326), nullable=False)
    metadata_json = Column(String)
    
    readings = relationship("AQIReading", back_populates="sensor")

class AQIReading(Base):
    __tablename__ = "aqi_readings"
    
    id = Column(Integer, primary_key=True, index=True)
    sensor_id = Column(Integer, ForeignKey("sensors.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    pm25 = Column(Float)
    pm10 = Column(Float)
    no2 = Column(Float)
    co = Column(Float)
    
    sensor = relationship("Sensor", back_populates="readings")

class AQIForecast(Base):
    __tablename__ = "aqi_forecasts"
    
    id = Column(Integer, primary_key=True, index=True)
    grid_geom = Column(Geometry(geometry_type='POLYGON', srid=4326), nullable=False)
    target_timestamp = Column(DateTime, nullable=False)
    predicted_pm25 = Column(Float, nullable=False)
    confidence_interval = Column(Float)

class PollutionSource(Base):
    __tablename__ = "pollution_sources"
    
    id = Column(Integer, primary_key=True, index=True)
    source_type = Column(String, nullable=False) # e.g. crop_fire, factory, traffic
    geom = Column(Geometry(geometry_type='POINT', srid=4326), nullable=False)
    confidence = Column(Float)
    detected_at = Column(DateTime, default=datetime.utcnow)
