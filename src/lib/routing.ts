import { Graph, getNodeCoords, findNearestNode } from "./graphBuilder";

interface DijkstraResult {
  path: [number, number][];
  distance: number;
  actualDistance: number;
}

function dijkstra(
  graph: Graph,
  startKey: string,
  endKey: string,
  weightFn: "fastWeight" | "safeWeight"
): DijkstraResult {
  const dist = new Map<string, number>();
  const realDist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const visited = new Set<string>();

  // Simple priority queue using array
  const pq: { key: string; dist: number }[] = [];

  dist.set(startKey, 0);
  realDist.set(startKey, 0);
  pq.push({ key: startKey, dist: 0 });

  while (pq.length > 0) {
    pq.sort((a, b) => a.dist - b.dist);
    const current = pq.shift()!;

    if (visited.has(current.key)) continue;
    visited.add(current.key);

    if (current.key === endKey) break;

    const edges = graph.get(current.key) || [];
    for (const edge of edges) {
      if (visited.has(edge.to)) continue;
      const newDist = (dist.get(current.key) ?? Infinity) + edge[weightFn];
      if (newDist < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, newDist);
        realDist.set(edge.to, (realDist.get(current.key) ?? 0) + edge.distance);
        prev.set(edge.to, current.key);
        pq.push({ key: edge.to, dist: newDist });
      }
    }
  }

  // Reconstruct path
  const path: [number, number][] = [];
  let current: string | null | undefined = endKey;
  while (current) {
    path.unshift(getNodeCoords(current));
    current = prev.get(current);
  }

  return {
    path: path.length > 1 ? path : [],
    distance: dist.get(endKey) ?? Infinity,
    actualDistance: realDist.get(endKey) ?? Infinity,
  };
}

export function findFastestRoute(
  graph: Graph, startLat: number, startLng: number, endLat: number, endLng: number
): DijkstraResult {
  const startKey = findNearestNode(graph, startLat, startLng);
  const endKey = findNearestNode(graph, endLat, endLng);
  return dijkstra(graph, startKey, endKey, "fastWeight");
}

export function findSafestRoute(
  graph: Graph, startLat: number, startLng: number, endLat: number, endLng: number
): DijkstraResult {
  const startKey = findNearestNode(graph, startLat, startLng);
  const endKey = findNearestNode(graph, endLat, endLng);
  return dijkstra(graph, startKey, endKey, "safeWeight");
}
