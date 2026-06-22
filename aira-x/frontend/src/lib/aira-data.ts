// Mock data layer for AIRA-X. Swap with real API client when backend wired.

export type City = {
  id: string;
  name: string;
  state: string;
  center: [number, number]; // [lng, lat]
  population: number;
};

export const CITIES: City[] = [
  { id: "delhi", name: "Delhi", state: "Delhi NCR", center: [77.209, 28.6139], population: 32_000_000 },
  { id: "mumbai", name: "Mumbai", state: "Maharashtra", center: [72.8777, 19.076], population: 21_000_000 },
  { id: "pune", name: "Pune", state: "Maharashtra", center: [73.8567, 18.5204], population: 7_400_000 },
  { id: "bengaluru", name: "Bengaluru", state: "Karnataka", center: [77.5946, 12.9716], population: 13_600_000 },
  { id: "chennai", name: "Chennai", state: "Tamil Nadu", center: [80.2707, 13.0827], population: 11_500_000 },
  { id: "kolkata", name: "Kolkata", state: "West Bengal", center: [88.3639, 22.5726], population: 15_700_000 },
];

export function aqiCategory(aqi: number) {
  if (aqi <= 50) return { label: "Good", color: "var(--color-aqi-good)", token: "aqi-good" as const };
  if (aqi <= 100) return { label: "Moderate", color: "var(--color-aqi-moderate)", token: "aqi-moderate" as const };
  if (aqi <= 150) return { label: "Unhealthy for Sensitive", color: "var(--color-aqi-sensitive)", token: "aqi-sensitive" as const };
  if (aqi <= 200) return { label: "Unhealthy", color: "var(--color-aqi-unhealthy)", token: "aqi-unhealthy" as const };
  if (aqi <= 300) return { label: "Very Unhealthy", color: "var(--color-aqi-very-unhealthy)", token: "aqi-very-unhealthy" as const };
  return { label: "Hazardous", color: "var(--color-aqi-hazardous)", token: "aqi-hazardous" as const };
}

// Deterministic seeded pseudo-random for stable mock data
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type GridCell = {
  id: string;
  lng: number;
  lat: number;
  aqi: number;
  pm25: number;
  pm10: number;
  no2: number;
  so2: number;
  o3: number;
};

export function generateGrid(city: City, size = 18): GridCell[] {
  const rand = mulberry32(city.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0));
  const cells: GridCell[] = [];
  const span = 0.18; // ~20km
  const base = city.id === "delhi" ? 240 : city.id === "mumbai" ? 165 : city.id === "kolkata" ? 195 : 130;
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const lng = city.center[0] - span / 2 + (i / size) * span;
      const lat = city.center[1] - span / 2 + (j / size) * span;
      const dx = (i - size / 2) / size;
      const dy = (j - size / 2) / size;
      const hotspot = Math.exp(-(dx * dx + dy * dy) * 8) * 80;
      const noise = (rand() - 0.5) * 60;
      const aqi = Math.max(20, Math.min(450, Math.round(base + hotspot + noise)));
      const pm25 = Math.round(aqi * 0.45);
      cells.push({
        id: `${city.id}-${i}-${j}`,
        lng,
        lat,
        aqi,
        pm25,
        pm10: Math.round(pm25 * 1.7),
        no2: Math.round(20 + rand() * 60),
        so2: Math.round(5 + rand() * 25),
        o3: Math.round(30 + rand() * 50),
      });
    }
  }
  return cells;
}

export function generateForecast(currentAqi: number, hours = 72) {
  const rand = mulberry32(Math.round(currentAqi));
  const out = [];
  let aqi = currentAqi;
  for (let h = 0; h <= hours; h++) {
    const diurnal = Math.sin(((h % 24) / 24) * Math.PI * 2 - Math.PI / 2) * 25;
    const drift = (rand() - 0.5) * 8;
    aqi = Math.max(30, Math.min(420, aqi + drift + diurnal * 0.06));
    const confidence = Math.max(0.5, 0.95 - h * 0.005);
    const band = (1 - confidence) * 80;
    out.push({
      hour: h,
      aqi: Math.round(aqi + diurnal * 0.5),
      lower: Math.round(aqi + diurnal * 0.5 - band),
      upper: Math.round(aqi + diurnal * 0.5 + band),
      confidence,
    });
  }
  return out;
}

