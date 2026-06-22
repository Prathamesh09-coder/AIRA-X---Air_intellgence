import os
from typing import TypedDict, List, Dict, Any, Optional
from langgraph.graph import StateGraph, END

from ml.inference import inference_engine
from ml.agents import attribution_agent, enforcement_agent
from core.logging import logger

class AgentState(TypedDict):
    lat: float
    lon: float
    hours: int
    query: str
    forecast: List[Dict[str, Any]]
    attribution: List[Dict[str, Any]]
    enforcement_plan: Dict[str, Any]
    health_advisory: Dict[str, Any]
    policy_plan: Dict[str, Any]
    spike_detected: bool
    primary_source: str
    messages: List[str]

# 1. Forecast Agent Node
async def forecast_node(state: AgentState) -> AgentState:
    logger.info("Executing Forecast Agent Node...")
    lat, lon, hours = state["lat"], state["lon"], state["hours"]
    
    # Get GNN forecasts
    forecasts = inference_engine.predict(lat, lon, hours)
    
    # Calculate average PM2.5 to check for spike
    avg_pm25 = sum(f["pm25"] for f in forecasts) / len(forecasts) if forecasts else 0.0
    spike_detected = avg_pm25 > 50.0 # Spike threshold
    
    msg_list = list(state.get("messages", []))
    if spike_detected:
        msg = f"[Forecast Agent] Alert! Detected PM2.5 spike. Projected average: {avg_pm25:.2f} ug/m^3. Triggering Source Attribution."
    else:
        msg = f"[Forecast Agent] PM2.5 levels are nominal. Projected average: {avg_pm25:.2f} ug/m^3. Workflow complete."
        
    msg_list.append(msg)
    
    return {
        **state,
        "forecast": forecasts,
        "spike_detected": spike_detected,
        "messages": msg_list
    }

# 2. Source Attribution Agent Node
async def attribution_node(state: AgentState) -> AgentState:
    logger.info("Executing Source Attribution Agent Node...")
    lat, lon = state["lat"], state["lon"]
    
    # Fetch ML + SHAP attributions
    attributions = attribution_agent.attribute_sources(lat, lon)
    primary = attributions[0] if attributions else {"source_type": "Unknown", "contribution_pct": 0.0}
    
    msg_list = list(state["messages"])
    msg = f"[Source Attribution Agent] Identified '{primary['source_type']}' as the primary source contributing {primary['contribution_pct']}%."
    msg_list.append(msg)
    
    return {
        **state,
        "attribution": attributions,
        "primary_source": primary["source_type"],
        "messages": msg_list
    }

# 3. Enforcement Agent Node
async def enforcement_node(state: AgentState) -> AgentState:
    logger.info("Executing Enforcement Agent Node...")
    lat, lon, query = state["lat"], state["lon"], state["query"]
    
    # Fetch regulation from Neo4j & PostGIS inspection hotspots
    plan = await enforcement_agent.generate_enforcement_plan(lat, lon, query)
    
    msg_list = list(state["messages"])
    msg = f"[Enforcement Agent] Action: inspection ordered at '{plan['inspection_target']}' under governing law '{plan['governing_regulation']}'."
    msg_list.append(msg)
    
    return {
        **state,
        "enforcement_plan": plan,
        "messages": msg_list
    }

