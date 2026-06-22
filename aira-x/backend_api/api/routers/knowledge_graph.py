from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any
from ml.graph_service import graph_service
from core.logging import logger

router = APIRouter(prefix="/knowledge-graph", tags=["knowledge-graph"])

@router.post("/ingest")
async def ingest_knowledge_graph():
    """
    Clears the knowledge graph database and seeds it with a standard
    multi-city, multi-layer environmental ontology (Monitoring Stations,
    Pollutants, Industries, Construction Sites, Traffic Corridors,
    Cities, Wards, and Population Clusters).
    """
    try:
        res = await graph_service.seed_graph()
        return res
    except Exception as e:
        logger.error(f"Failed to seed Neo4j knowledge graph: {e}")
        raise HTTPException(status_code=500, detail=f"Graph seeding failed: {str(e)}")

@router.get("/search")
async def search_graph(
    query: Optional[str] = Query(None, description="Search term matching node name or labels"),
    label: Optional[str] = Query(None, description="Filter search results by node label (e.g. Industry, Pollutant)")
):
    """
    Fuzzy text search for environmental entities across the knowledge graph.
    """
    try:
        nodes = await graph_service.search_nodes(query, label)
        return nodes
    except Exception as e:
        logger.error(f"Failed to search Neo4j knowledge graph: {e}")
        raise HTTPException(status_code=500, detail=f"Graph search failed: {str(e)}")

@router.get("/impact-analysis")
async def analyze_impact(
    source: str = Query(..., description="Name of source emitter (e.g. 'Apex Brick Kiln' or 'Silk Board')")
):
    """
    Traces downstream impact paths from source emitters to vulnerable population clusters:
    (Source) -[:CAUSES]-> (Pollutant) -[:IMPACTS]-> (PopulationCluster)
    """
    try:
        impacts = await graph_service.impact_analysis(source)
        return impacts
    except Exception as e:
        logger.error(f"Impact analysis traversal failed: {e}")
        raise HTTPException(status_code=500, detail=f"Impact analysis traversal failed: {str(e)}")

@router.get("/root-cause")
async def trace_root_cause(
    target: str = Query(..., description="Name of target (e.g. 'Okhla Vihar Residential' or 'Delhi Central Station')")
):
    """
    Traces upstream pollution contributors and pathways leading to an affected target node.
    """
    try:
        causes = await graph_service.root_cause_tracing(target)
        return causes
    except Exception as e:
        logger.error(f"Root cause tracing failed: {e}")
        raise HTTPException(status_code=500, detail=f"Root cause tracing failed: {str(e)}")

@router.get("/nodes")
async def get_kg_nodes(limit: int = 50):
    """
    Legacy visualization endpoint - maps directly to general node search.
    """
    try:
        return await graph_service.search_nodes("", None)
    except Exception as e:
        logger.error(f"Failed to fetch KG nodes: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch nodes: {str(e)}")
