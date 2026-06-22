from fastapi import APIRouter, Depends, HTTPException
from models.schemas import AgentQuery, EnforcementResponse, HotspotDetail
from api.routers.auth import require_role
from models.sql_models import UserRole, User
from ml.agents import enforcement_agent
from core.logging import logger

router = APIRouter(prefix="/enforcement", tags=["enforcement"])

@router.post("/query", response_model=EnforcementResponse)
async def enforcement_agent_query(
    query_in: AgentQuery, 
    user: User = Depends(require_role([UserRole.ADMIN, UserRole.ENFORCEMENT]))
):
    """
    Enforcement Intelligence Agent.
    Queries active regulations in Neo4j and matches spatial hotspots in PostGIS.
    Requires ADMIN or ENFORCEMENT role.
    """
    logger.info(f"Enforcement agent queried by {user.email}: {query_in.query}")
    
    # Use default coordinates (Delhi Central) if not provided in the query
    lat = query_in.lat if query_in.lat is not None else 28.6139
    lon = query_in.lon if query_in.lon is not None else 77.2090
    
    try:
        plan = await enforcement_agent.generate_enforcement_plan(lat, lon, query_in.query)
        
        return EnforcementResponse(
            primary_hotspot=HotspotDetail(
                source_type=plan["primary_hotspot"]["source_type"],
                contribution_pct=plan["primary_hotspot"]["contribution_pct"],
                hotspot_lat=plan["primary_hotspot"]["hotspot_lat"],
                hotspot_lon=plan["primary_hotspot"]["hotspot_lon"]
            ),
            inspection_target=plan["inspection_target"],
            governing_regulation=plan["governing_regulation"],
            recommended_actions=plan["recommended_actions"],
            estimated_impact=plan["estimated_impact"],
            geospatial_evidence=plan["geospatial_evidence"],
            timestamp=plan["timestamp"]
        )
    except Exception as e:
        logger.error(f"Enforcement agent workflow failure: {e}")
        raise HTTPException(status_code=500, detail=f"Enforcement query failed: {str(e)}")
