import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import L from "leaflet";
import { roads } from "@/data/roads";
import { policeStations } from "@/data/policeStations";
import { segmentRoads } from "@/lib/roadSegmenter";
import { buildGraph } from "@/lib/graphBuilder";
import { findFastestRoute, findSafestRoute } from "@/lib/routing";
import { findNearestPoliceStation } from "@/lib/policeDistance";
import { Shield, Zap, Navigation, MapPin, Crosshair, Trash2, LocateFixed, ArrowUpDown, Play, Square } from "lucide-react";
import SOSDialog from "./SOSDialog";
import { toast } from "sonner";

const VADODARA_CENTER: [number, number] = [22.3072, 73.1812];

const policeIcon = L.divIcon({
  className: "",
  html: `<div style="width:28px;height:28px;background:hsl(38,90%,55%);border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid hsl(220,20%,7%);box-shadow:0 0 10px rgba(234,179,8,0.5)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="hsl(220,20%,7%)" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const pointIcon = (color: string) =>
  L.divIcon({
    className: "",
    html: `<div style="width:20px;height:20px;background:${color};border-radius:50%;border:3px solid hsl(220,20%,7%);box-shadow:0 0 12px ${color}80"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

export default function MapView() {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const [startPoint, setStartPoint] = useState<[number, number] | null>(null);
  const [endPoint, setEndPoint] = useState<[number, number] | null>(null);
  const [selectingPoint, setSelectingPoint] = useState<"start" | "end" | null>(null);
  const [fastestPath, setFastestPath] = useState<[number, number][]>([]);
  const [safestPath, setSafestPath] = useState<[number, number][]>([]);
  const [routeInfo, setRouteInfo] = useState<{ fastest?: number; safest?: number }>({});
  const [isCalculating, setIsCalculating] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [liveLocation, setLiveLocation] = useState<[number, number] | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const routeLinesRef = useRef<L.Polyline[]>([]);
  const markersRef = useRef<L.Marker[]>([]);

  const graph = useMemo(() => {
    const segs = segmentRoads(roads);
    return buildGraph(segs);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: VADODARA_CENTER,
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Draw roads
    for (const road of roads) {
      const coords = road.geometry.map((g) => [g.lat, g.lon] as [number, number]);
      const opacity = road.highway === "primary" ? 0.5 : road.highway === "secondary" ? 0.35 : 0.2;
      const weight = road.highway === "primary" ? 3 : road.highway === "secondary" ? 2 : 1;
      L.polyline(coords, {
        color: "hsl(215, 60%, 50%)",
        weight,
        opacity,
      }).addTo(map);
    }

    // Police station markers
    for (const ps of policeStations) {
      L.marker([ps.coordinates.lat, ps.coordinates.lng], { icon: policeIcon })
        .bindPopup(`<div style="font-family:monospace;color:#111"><strong>${ps.title}</strong></div>`)
        .addTo(map);
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Map click handler
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handler = (e: L.LeafletMouseEvent) => {
      if (!selectingPoint) return;
      const point: [number, number] = [e.latlng.lat, e.latlng.lng];
      if (selectingPoint === "start") setStartPoint(point);
      else setEndPoint(point);
      setSelectingPoint(null);
    };

    map.on("click", handler);
    return () => { map.off("click", handler); };
  }, [selectingPoint]);

  // Draw route markers and lines
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old
    routeLinesRef.current.forEach((l) => l.remove());
    markersRef.current.forEach((m) => m.remove());
    routeLinesRef.current = [];
    markersRef.current = [];

    if (startPoint) {
      const m = L.marker(startPoint, { icon: pointIcon("hsl(152,60%,45%)") }).addTo(map);
      m.bindPopup('<span style="font-family:monospace;color:#111">Start</span>');
      markersRef.current.push(m);
    }
    if (endPoint) {
      const m = L.marker(endPoint, { icon: pointIcon("hsl(0,72%,51%)") }).addTo(map);
      m.bindPopup('<span style="font-family:monospace;color:#111">Destination</span>');
      markersRef.current.push(m);
    }

    if (fastestPath.length > 0) {
      const line = L.polyline(fastestPath, { color: "hsl(215,60%,50%)", weight: 5, opacity: 0.9 }).addTo(map);
      routeLinesRef.current.push(line);
    }
    if (safestPath.length > 0) {
      const line = L.polyline(safestPath, { color: "hsl(152,60%,45%)", weight: 5, opacity: 0.9, dashArray: "10 6" }).addTo(map);
      routeLinesRef.current.push(line);
    }
  }, [startPoint, endPoint, fastestPath, safestPath]);

  const calculateFastest = () => {
    if (!startPoint || !endPoint) return;
    setIsCalculating(true);
    setTimeout(() => {
      const fast = findFastestRoute(graph, startPoint[0], startPoint[1], endPoint[0], endPoint[1]);
      setFastestPath(fast.path);
      setSafestPath([]);
      setRouteInfo({ fastest: fast.actualDistance });
      setIsCalculating(false);
    }, 100);
  };

  const calculateSafest = () => {
    if (!startPoint || !endPoint) return;
    setIsCalculating(true);
    setTimeout(() => {
      const safe = findSafestRoute(graph, startPoint[0], startPoint[1], endPoint[0], endPoint[1]);
      setFastestPath([]);
      setSafestPath(safe.path);
      setRouteInfo({ safest: safe.actualDistance });
      setIsCalculating(false);
    }, 100);
  };

  const goToNearestPolice = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        const nearest = findNearestPoliceStation(userLat, userLng);
        setStartPoint([userLat, userLng]);
        setEndPoint([nearest.coordinates.lat, nearest.coordinates.lng]);
        setTimeout(() => {
          const safe = findSafestRoute(graph, userLat, userLng, nearest.coordinates.lat, nearest.coordinates.lng);
          setSafestPath(safe.path);
          setFastestPath([]);
          setRouteInfo({ safest: safe.actualDistance });
        }, 50);
      },
      () => {
        // Fallback: use center of Vadodara
        const nearest = findNearestPoliceStation(VADODARA_CENTER[0], VADODARA_CENTER[1]);
        setStartPoint(VADODARA_CENTER);
        setEndPoint([nearest.coordinates.lat, nearest.coordinates.lng]);
        setTimeout(() => {
          const safe = findSafestRoute(graph, VADODARA_CENTER[0], VADODARA_CENTER[1], nearest.coordinates.lat, nearest.coordinates.lng);
          setSafestPath(safe.path);
          setFastestPath([]);
          setRouteInfo({ safest: safe.actualDistance });
        }, 50);
      }
    );
  };

  const clearAll = () => {
    setStartPoint(null);
    setEndPoint(null);
    setFastestPath([]);
    setSafestPath([]);
    setRouteInfo({});
    setSelectingPoint(null);
    stopNavigation();
  };

  const startNavigation = () => {
    if (!fastestPath.length && !safestPath.length) return;
    setIsNavigating(true);
    if (navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => setLiveLocation([pos.coords.latitude, pos.coords.longitude]),
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    }
  };

  const stopNavigation = () => {
    setIsNavigating(false);
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setLiveLocation(null);
  };

  const handleSOSSent = useCallback((station: { title: string; lat: number; lng: number }) => {
    toast.error(`🚨 SOS sent to ${station.title}!`, {
      description: "Emergency alert dispatched. Stay safe.",
      duration: 10000,
    });
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      {/* Map */}
      <div ref={mapContainerRef} className="absolute inset-0 z-0" />

      {/* Control Panel */}
      <div className="absolute bottom-4 left-4 z-[1000] w-80 space-y-2">
        {/* Point Selection */}
        <div className="glass-panel rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              Route Points
            </div>
            <button
              onClick={() => {
                setStartPoint(endPoint);
                setEndPoint(startPoint);
                setFastestPath([]);
                setSafestPath([]);
                setRouteInfo({});
              }}
              disabled={!startPoint && !endPoint}
              className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Swap start and end"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              SWAP
            </button>
          </div>

          <div className="flex gap-1.5">
            <button
              onClick={() => setSelectingPoint("start")}
              className={`flex-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-mono transition-all
                ${selectingPoint === "start"
                  ? "bg-primary/20 border border-primary text-primary"
                  : "bg-muted/50 border border-border text-foreground hover:bg-muted"
                }`}
            >
              <MapPin className="w-4 h-4 text-primary shrink-0" />
              <span className="truncate">
                {startPoint
                  ? `${startPoint[0].toFixed(4)}, ${startPoint[1].toFixed(4)}`
                  : "Click map to set start"}
              </span>
            </button>
            <button
              onClick={() => {
                navigator.geolocation?.getCurrentPosition(
                  (pos) => setStartPoint([pos.coords.latitude, pos.coords.longitude]),
                  () => setStartPoint(VADODARA_CENTER)
                );
              }}
              className="shrink-0 flex items-center justify-center w-9 rounded-md bg-muted/50 border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              title="Use current location"
            >
              <LocateFixed className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setSelectingPoint("end")}
            className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm font-mono transition-all
              ${selectingPoint === "end"
                ? "bg-destructive/20 border border-destructive text-destructive"
                : "bg-muted/50 border border-border text-foreground hover:bg-muted"
              }`}
          >
            <Crosshair className="w-4 h-4 text-destructive" />
            {endPoint
              ? `${endPoint[0].toFixed(4)}, ${endPoint[1].toFixed(4)}`
              : "Click map to set end"}
          </button>
        </div>

        {/* Actions */}
        <div className="glass-panel rounded-lg p-3 space-y-2">
          <div className="flex gap-2">
            <button
            onClick={calculateFastest}
              disabled={!startPoint || !endPoint || isCalculating}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-mono font-bold
                bg-secondary text-secondary-foreground hover:brightness-110
                disabled:opacity-40 disabled:cursor-not-allowed transition-all glow-blue"
            >
              <Zap className="w-3.5 h-3.5" />
              FASTEST
            </button>
            <button
            onClick={calculateSafest}
              disabled={!startPoint || !endPoint || isCalculating}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-mono font-bold
                bg-primary text-primary-foreground hover:brightness-110
                disabled:opacity-40 disabled:cursor-not-allowed transition-all glow-green"
            >
              <Shield className="w-3.5 h-3.5" />
              SAFEST
            </button>
          </div>

          {/* Start/Stop Navigation */}
          {(fastestPath.length > 0 || safestPath.length > 0) && (
            <button
              onClick={isNavigating ? stopNavigation : startNavigation}
              className={`w-full flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-mono font-bold transition-all
                ${isNavigating
                  ? "bg-destructive text-destructive-foreground hover:brightness-110"
                  : "bg-primary text-primary-foreground hover:brightness-110 glow-green"
                }`}
            >
              {isNavigating ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isNavigating ? "STOP NAVIGATION" : "START NAVIGATION"}
            </button>
          )}

          <button
            onClick={goToNearestPolice}
            className="w-full flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-mono font-bold
              bg-accent text-accent-foreground hover:brightness-110 transition-all"
          >
            <Navigation className="w-3.5 h-3.5" />
            GO TO NEAREST POLICE STATION
          </button>

          <button
            onClick={clearAll}
            className="w-full flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-mono
              bg-muted/50 text-muted-foreground hover:bg-muted transition-all border border-border"
          >
            <Trash2 className="w-3.5 h-3.5" />
            CLEAR
          </button>
        </div>

        {/* Route Info */}
        {(routeInfo.fastest !== undefined || routeInfo.safest !== undefined) && (
          <div className="glass-panel rounded-lg p-3 space-y-1.5">
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              Route Info
            </div>
            {routeInfo.fastest !== undefined && (
              <div className="flex items-center gap-2 text-sm font-mono">
                <div className="w-3 h-0.5 bg-secondary rounded" />
                <span className="text-secondary">Fastest:</span>
                <span className="text-foreground">{routeInfo.fastest.toFixed(2)} km</span>
              </div>
            )}
            {routeInfo.safest !== undefined && (
              <div className="flex items-center gap-2 text-sm font-mono">
                <div className="w-3 h-0.5 bg-primary rounded" style={{ borderStyle: "dashed" }} />
                <span className="text-primary">Safest:</span>
                <span className="text-foreground">{routeInfo.safest.toFixed(2)} km</span>
              </div>
            )}
            {fastestPath.length === 0 && safestPath.length === 0 && (
              <div className="text-xs font-mono text-destructive">No route found — try closer points</div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="glass-panel rounded-lg p-3 space-y-1">
          <div className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1">Legend</div>
          <div className="flex items-center gap-2 text-xs font-mono text-foreground">
            <div className="w-3 h-3 rounded-full bg-accent border border-background" /> Police Station
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-foreground">
            <div className="w-6 h-0.5 bg-secondary rounded" /> Fastest Route
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-foreground">
            <div className="w-6 h-0.5 bg-primary rounded" style={{ borderTop: "2px dashed hsl(152,60%,45%)" }} /> Safest Route
          </div>
        </div>
      </div>

      {/* Selecting indicator */}
      {selectingPoint && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1000] glass-panel rounded-full px-4 py-2 text-xs font-mono text-primary animate-pulse">
          Click on map to set {selectingPoint} point
        </div>
      )}

      {/* SOS Dialog */}
      <SOSDialog
        isNavigating={isNavigating}
        userLocation={liveLocation}
        onSOSSent={handleSOSSent}
      />

      {/* Navigation active indicator */}
      {isNavigating && (
        <div className="absolute top-16 right-4 z-[1000] glass-panel rounded-full px-4 py-2 text-xs font-mono text-primary flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          NAVIGATING — SOS active
        </div>
      )}
    </div>
  );
}