# 4. Health Agent Node
async def health_node(state: AgentState) -> AgentState:
    logger.info("Executing Health Agent Node...")
    source = state["primary_source"]
    forecast = state["forecast"]
    
    # Calculate peak PM2.5
    peak_pm25 = max(f["pm25"] for f in forecast) if forecast else 0.0
    
    # Formulate health advisory warnings
    if source in ["Crop residue burning", "Biomass burning"]:
        advisory_text = (
            f"ALERT: High concentrations of agricultural/smoke particles (Peak PM2.5: {peak_pm25:.2f}) "
            "detected upwind. Sensitive individuals (asthma, COPD) must stay indoors. N95 masks mandatory."
        )
        advisories = {
            "en": advisory_text,
            "hi": f"सतर्कता: हवा के बहाव में कृषि/धुएं के कणों की उच्च मात्रा (उच्चतम PM2.5: {peak_pm25:.2f}) पाई गई है। संवेदनशील लोग घर के अंदर रहें। N95 मास्क अनिवार्य है।",
            "mr": f"सतर्कता: हवेच्या प्रवाहात शेतातील कचरा/धुराच्या कणांचे प्रमाण (कमाल PM2.5: {peak_pm25:.2f}) जास्त आढळले आहे. संवेदनशील व्यक्तींनी घरातच राहावे. N95 मास्क अनिवार्य आहे।",
            "kn": f"ಎಚ್ಚರಿಕೆ: ಗಾಳಿಯಲ್ಲಿ ಕೃಷಿ/ಹೊಗೆಯ ಕಣಗಳ ಹೆಚ್ಚಿನ ಸಾಂದ್ರತೆ (ಗರಿಷ್ಠ PM2.5: {peak_pm25:.2f}) ಪತ್ತೆಯಾಗಿದೆ. ಸೂಕ್ಷ್ಮ ವ್ಯಕ್ತಿಗಳು ಒಳಗೆ ಇರಬೇಕು. N95 ಮಾಸ್ಕ್ ಕಡ್ಡಾಯವಾಗಿದೆ.",
            "ta": f"எச்சரிக்கை: காற்றில் விவசாய/புகை துகள்களின் அதிக செறிவு (உச்ச PM2.5: {peak_pm25:.2f}) கண்டறியப்பட்டுள்ளது. உணர்திறன் உடையவர்கள் வீட்டிற்குள் இருக்க வேண்டும். N95 முகமூடி கட்டாயம்."
        }
    elif source == "Traffic":
        advisory_text = (
            f"WARNING: Vehicle exhaust accumulation (Peak PM2.5: {peak_pm25:.2f}) in central junctions. "
            "Reduce outdoor exposure and avoid exercises along highway lanes."
        )
        advisories = {
            "en": advisory_text,
            "hi": f"चेतावनी: केंद्रीय चौराहों पर वाहनों के धुएं का संचय (उच्चतम PM2.5: {peak_pm25:.2f})। बाहरी संपर्क कम करें और राजमार्गों के किनारे व्यायाम करने से बचें।",
            "mr": f"तक्रार/इशारा: मध्यवर्ती चौकांमध्ये वाहनांच्या धुराचे प्रमाण (कमाल PM2.5: {peak_pm25:.2f}) वाढले आहे. घराबाहेर पडणे टाळा आणि महामार्गावर व्यायाम करणे टाळा।",
            "kn": f"ಎಚ್ಚರಿಕೆ: ಕೇಂದ್ರ ಜಂಕ್ಷನ್‌ಗಳಲ್ಲಿ ವಾಹನಗಳ ಹೊಗೆ ಶೇಖರಣೆಯಾಗಿದೆ (ಗರಿಷ್ಠ PM2.5: {peak_pm25:.2f}). ಹೊರಾಂಗಣ ಸಂಪರ್ಕವನ್ನು ಕಡಿಮೆ ಮಾಡಿ ಮತ್ತು ಹೆದ್ದಾರಿಯ ಉದ್ದಕ್ಕೂ ವ್ಯಾಯಾಮ ಮಾಡುವುದನ್ನು ತಪ್ಪಿಸಿ.",
            "ta": f"எச்சரிக்கை: மத்திய சந்திப்புகளில் வாகன புகைக் குவிப்பு (உச்ச PM2.5: {peak_pm25:.2f}). வெளிப்புற வெளிப்பாட்டைக் குறைத்து, நெடுஞ்சாலைகளில் உடற்பயிற்சி செய்வதைத் தவிர்க்கவும்."
        }
    elif source == "Industrial emissions":
        advisory_text = (
            f"WARNING: Elevated industrial stack emission markers (Peak PM2.5: {peak_pm25:.2f}). "
            "Run indoor air purifiers and close windows to prevent particulate ingress."
        )
        advisories = {
            "en": advisory_text,
            "hi": f"चेतावनी: औद्योगिक चिमनियों से उच्च उत्सर्जन (उच्चतम PM2.5: {peak_pm25:.2f})। धूल कणों के प्रवेश को रोकने के लिए घरों में एयर प्यूरीफायर चलाएं और खिड़कियां बंद रखें।",
            "mr": f"इशारा: औद्योगिक चिमण्यांमधून उत्सर्जनाचे प्रमाण (कमाल PM2.5: {peak_pm25:.2f}) वाढले आहे. हवा शुद्धीकरण यंत्रे चालवा आणि खिडक्या बंद ठेवा।",
            "kn": f"ಎಚ್ಚರಿಕೆ: ಕೈಗಾರಿಕಾ ಹೊರಸೂಸುವಿಕೆ ಹೆಚ್ಚಾಗಿದೆ (ಗರಿಷ್ಠ PM2.5: {peak_pm25:.2f}). ಒಳಾಂಗಣ ವಾಯು ಶುದ್ಧೀಕರಣ ಸಾಧನಗಳನ್ನು ಬಳಸಿ ಮತ್ತು ಕಿಟಕಿಗಳನ್ನು ಮುಚ್ಚಿ.",
            "ta": f"எச்சரிக்கை: தொழில்துறை உமிழ்வு அதிகரித்துள்ளது (உச்ச PM2.5: {peak_pm25:.2f}). உட்புற காற்று சுத்திகரிப்பான்களை இயக்கி, ஜன்னல்களை மூடி வைக்கவும்."
        }
    else:
        advisory_text = (
            f"CAUTION: Elevated particulate matter (Peak PM2.5: {peak_pm25:.2f}) observed. "
            "Vulnerable demographics should minimize heavy outdoor exertion."
        )
        advisories = {
            "en": advisory_text,
            "hi": f"सावधानी: धूल कणों का स्तर बढ़ा हुआ है (उच्चतम PM2.5: {peak_pm25:.2f})। संवेदनशील लोग भारी बाहरी गतिविधियों को कम करें।",
            "mr": f"सावधानता: हवेतील धुलीकणांचे प्रमाण (कमाल PM2.5: {peak_pm25:.2f}) वाढले आहे. संवेदनशील लोकांनी मैदानी खेळ किंवा जड कामे टाळावीत।",
            "kn": f"ಎಚ್ಚರಿಕೆ: ಗಾಳಿಯಲ್ಲಿ ಕಣಗಳ ಪ್ರಮಾಣ ಹೆಚ್ಚಾಗಿದೆ (ಗರಿಷ್ಠ PM2.5: {peak_pm25:.2f}). ಸೂಕ್ಷ್ಮ ಜನರು ಹೊರಾಂಗಣದಲ್ಲಿ ಹೆಚ್ಚಿನ ಶ್ರಮದ ಕೆಲಸ ಮಾಡುವುದನ್ನು ಕಡಿಮೆ ಮಾಡಬೇಕು.",
            "ta": f"ಎச்சரிக்கை: காற்றில் துகள்களின் அளவு அதிகரித்துள்ளது (உச்ச PM2.5: {peak_pm25:.2f}). உணர்திறன் உடையவர்கள் வெளிப்புற உடற்பயிற்சிகளைக் குறைக்க வேண்டும்."
        }
        
    health_plan = {
        "peak_pm25": peak_pm25,
        "advisory": advisory_text,
        "advisories": advisories,
        "target_demographics": "Sensitive groups (children, elderly, respiratory patients)"
    }
    
    msg_list = list(state["messages"])
    msg = f"[Health Agent] Formulated health advisory: '{advisory_text}'"
    msg_list.append(msg)
    
    return {
        **state,
        "health_advisory": health_plan,
        "messages": msg_list
    }

