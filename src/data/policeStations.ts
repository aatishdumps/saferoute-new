import rawStations from "./police_stations_vadodara.json";

export interface PoliceStation {
  title: string;
  coordinates: { lat: number; lng: number };
}

export const policeStations: PoliceStation[] = rawStations.map((s: any) => ({
  title: s.title,
  coordinates: {
    lat: s.coordinates.lat,
    lng: s.coordinates.lng
  }
}));
