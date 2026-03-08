import { Segment } from "./roadSegmenter";
import { totalRisk } from "./safetyScore";

export interface Edge {
  to: string;
  fastWeight: number;
  safeWeight: number;
  distance: number;
}

export type Graph = Map<string, Edge[]>;

function coordKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

export function buildGraph(segments: Segment[]): Graph {
  const graph: Graph = new Map();

  const addEdge = (from: string, to: string, dist: number, fastW: number, safeW: number) => {
    if (!graph.has(from)) graph.set(from, []);
    graph.get(from)!.push({ to, fastWeight: fastW, safeWeight: safeW, distance: dist });
  };

  for (const seg of segments) {
    const fromKey = coordKey(seg.start[0], seg.start[1]);
    const toKey = coordKey(seg.end[0], seg.end[1]);

    const midLat = (seg.start[0] + seg.end[0]) / 2;
    const midLng = (seg.start[1] + seg.end[1]) / 2;
    const risk = totalRisk(midLat, midLng, seg.roadType);

    const fastW = seg.distance;
    const safeW = seg.distance + risk * 0.2; // risk * 200m equivalent

    addEdge(fromKey, toKey, seg.distance, fastW, safeW);
    addEdge(toKey, fromKey, seg.distance, fastW, safeW);
  }

  return graph;
}

export function getNodeCoords(key: string): [number, number] {
  const [lat, lng] = key.split(",").map(Number);
  return [lat, lng];
}

export function findNearestNode(graph: Graph, lat: number, lng: number): string {
  let minDist = Infinity;
  let nearest = "";
  for (const key of graph.keys()) {
    const [nLat, nLng] = getNodeCoords(key);
    const d = Math.hypot(nLat - lat, nLng - lng);
    if (d < minDist) { minDist = d; nearest = key; }
  }
  return nearest;
}
