from db.neo4j_db import neo4j_db
from core.logging import logger
from typing import List, Dict, Any, Optional

class KnowledgeGraphService:
    async def seed_graph(self) -> Dict[str, Any]:
        """
        Clears the graph and seeds it with a standard, representative urban environmental topology.
        """
        logger.info("Starting Neo4j knowledge graph seeding...")
        
        clear_query = "MATCH (n) DETACH DELETE n;"
        
        seed_queries = [
            # 1. Cities
            "CREATE (delhi:City {name: 'Delhi', state: 'Delhi'})",
            "CREATE (bangalore:City {name: 'Bangalore', state: 'Karnataka'})",
            
            # 2. Wards (Delhi)
            "MATCH (delhi:City {name: 'Delhi'}) "
            "CREATE (w1:Ward {name: 'Ward 1 - Central', code: 'W1'}), "
            "       (w2:Ward {name: 'Ward 2 - Industrial', code: 'W2'}), "
            "       (w3:Ward {name: 'Ward 3 - Residential', code: 'W3'}), "
            "       (w4:Ward {name: 'Ward 4 - Suburbs', code: 'W4'}) "
            "CREATE (w1)-[:LOCATED_IN]->(delhi), "
            "       (w2)-[:LOCATED_IN]->(delhi), "
            "       (w3)-[:LOCATED_IN]->(delhi), "
            "       (w4)-[:LOCATED_IN]->(delhi) "
            "CREATE (w1)-[:CONNECTED_TO]->(w2), "
            "       (w2)-[:CONNECTED_TO]->(w3), "
            "       (w3)-[:CONNECTED_TO]->(w4)",
            
            # 3. Wards (Bangalore)
            "MATCH (bangalore:City {name: 'Bangalore'}) "
            "CREATE (w5:Ward {name: 'Ward 5 - Whitefield', code: 'W5'}), "
            "       (w6:Ward {name: 'Ward 6 - Koramangala', code: 'W6'}) "
            "CREATE (w5)-[:LOCATED_IN]->(bangalore), "
            "       (w6)-[:LOCATED_IN]->(bangalore) "
            "CREATE (w5)-[:CONNECTED_TO]->(w6)",
            
            # 4. Monitoring Stations
            "MATCH (w1:Ward {code: 'W1'}), (w2:Ward {code: 'W2'}), (w5:Ward {code: 'W5'}) "
            "CREATE (ms1:MonitoringStation {name: 'Delhi Central Station', code: 'MS001', lat: 28.6139, lon: 77.2090}), "
            "       (ms2:MonitoringStation {name: 'Okhla Industrial Station', code: 'MS002', lat: 28.5355, lon: 77.2728}), "
            "       (ms3:MonitoringStation {name: 'Whitefield Station', code: 'MS003', lat: 12.9698, lon: 77.7499}) "
            "CREATE (ms1)-[:LOCATED_IN]->(w1), "
            "       (ms2)-[:LOCATED_IN]->(w2), "
            "       (ms3)-[:LOCATED_IN]->(w5)",
            
            # 5. Pollutants
            "CREATE (p1:Pollutant {name: 'PM2.5', standard_limit: 60.0, unit: 'ug/m^3'}), "
            "       (p2:Pollutant {name: 'PM10', standard_limit: 100.0, unit: 'ug/m^3'}), "
            "       (p3:Pollutant {name: 'NO2', standard_limit: 80.0, unit: 'ug/m^3'}), "
            "       (p4:Pollutant {name: 'SO2', standard_limit: 80.0, unit: 'ug/m^3'})",
            
            # 6. Industries
            "MATCH (w2:Ward {code: 'W2'}), (w5:Ward {code: 'W5'}), (p1:Pollutant {name: 'PM2.5'}), (p2:Pollutant {name: 'PM10'}), (p4:Pollutant {name: 'SO2'}) "
            "CREATE (ind1:Industry {name: 'Apex Brick Kiln', type: 'Brick Manufacturing', emission_rate: 150.5, lat: 28.5300, lon: 77.2800}), "
            "       (ind2:Industry {name: 'Okhla Thermal Power Plant', type: 'Power Generation', emission_rate: 850.0, lat: 28.5400, lon: 77.2900}), "
            "       (ind3:Industry {name: 'Whitefield Steel Casting', type: 'Metal Processing', emission_rate: 340.0, lat: 12.9800, lon: 77.7600}) "
            "CREATE (ind1)-[:LOCATED_IN]->(w2), "
            "       (ind2)-[:LOCATED_IN]->(w2), "
            "       (ind3)-[:LOCATED_IN]->(w5) "
            "CREATE (ind1)-[:CAUSES {contribution: 'High'}]->(p1), "
            "       (ind1)-[:CAUSES {contribution: 'Medium'}]->(p2), "
            "       (ind2)-[:CAUSES {contribution: 'High'}]->(p4), "
            "       (ind2)-[:CAUSES {contribution: 'Medium'}]->(p1), "
            "       (ind3)-[:CAUSES {contribution: 'High'}]->(p1)",
            
            # 7. Construction Sites
            "MATCH (w1:Ward {code: 'W1'}), (w5:Ward {code: 'W5'}), (p1:Pollutant {name: 'PM2.5'}), (p2:Pollutant {name: 'PM10'}) "
            "CREATE (cs1:ConstructionSite {name: 'Metro Phase IV Site', permit_id: 'PERMIT-452A', status: 'Active', lat: 28.6150, lon: 77.2150}), "
            "       (cs2:ConstructionSite {name: 'Executive Enclave Project', permit_id: 'PERMIT-908B', status: 'Active', lat: 28.6100, lon: 77.2050}), "
            "       (cs3:ConstructionSite {name: 'IT Corridor Outer Ring Road', permit_id: 'PERMIT-111X', status: 'Active', lat: 12.9500, lon: 77.7200}) "
            "CREATE (cs1)-[:LOCATED_IN]->(w1), "
            "       (cs2)-[:LOCATED_IN]->(w1), "
            "       (cs3)-[:LOCATED_IN]->(w5) "
            "CREATE (cs1)-[:CAUSES {contribution: 'High'}]->(p2), "
            "       (cs2)-[:CAUSES {contribution: 'Medium'}]->(p2), "
            "       (cs1)-[:CAUSES {contribution: 'Medium'}]->(p1), "
            "       (cs3)-[:CAUSES {contribution: 'High'}]->(p2)",
            
            # 8. Traffic Corridors
            "MATCH (w1:Ward {code: 'W1'}), (w6:Ward {code: 'W6'}), (ms1:MonitoringStation {code: 'MS001'}), (p1:Pollutant {name: 'PM2.5'}), (p3:Pollutant {name: 'NO2'}) "
            "CREATE (tc1:TrafficCorridor {name: 'Ring Road Stretch A', road_type: 'Expressway', congestion_level: 'Critical', lat: 28.6200, lon: 77.2200}), "
            "       (tc2:TrafficCorridor {name: 'Inner Circle Connaught Place', road_type: 'Arterial', congestion_level: 'High', lat: 28.6300, lon: 77.2180}), "
            "       (tc3:TrafficCorridor {name: 'Silk Board Junction', road_type: 'Expressway', congestion_level: 'Critical', lat: 12.9176, lon: 77.6244}) "
            "CREATE (tc1)-[:LOCATED_IN]->(w1), "
            "       (tc2)-[:LOCATED_IN]->(w1), "
            "       (tc3)-[:LOCATED_IN]->(w6) "
            "CREATE (tc1)-[:CAUSES {contribution: 'High'}]->(p3), "
            "       (tc1)-[:CAUSES {contribution: 'High'}]->(p1), "
            "       (tc2)-[:CAUSES {contribution: 'Medium'}]->(p3), "
            "       (tc3)-[:CAUSES {contribution: 'High'}]->(p3), "
            "       (tc3)-[:CAUSES {contribution: 'High'}]->(p1) "
            "CREATE (tc1)-[:INFLUENCES]->(ms1)",
            
            # 9. Population Clusters
            "MATCH (w1:Ward {code: 'W1'}), (w2:Ward {code: 'W2'}), (w5:Ward {code: 'W5'}), "
            "      (p1:Pollutant {name: 'PM2.5'}), (p2:Pollutant {name: 'PM10'}), (p3:Pollutant {name: 'NO2'}), (p4:Pollutant {name: 'SO2'}) "
            "CREATE (pop1:PopulationCluster {name: 'Connaught Place Commercial Area', density: 25000, vulnerability_index: 0.4}), "
            "       (pop2:PopulationCluster {name: 'Okhla Vihar Residential', density: 45000, vulnerability_index: 0.85}), "
            "       (pop3:PopulationCluster {name: 'Whitefield Tech Habitation', density: 35000, vulnerability_index: 0.6}) "
            "CREATE (pop1)-[:LOCATED_IN]->(w1), "
            "       (pop2)-[:LOCATED_IN]->(w2), "
            "       (pop3)-[:LOCATED_IN]->(w5) "
            "CREATE (p1)-[:IMPACTS {health_threat: 'Severe'}]->(pop2), "
            "       (p1)-[:IMPACTS {health_threat: 'Moderate'}]->(pop1), "
            "       (p2)-[:IMPACTS {health_threat: 'Moderate'}]->(pop1), "
            "       (p2)-[:IMPACTS {health_threat: 'Severe'}]->(pop2), "
            "       (p4)-[:IMPACTS {health_threat: 'Moderate'}]->(pop2), "
            "       (p3)-[:IMPACTS {health_threat: 'Mild'}]->(pop3), "
            "       (p1)-[:IMPACTS {health_threat: 'Severe'}]->(pop3)"
        ]

        async with neo4j_db.driver.session() as session:
            await session.run(clear_query)
            logger.info("Cleared existing Neo4j graph.")
            for q in seed_queries:
                await session.run(q)
            logger.info("Successfully seeded knowledge graph topology.")
            
        return {"status": "success", "message": "Knowledge Graph re-initialized and seeded with standard smart-city ontology."}

    async def search_nodes(self, query: str, label: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Searches graph nodes by case-insensitive name pattern and optional label.
        """
        cypher = "MATCH (n) WHERE 1=1 "
        params = {}
        if label:
            cypher = f"MATCH (n:{label}) WHERE 1=1 "
            
        if query:
            cypher += "AND (n.name =~ $regex OR labels(n)[0] =~ $regex) "
            params["regex"] = f"(?i).*{query}.*"
            
        cypher += "RETURN id(n) AS id, labels(n) AS labels, properties(n) AS props LIMIT 50"
        
        nodes = []
        async with neo4j_db.driver.session() as session:
            result = await session.run(cypher, **params)
            async for record in result:
                props = dict(record["props"])
                nodes.append({
                    "id": record["id"],
                    "labels": record["labels"],
                    "name": props.get("name", "Unnamed"),
                    "properties": props
                })
        return nodes

    async def impact_analysis(self, source_name: str) -> List[Dict[str, Any]]:
        """
        Traces downstream impact chains from a source emitter to vulnerable population clusters.
        Path: (Source) -[:CAUSES]-> (Pollutant) -[:IMPACTS]-> (PopulationCluster)
        """
        cypher = (
            "MATCH path = (s)-[:CAUSES]->(p:Pollutant)-[:IMPACTS]->(pop:PopulationCluster) "
            "WHERE s.name =~ $regex OR labels(s)[0] =~ $regex "
            "RETURN id(s) AS source_id, labels(s)[0] AS source_type, s.name AS source_name, "
            "       p.name AS pollutant_name, pop.name AS target_name, pop.density AS target_density, "
            "       pop.vulnerability_index AS vulnerability "
        )
        regex = f"(?i).*{source_name}.*"
        
        impacts = []
        async with neo4j_db.driver.session() as session:
            result = await session.run(cypher, regex=regex)
            async for record in result:
                impacts.append({
                    "source": {
                        "id": record["source_id"],
                        "type": record["source_type"],
                        "name": record["source_name"]
                    },
                    "pollutant": record["pollutant_name"],
                    "impacted_population": {
                        "name": record["target_name"],
                        "density": record["target_density"],
                        "vulnerability_index": record["vulnerability"]
                    }
                })
        return impacts

    async def root_cause_tracing(self, target_name: str) -> List[Dict[str, Any]]:
        """
        Traces upstream contributors back from an impacted entity (PopulationCluster or MonitoringStation).
        """
        cypher = (
            "MATCH path = (s)-[*1..3]->(t) "
            "WHERE (t:PopulationCluster OR t:MonitoringStation) "
            "  AND (t.name =~ $regex) "
            "  AND (s:Industry OR s:ConstructionSite OR s:TrafficCorridor) "
            "RETURN t.name AS target_name, labels(t)[0] AS target_type, "
            "       s.name AS source_name, labels(s)[0] AS source_type, s.type AS ind_type, s.road_type AS road_type"
        )
        regex = f"(?i).*{target_name}.*"
        
        causes = []
        async with neo4j_db.driver.session() as session:
            result = await session.run(cypher, regex=regex)
            async for record in result:
                sub_type = record["ind_type"] or record["road_type"] or "N/A"
                causes.append({
                    "target": {
                        "name": record["target_name"],
                        "type": record["target_type"]
                    },
                    "source": {
                        "name": record["source_name"],
                        "type": record["source_type"],
                        "sub_type": sub_type
                    }
                })
        return causes

graph_service = KnowledgeGraphService()
