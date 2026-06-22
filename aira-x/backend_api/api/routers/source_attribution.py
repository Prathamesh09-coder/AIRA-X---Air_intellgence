from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from db.database import get_db
from models.schemas import SourceAttributionResponse
from ml.agents import attribution_agent
from core.logging import logger

router = APIRouter(prefix="/source-attribution", tags=["source-attribution"])

@router.get("/", response_model=list[SourceAttributionResponse])
async def get_source_attribution(lat: float, lon: float, radius_km: float = 5.0, db: AsyncSession = Depends(get_db)):
    """
    Geospatial Source Attribution Endpoint.
    Uses PollutionSourceAttributionAgent to execute ML + SHAP explaining.
    """
    try:
        logger.info(f"Running source attribution for lat={lat}, lon={lon}, radius={radius_km}km")
        results = attribution_agent.attribute_sources(lat, lon, radius_km)
        
        return [
            SourceAttributionResponse(
                source_type=r["source_type"],
                contribution_pct=r["contribution_pct"],
                confidence_score=r["confidence_score"],
                evidence_log=r["evidence_log"],
                evidence_lat=r["evidence_lat"],
                evidence_lon=r["evidence_lon"]
            ) for r in results
        ]
    except Exception as e:
        logger.error(f"Source attribution failure: {e}")
        raise HTTPException(status_code=500, detail=f"Source attribution failed: {str(e)}")
