import geojson from "./Vadodara_Roads.json";

export interface Road {
  highway: string;
  geometry: { lat: number; lon: number }[];
}
function convertGeoJSON(data: any): Road[] {
  return data.features.map((f: any) => ({
    highway: f.properties.highway,
    geometry: f.geometry.coordinates.map(
      ([lon, lat]: [number, number]) => ({ lat, lon })
    )
  }));
}
const osmRoads = convertGeoJSON(geojson);

export const roads: Road[] = [
  ...osmRoads,
];
