from fastapi import APIRouter, HTTPException
from models.schemas import AgentQuery, AgentWorkflowResponse
from ml.agent_workflow import agent_graph
from core.logging import logger

router = APIRouter(prefix="/health-risk", tags=["health-risk"])

@router.post("/advisory", response_model=AgentWorkflowResponse)
async def health_advisory_query(query_in: AgentQuery):
    """
    Triggers the LangGraph multi-agent citizen health advisory pipeline.
    Runs Forecast -> Source Attribution -> Enforcement -> Health Advisory -> Policy Intelligence.
    """
    logger.info(f"Health advisory requested: {query_in.query}")
    
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
        logger.error(f"Health advisory graph execution failed: {e}")
        raise HTTPException(status_code=500, detail=f"Advisory agent failed: {str(e)}")