# 5. Policy Agent Node
async def policy_node(state: AgentState) -> AgentState:
    logger.info("Executing Policy Agent Node...")
    source = state["primary_source"]
    
    # Long term structural policy decisions
    if source == "Crop residue burning":
        policy_actions = (
            "1. Allocate budget to subsidize sub-surface agricultural seeders and happy-seeders. "
            "2. Establish regional straw collection and bio-pellet conversion units. "
            "3. Audit crop-burning patterns over upwind coordinates using MODIS records."
        )
    elif source == "Traffic":
        policy_actions = (
            "1. Define ultra-low emission zones (ULEZ) restricting commercial heavy vehicles. "
            "2. Deploy electric bus fleets on primary high-congestion corridors. "
            "3. Enforce smart traffic signal timing adjustments to reduce idling."
        )
    elif source == "Industrial emissions":
        policy_actions = (
            "1. Implement strict continuous stack emissions monitoring (CEMS) systems. "
            "2. Issue mandatory audits to transitions from coal to natural gas/biomass. "
            "3. Enforce heavy penalties for plant operation during red-alert AQI spikes."
        )
    else:
        policy_actions = (
            "1. Launch public awareness campaigns for local waste-sorting compliance. "
            "2. Increase municipal waste collection frequencies to eliminate open waste burning."
        )
        
    policy_plan = {
        "policy_actions": policy_actions,
        "estimated_horizon": "6 - 12 Months",
        "impact_metric": "Projected 15% reduction in yearly base PM2.5 levels."
    }
    
    msg_list = list(state["messages"])
    msg = f"[Policy Agent] Formulated long-term policy recommendation: '{policy_actions}'"
    msg_list.append(msg)
    
    return {
        **state,
        "policy_plan": policy_plan,
        "messages": msg_list
    }

# 3. Build state graph
workflow = StateGraph(AgentState)

# Add nodes
workflow.add_node("forecast_agent", forecast_node)
workflow.add_node("attribution_agent", attribution_node)
workflow.add_node("enforcement_agent", enforcement_node)
workflow.add_node("health_agent", health_node)
workflow.add_node("policy_agent", policy_node)

# Add conditional routing edge
def check_for_spike(state: AgentState):
    if state["spike_detected"]:
        return "attribution_agent"
    return END

workflow.add_conditional_edges(
    "forecast_agent",
    check_for_spike,
    {
        "attribution_agent": "attribution_agent",
        END: END
    }
)

# Connect remaining nodes sequentially
workflow.add_edge("attribution_agent", "enforcement_agent")
workflow.add_edge("enforcement_agent", "health_agent")
workflow.add_edge("health_agent", "policy_agent")
workflow.add_edge("policy_agent", END)

# Set entry point
workflow.set_entry_point("forecast_agent")

# Compile graph
agent_graph = workflow.compile()