export type SourceAttribution = {
  source: string;
  percent: number;
  confidence: number;
  trend: "up" | "down" | "flat";
};

export function sourceAttribution(cityId: string): SourceAttribution[] {
  const profiles: Record<string, SourceAttribution[]> = {
    delhi: [
      { source: "Vehicular Traffic", percent: 28, confidence: 0.91, trend: "up" },
      { source: "Crop Residue Burning", percent: 24, confidence: 0.87, trend: "up" },
      { source: "Industrial Emissions", percent: 18, confidence: 0.84, trend: "flat" },
      { source: "Construction Dust", percent: 14, confidence: 0.79, trend: "up" },
      { source: "Waste Burning", percent: 9, confidence: 0.72, trend: "flat" },
      { source: "Biomass / Cooking", percent: 7, confidence: 0.68, trend: "down" },
    ],
    mumbai: [
      { source: "Vehicular Traffic", percent: 34, confidence: 0.92, trend: "up" },
      { source: "Industrial Emissions", percent: 26, confidence: 0.88, trend: "flat" },
      { source: "Construction Dust", percent: 18, confidence: 0.81, trend: "up" },
      { source: "Port & Shipping", percent: 11, confidence: 0.76, trend: "flat" },
      { source: "Waste Burning", percent: 7, confidence: 0.7, trend: "down" },
      { source: "Biomass / Cooking", percent: 4, confidence: 0.65, trend: "down" },
    ],
  };
  return profiles[cityId] ?? profiles.delhi;
}

export const WARDS = [
  { id: "w-01", name: "Connaught Place", aqi: 312, population: 145000, risk: "high" },
  { id: "w-02", name: "Anand Vihar", aqi: 388, population: 220000, risk: "critical" },
  { id: "w-03", name: "Dwarka", aqi: 246, population: 310000, risk: "high" },
  { id: "w-04", name: "Rohini", aqi: 278, population: 280000, risk: "high" },
  { id: "w-05", name: "Lajpat Nagar", aqi: 198, population: 165000, risk: "moderate" },
  { id: "w-06", name: "Saket", aqi: 172, population: 140000, risk: "moderate" },
  { id: "w-07", name: "Vasant Kunj", aqi: 154, population: 95000, risk: "moderate" },
  { id: "w-08", name: "Greater Kailash", aqi: 165, population: 120000, risk: "moderate" },
];

export const ALERTS = [
  { id: "a1", severity: "critical", ward: "Anand Vihar", message: "PM2.5 exceeds 380 µg/m³ — issue health emergency", time: "2 min ago" },
  { id: "a2", severity: "high", ward: "Connaught Place", message: "Traffic-attributed NO₂ spike detected", time: "12 min ago" },
  { id: "a3", severity: "high", ward: "Rohini", message: "Construction site PM10 violation", time: "28 min ago" },
  { id: "a4", severity: "medium", ward: "Dwarka", message: "Forecast: AQI to exceed 300 within 6h", time: "41 min ago" },
];

export const RECOMMENDATIONS = [
  {
    id: "r1",
    title: "Halt construction in Anand Vihar cluster",
    impact: "−42 AQI in 6h",
    confidence: 0.89,
    priority: 1,
    action: "Issue stop-work to 14 sites under CPCB Rule 5.2",
  },
  {
    id: "r2",
    title: "Activate odd-even traffic protocol — Ring Road",
    impact: "−28 AQI in 12h",
    confidence: 0.81,
    priority: 2,
    action: "Coordinate with Delhi Traffic Police; deploy 240 personnel",
  },
  {
    id: "r3",
    title: "Inspect 8 high-emission industrial units — Wazirpur",
    impact: "−18 AQI in 24h",
    confidence: 0.76,
    priority: 3,
    action: "Dispatch CPCB enforcement teams; suspend non-compliant units",
  },
];
