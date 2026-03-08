import { policeStations } from "@/data/policeStations";
import { haversineDistance } from "./haversine";

export function nearestPoliceDistance(lat: number, lng: number): number {
  let min = Infinity;
  for (const ps of policeStations) {
    const d = haversineDistance(lat, lng, ps.coordinates.lat, ps.coordinates.lng);
    if (d < min) min = d;
  }
  return min;
}

export function findNearestPoliceStation(lat: number, lng: number) {
  let min = Infinity;
  let nearest = policeStations[0];
  for (const ps of policeStations) {
    const d = haversineDistance(lat, lng, ps.coordinates.lat, ps.coordinates.lng);
    if (d < min) { min = d; nearest = ps; }
  }
  return nearest;
}
