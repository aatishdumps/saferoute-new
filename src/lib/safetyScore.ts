import { nearestPoliceDistance } from "./policeDistance";

const ROAD_RISK: Record<string, number> = {
  motorway: 1, trunk: 1, primary: 2, secondary: 3,
  tertiary: 4, residential: 6, unclassified: 6,
};

function policeRisk(distKm: number): number {
  if (distKm < 0.5) return 1;
  if (distKm < 1) return 2;
  if (distKm < 2) return 4;
  return 6;
}

export function totalRisk(lat: number, lng: number, roadType: string): number {
  const roadR = ROAD_RISK[roadType] ?? 6;
  const policeD = nearestPoliceDistance(lat, lng);
  return roadR + policeRisk(policeD);
}
