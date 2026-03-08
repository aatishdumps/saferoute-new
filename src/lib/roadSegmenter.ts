import { Road } from "@/data/roads";
import { haversineDistance } from "./haversine";

export interface Segment {
  start: [number, number];
  end: [number, number];
  roadType: string;
  distance: number;
}

export function segmentRoads(roads: Road[]): Segment[] {
  const segments: Segment[] = [];
  for (const road of roads) {
    for (let i = 0; i < road.geometry.length - 1; i++) {
      const a = road.geometry[i];
      const b = road.geometry[i + 1];
      segments.push({
        start: [a.lat, a.lon],
        end: [b.lat, b.lon],
        roadType: road.highway,
        distance: haversineDistance(a.lat, a.lon, b.lat, b.lon),
      });
    }
  }
  return segments;
}
