export type UserRole = "admin" | "analyst" | "citizen" | "enforcement";

export interface UserCreate {
  email: string;
  password?: string;
  role?: UserRole;
}

export interface UserResponse {
  id: number;
  email: string;
  role: UserRole;
  is_active: boolean;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface TokenData {
  email?: string;
  role?: UserRole;
}

export interface ForecastRequest {
  lat: number;
  lon: number;
  hours?: number;
}

export interface ForecastResponse {
  timestamp: string; // ISO datetime string
  pm25: number;
  pm10: number;
  no2: number;
  so2: number;
  aqi: number;
}

export interface SourceAttributionResponse {
  source_type: string;
  contribution_pct: number;
  confidence_score: number;
  evidence_log: string;
  evidence_lat: number;
  evidence_lon: number;
}

export interface AgentQuery {
  query: string;
  lat?: number;
  lon?: number;
}

export interface AgentResponse {
  response: string;
}

export interface HotspotDetail {
  source_type: string;
  contribution_pct: number;
  hotspot_lat: number;
  hotspot_lon: number;
}

export interface EnforcementResponse {
  primary_hotspot: HotspotDetail;
  inspection_target: string;
  governing_regulation: string;
  recommended_actions: string;
  estimated_impact: string;
  geospatial_evidence: string;
  timestamp: string;
}

export interface AgentWorkflowResponse {
  lat: number;
  lon: number;
  spike_detected: boolean;
  messages: string[];
  forecast?: Array<{
    timestamp: string;
    pm25: number;
    pm10: number;
    no2: number;
    so2: number;
    aqi: number;
    [key: string]: any;
  }>;
  attribution?: Array<{
    source_type: string;
    contribution_pct: number;
    confidence_score: number;
    evidence_log: string;
    evidence_lat: number;
    evidence_lon: number;
    [key: string]: any;
  }>;
  enforcement_plan?: {
    primary_hotspot?: {
      source_type: string;
      contribution_pct: number;
      hotspot_lat: number;
      hotspot_lon: number;
    };
    inspection_target?: string;
    governing_regulation?: string;
    recommended_actions?: string;
    estimated_impact?: string;
    geospatial_evidence?: string;
    timestamp?: string;
    [key: string]: any;
  };
  health_advisory?: {
    risk_score?: number;
    population_exposure?: number;
    advisory?: string;
    advisories?: {
      en: string;
      hi: string;
      mr: string;
      kn: string;
      ta: string;
    };
    target_demographics?: string;
    [key: string]: any;
  };
  policy_plan?: {
    policy_actions?: string;
    estimated_horizon?: string;
    impact_metric?: string;
    [key: string]: any;
  };
}
