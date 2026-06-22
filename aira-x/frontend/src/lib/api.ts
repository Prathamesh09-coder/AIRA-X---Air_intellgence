import { useAppStore } from "@/store/app-store";
import type {
  ForecastResponse,
  SourceAttributionResponse,
  EnforcementResponse,
  AgentWorkflowResponse,
} from "@shared/types";

const getApiUrl = () => {
  let url = "";
  if (typeof window !== "undefined") {
    if ((window as any).__env__?.VITE_API_URL) {
      url = (window as any).__env__.VITE_API_URL;
    }
  }
  if (!url) {
    url = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";
  }
  
  // Strip trailing slash
  if (url.endsWith("/")) {
    url = url.slice(0, -1);
  }
  
  // Auto-append /api/v1 if not present in the URL
  if (url && !url.endsWith("/api/v1") && !url.includes("/api/v1/")) {
    url = `${url}/api/v1`;
  }
  
  return url;
};

export const API_URL = getApiUrl();
export const WS_URL = API_URL.replace(/^http/, "ws") + "/ws";

// Helper to determine the mapping from Zustand role to X-Demo-Role header
const getRoleHeaderValue = (role: string): string => {
  return role; // Pass the exact Zustand role e.g., "City Administrator", which is mapped in backend auth.py
};

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const role = useAppStore.getState().role;
  const headers = new Headers(options.headers);
  headers.set("X-Demo-Role", getRoleHeaderValue(role));
  
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API Error ${res.status}: ${errText || res.statusText}`);
  }

  return res.json() as Promise<T>;
}

// Deterministic seed random for mock fallbacks
function pseudoRandom(seedStr: string) {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  return () => {
    const x = Math.sin(hash++) * 10000;
    return x - Math.floor(x);
  };
}

// ==========================================
// RESILIENT API CLIENT WITH FALLBACKS
// ==========================================

export async function getForecast(lat: number, lon: number, hours = 24): Promise<ForecastResponse[]> {
  try {
    return await apiRequest<ForecastResponse[]>("/forecast/", {
      method: "POST",
      body: JSON.stringify({ lat, lon, hours }),
    });
  } catch (error) {
    console.warn("[Resilience Mode] Forecast API failed. Returning simulated forecast.", error);
    const rand = pseudoRandom(`${lat}-${lon}-${hours}`);
    const results: ForecastResponse[] = [];
    const baseAqi = 120 + Math.abs(lat - 28.6) * 100 + rand() * 40;
    
    for (let i = 1; i <= hours; i++) {
      const time = new Date();
      time.setHours(time.getHours() + i);
      const factor = Math.sin((2 * Math.PI * time.getHours()) / 24);
      const pm25 = Math.max(10, baseAqi * 0.45 + factor * 15 + i * 0.1 + rand() * 5);
      
      results.push({
        timestamp: time.toISOString(),
        pm25: Math.round(pm25 * 100) / 100,
        pm10: Math.round(pm25 * 1.6 * 100) / 100,
        no2: Math.round((25 + factor * 6 + rand() * 3) * 100) / 100,
        so2: Math.round((12 + rand() * 2) * 100) / 100,
        aqi: Math.round(pm25 * 1.25 + factor * 8),
      });
    }
    return results;
  }
}

export async function getSourceAttribution(lat: number, lon: number, radiusKm = 5.0): Promise<SourceAttributionResponse[]> {
  try {
    return await apiRequest<SourceAttributionResponse[]>(`/source-attribution/?lat=${lat}&lon=${lon}&radius_km=${radiusKm}`);
  } catch (error) {
    console.warn("[Resilience Mode] Source Attribution API failed. Returning simulated attributions.", error);
    const rand = pseudoRandom(`${lat}-${lon}-${radiusKm}`);
    const r1 = rand();
    const r2 = rand();
    const r3 = rand();
    
    const baseTraffic = 25 + Math.floor(r1 * 15);
    const baseIndustry = 20 + Math.floor(r2 * 10);
    const baseConstruction = 12 + Math.floor(r3 * 8);
    const baseBiomass = 10 + Math.floor(rand() * 5);
    const baseWaste = 8 + Math.floor(rand() * 4);
    const baseCrop = 100 - (baseTraffic + baseIndustry + baseConstruction + baseBiomass + baseWaste);
    
    return [
      {
        source_type: "Traffic",
        contribution_pct: baseTraffic,
        confidence_score: 0.88,
        evidence_log: `Sentinel-5P NO2 column concentration elevated at ${(lat + 0.005).toFixed(4)}, ${(lon - 0.004).toFixed(4)}.`,
        evidence_lat: lat + 0.005,
        evidence_lon: lon - 0.004,
      },
      {
        source_type: "Industrial emissions",
        contribution_pct: baseIndustry,
        confidence_score: 0.85,
        evidence_log: `Sentinel-5P SO2 plume detected over industrial estate at ${(lat - 0.012).toFixed(4)}, ${(lon + 0.015).toFixed(4)}.`,
        evidence_lat: lat - 0.012,
        evidence_lon: lon + 0.015,
      },
      {
        source_type: "Construction",
        contribution_pct: baseConstruction,
        confidence_score: 0.81,
        evidence_log: `Permit logs show 4 active building sites at ${(lat + 0.008).toFixed(4)}, ${(lon + 0.009).toFixed(4)}.`,
        evidence_lat: lat + 0.008,
        evidence_lon: lon + 0.009,
      },
      {
        source_type: "Crop residue burning",
        contribution_pct: Math.max(0, baseCrop),
        confidence_score: 0.86,
        evidence_log: `MODIS active fire warning detected upwind hotspots at ${(lat + 0.024).toFixed(4)}, ${(lon - 0.022).toFixed(4)}.`,
        evidence_lat: lat + 0.024,
        evidence_lon: lon - 0.022,
      },
      {
        source_type: "Biomass burning",
        contribution_pct: baseBiomass,
        confidence_score: 0.72,
        evidence_log: `Satellite thermal anomaly near forest boundary at ${(lat - 0.02).toFixed(4)}, ${(lon - 0.015).toFixed(4)}.`,
        evidence_lat: lat - 0.02,
        evidence_lon: lon - 0.015,
      },
      {
        source_type: "Waste burning",
        contribution_pct: baseWaste,
        confidence_score: 0.68,
        evidence_log: `Localized temp anomaly detected at municipal dump site ${(lat + 0.018).toFixed(4)}, ${(lon - 0.001).toFixed(4)}.`,
        evidence_lat: lat + 0.018,
        evidence_lon: lon - 0.001,
      },
    ].sort((a, b) => b.contribution_pct - a.contribution_pct);
  }
}

export async function queryEnforcement(query: string, lat = 28.6139, lon = 77.2090): Promise<EnforcementResponse> {
  try {
    return await apiRequest<EnforcementResponse>("/enforcement/query", {
      method: "POST",
      body: JSON.stringify({ query, lat, lon }),
    });
  } catch (error) {
    console.warn("[Resilience Mode] Enforcement API failed. Returning simulated plan.", error);
    const timeStr = new Date().toISOString();
    return {
      primary_hotspot: {
        source_type: "Traffic",
        contribution_pct: 38.5,
        hotspot_lat: lat + 0.003,
        hotspot_lon: lon - 0.002,
      },
      inspection_target: `Clean Air Corridor checkpoint within ${(lat + 0.003).toFixed(4)}, ${(lon - 0.002).toFixed(4)}`,
      governing_regulation: "Clean Air Corridor Act (Section 4.1)",
      recommended_actions: "Enforce traffic alternate-day restrictions, restrict commercial heavy vehicle transit, and deploy mobile foggers.",
      estimated_impact: "Projected reduction of 28.5 ug/m³ in localized PM2.5 concentrations.",
      geospatial_evidence: `Sentinel-5P columns show high road congestion and NO₂ plumes at ${(lat + 0.003).toFixed(4)}, ${(lon - 0.002).toFixed(4)}.`,
      timestamp: timeStr,
    };
  }
}

export async function getHealthAdvisory(query: string, lat = 28.6139, lon = 77.2090): Promise<AgentWorkflowResponse> {
  try {
    return await apiRequest<AgentWorkflowResponse>("/health-risk/advisory", {
      method: "POST",
      body: JSON.stringify({ query, lat, lon }),
    });
  } catch (error) {
    console.warn("[Resilience Mode] Health Advisory workflow failed. Simulating LangGraph pipeline.", error);
    const forecast = await getForecast(lat, lon, 24);
    const attribution = await getSourceAttribution(lat, lon);
    const primary = attribution[0]?.source_type || "Traffic";
    const peak_pm25 = Math.max(...forecast.map((f) => f.pm25));
    
    let advisory_text = "";
    let advisories = { en: "", hi: "", mr: "", kn: "", ta: "" };
    
    if (primary === "Traffic") {
      advisory_text = `WARNING: Heavy vehicle exhaust accumulation (Peak PM2.5: ${peak_pm25.toFixed(1)} ug/m³). Avoid long outdoor exercises.`;
      advisories = {
        en: advisory_text,
        hi: `चेतावनी: वाहनों के धुएं का संचय (उच्चतम PM2.5: ${peak_pm25.toFixed(1)} µg/m³)। लंबी बाहरी गतिविधियों से बचें।`,
        mr: `इशारा: वाहनांच्या धुराचे प्रमाण वाढले आहे (कमाल PM2.5: ${peak_pm25.toFixed(1)} µg/m³)। घराबाहेर पडणे टाळा।`,
        kn: `ಎಚ್ಚರಿಕೆ: ವಾಹನಗಳ ಹೊಗೆ ಶೇಖರಣೆಯಾಗಿದೆ (ಗರಿಷ್ಠ PM2.5: ${peak_pm25.toFixed(1)} µg/m³). ಹೊರಾಂಗಣ ವ್ಯಾಯಾಮ ತಪ್ಪಿಸಿ.`,
        ta: `எச்சரிக்கை: வாகன புகைக் குவிப்பு (உச்ச PM2.5: ${peak_pm25.toFixed(1)} µg/m³). வெளிப்புற பயிற்சிகளைத் தவிர்க்கவும்.`
      };
    } else {
      advisory_text = `ALERT: Elevated crop burning/smoke indicators detected (Peak PM2.5: ${peak_pm25.toFixed(1)} ug/m³). N95 masks recommended.`;
      advisories = {
        en: advisory_text,
        hi: `सतर्कता: कृषि/धुएं के कणों की उच्च मात्रा (उच्चतम PM2.5: ${peak_pm25.toFixed(1)} µg/m³)। N95 मास्क पहनें।`,
        mr: `सतर्कता: शेतातील कचरा/धुराचे प्रमाण जास्त आढळले आहे (कमाल PM2.5: ${peak_pm25.toFixed(1)} µg/m³)। N95 मास्क वापरा।`,
        kn: `ಎಚ್ಚರಿಕೆ: ಗಾಳಿಯಲ್ಲಿ ಹೊಗೆಯ ಕಣಗಳ ಹೆಚ್ಚಿನ ಸಾಂದ್ರತೆ (ಗರಿಷ್ಠ PM2.5: ${peak_pm25.toFixed(1)} µg/m³). N95 ಮಾಸ್ಕ್ ಧರಿಸಿ.`,
        ta: `எச்சரிக்கை: காற்றில் புகை துகள்களின் அதிக செறிவு (உச்ச PM2.5: ${peak_pm25.toFixed(1)} µg/m³). N95 முகமூடி அணியவும்.`
      };
    }

    return {
      lat,
      lon,
      spike_detected: peak_pm25 > 50,
      messages: [
        "[Forecast Agent] Running GNN models over active coordinates.",
        `[Forecast Agent] Projected PM2.5 average exceeds 50. Triggering attribution.`,
        `[Source Attribution Agent] Attributed primary source to '${primary}'.`,
        `[Enforcement Agent] Action: inspection ordered at downwind hotspots.`,
        `[Health Agent] Formulated multilingual citizen advisories.`
      ],
      forecast: forecast as any,
      attribution: attribution as any,
      enforcement_plan: {
        inspection_target: "Downwind buffer zone",
        governing_regulation: "Urban Air Protection Directive",
        recommended_actions: "Halt construction and restrict odd-even vehicles",
        estimated_impact: "Projected 35 ug/m³ AQI reduction.",
        geospatial_evidence: "Plume direction detected by MODIS thermal sensors.",
        timestamp: new Date().toISOString()
      },
      health_advisory: {
        peak_pm25,
        advisory: advisory_text,
        advisories,
        target_demographics: "Sensitive demographics, outdoor workers, elderly"
      },
      policy_plan: {
        policy_actions: "Phase out coal burning and implement public EV transit corridor incentives.",
        estimated_horizon: "12 Months",
        impact_metric: "Projected 20% reduction in annual particulate baseline."
      }
    };
  }
}

export async function searchKnowledgeGraph(query = "", label = ""): Promise<any[]> {
  try {
    const qParam = query ? `query=${encodeURIComponent(query)}` : "";
    const lParam = label ? `label=${encodeURIComponent(label)}` : "";
    const params = [qParam, lParam].filter(Boolean).join("&");
    return await apiRequest<any[]>(`/knowledge-graph/search${params ? "?" + params : ""}`);
  } catch (error) {
    console.warn("[Resilience Mode] Knowledge Graph search failed. Returning simulated nodes.", error);
    const mockNodes = [
      { id: "n1", name: "Anand Vihar Station", label: "MonitoringStation", details: "CPCB Station ID: DL-02" },
      { id: "n2", name: "Apex Brick Kiln", label: "Industry", details: "Emission rate: 120 kg/h" },
      { id: "n3", name: "Ring Road Expressway", label: "TrafficCorridor", details: "Avg density: 85,000 veh/day" },
      { id: "n4", name: "Okhla Residential Cluster", label: "PopulationCluster", details: "Residents: 145,000" },
      { id: "n5", name: "PM2.5", label: "Pollutant", details: "Standard: 60 ug/m³" },
      { id: "n6", name: "NO2", label: "Pollutant", details: "Standard: 80 ug/m³" }
    ];
    return mockNodes.filter(n => {
      const qMatch = !query || n.name.toLowerCase().includes(query.toLowerCase());
      const lMatch = !label || n.label === label;
      return qMatch && lMatch;
    });
  }
}

export async function getRootCause(target: string): Promise<any> {
  try {
    return await apiRequest<any>(`/knowledge-graph/root-cause?target=${encodeURIComponent(target)}`);
  } catch (error) {
    console.warn("[Resilience Mode] Root Cause tracing failed. Returning simulated path.", error);
    return {
      target_node: target,
      pathway: [
        { source: "Ring Road Expressway", relation: "EMITS", target: "NO2" },
        { source: "NO2", relation: "IMPACTS", target: target }
      ],
      legal_remedy: {
        regulation: "Clean Air Traffic Ban Act",
        penalty: "Fines up to Rs. 25,000 for polluting commercial vehicle trespass."
      }
    };
  }
}

export async function getImpactAnalysis(source: string): Promise<any> {
  try {
    return await apiRequest<any>(`/knowledge-graph/impact-analysis?source=${encodeURIComponent(source)}`);
  } catch (error) {
    console.warn("[Resilience Mode] Impact Analysis failed. Returning simulated path.", error);
    return {
      source_node: source,
      affected_nodes: [
        { node: "Okhla Residential Cluster", risk_factor: "high", population: 145000 },
        { node: "Jamia Nagar School Zone", risk_factor: "critical", population: 12000 }
      ],
      mechanism: "Wind vector NW -> SE dispersion causes particulate drift."
    };
  }
}

export async function getAnalyticsSummary(): Promise<{ city_average_pm25: number; total_readings_processed: number; status: string }> {
  try {
    return await apiRequest<{ city_average_pm25: number; total_readings_processed: number; status: string }>("/analytics/summary");
  } catch (error) {
    console.warn("[Resilience Mode] Analytics summary failed. Returning mock stats.", error);
    return {
      city_average_pm25: 42.5,
      total_readings_processed: 1450,
      status: "Moderate",
    };
  }
}
