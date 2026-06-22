import { create } from "zustand";
import { CITIES, type City } from "@/lib/aira-data";

type Role = "City Administrator" | "Pollution Control Officer" | "Enforcement Officer" | "Urban Planner" | "Public Health Officer";
type TimeRange = "1h" | "24h" | "7d" | "30d";

type AppState = {
  city: City;
  role: Role;
  timeRange: TimeRange;
  setCity: (c: City) => void;
  setRole: (r: Role) => void;
  setTimeRange: (t: TimeRange) => void;
};

export const useAppStore = create<AppState>((set) => ({
  city: CITIES[0],
  role: "City Administrator",
  timeRange: "24h",
  setCity: (city) => set({ city }),
  setRole: (role) => set({ role }),
  setTimeRange: (timeRange) => set({ timeRange }),
}));
