from fastapi import APIRouter, Depends, HTTPException
from models.schemas import AgentQuery, AgentWorkflowResponse
from api.routers.auth import require_role
from models.sql_models import UserRole, User
from ml.agent_workflow import agent_graph
from core.logging import logger

router = APIRouter(prefix="/policy", tags=["policy"])

@router.post("/evaluate", response_model=AgentWorkflowResponse)
async def evaluate_policy(
    query_in: AgentQuery,
    user: User = Depends(require_role([UserRole.ADMIN, UserRole.ANALYST]))
):
    """
    Triggers the LangGraph multi-agent policy evaluation pipeline.
    Runs Forecast -> Source Attribution -> Enforcement -> Health Advisory -> Policy Intelligence.
    Requires ADMIN or ANALYST role.
    """
    logger.info(f"Policy evaluation requested by {user.email}: {query_in.query}")
    
    lat = query_in.lat if query_in.lat is not None else 28.6139
    lon = query_in.lon if query_in.lon is not None else 77.2090
    
    initial_state = {
        "lat": lat,
        "lon": lon,
        "hours": 24,
        "query": query_in.query,
        "forecast": [],
        "attribution": [],
        "enforcement_plan": {},
        "health_advisory": {},
        "policy_plan": {},
        "spike_detected": False,
        "primary_source": "",
        "messages": []
    }
    
    try:
        final_state = await agent_graph.ainvoke(initial_state)
        
        return AgentWorkflowResponse(
            lat=final_state["lat"],
            lon=final_state["lon"],
            spike_detected=final_state["spike_detected"],
            messages=final_state["messages"],
            forecast=final_state["forecast"],
            attribution=final_state["attribution"] if final_state["attribution"] else None,
            enforcement_plan=final_state["enforcement_plan"] if final_state["enforcement_plan"] else None,
            health_advisory=final_state["health_advisory"] if final_state["health_advisory"] else None,
            policy_plan=final_state["policy_plan"] if final_state["policy_plan"] else None
        )
    except Exception as e:
        logger.error(f"Policy evaluation graph execution failed: {e}")
        raise HTTPException(status_code=500, detail=f"Policy agent failed: {str(e)}")
