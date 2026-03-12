# Vadodara Safe Navigation System

A safety–focused navigation web application for **Vadodara, Gujarat**, that computes both the **fastest** and **safest** routes between two points using real road network data and proximity to police stations.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Algorithms](#algorithms)
- [Data Sources](#data-sources)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
- [Getting Started](#getting-started)

---

## Features

| Feature | Description |
|---|---|
| **Dual Routing** | Fastest route (distance-optimized) and Safest route (safety-weighted) |
| **Safety Scoring** | Multi-factor risk model using police proximity + road type |
| **Location Search** | Geocoding-based search via OpenStreetMap Nominatim API |
| **Live Navigation** | Real-time GPS tracking with `watchPosition` |
| **SOS System** | Auto-triggers if no movement detected for 5 minutes during navigation; 30-second countdown to dismiss before alert fires |
| **Nearest Police Station** | One-tap routing to the closest police station from current location |
| **Interactive Map** | Leaflet-based map with police station markers, route overlays, and click-to-set points |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | React 18 + TypeScript |
| **Build Tool** | Vite |
| **Styling** | Tailwind CSS + shadcn/ui component library |
| **Mapping** | Leaflet.js (OpenStreetMap tiles) |
| **Geocoding** | OpenStreetMap Nominatim API (reverse/forward geocoding) |
| **Routing Engine** | Custom client-side Dijkstra's algorithm |
| **State Management** | React hooks (`useState`, `useRef`, `useMemo`, `useCallback`) |
| **Geolocation** | Browser Geolocation API (`getCurrentPosition`, `watchPosition`) |
| **Notifications** | Sonner (toast notifications) |
| **Testing** | Vitest |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   UI Layer                      │
│  MapView.tsx · LocationSearch.tsx · SOSDialog.tsx│
├─────────────────────────────────────────────────┤
│               Routing Engine                    │
│  routing.ts  ── Dijkstra (fastest / safest)     │
├─────────────────────────────────────────────────┤
│              Graph Builder                      │
│  graphBuilder.ts ── builds adjacency list from  │
│                     segmented road data         │
├─────────────────────────────────────────────────┤
│             Safety Scoring                      │
│  safetyScore.ts ── totalRisk = roadRisk +       │
│                    policeProximityRisk           │
├─────────────────────────────────────────────────┤
│               Data Layer                        │
│  roads.ts · policeStations.ts · haversine.ts    │
└─────────────────────────────────────────────────┘
```

---

## Algorithms

### 1. Dijkstra's Shortest Path Algorithm

Used for both fastest and safest route computation. The algorithm runs on a weighted undirected graph built from road segment data.

- **Time Complexity:** O((V + E) log V) — simplified with array-based priority queue
- **Space Complexity:** O(V + E)

Two weight functions are used:

| Mode | Weight Function | Description |
|---|---|---|
| **Fastest** | `fastWeight = segment.distance` | Pure Haversine distance (km) |
| **Safest** | `safeWeight = segment.distance + risk × 0.2` | Distance penalized by safety risk score |

### 2. Safety Risk Scoring Model

Each road segment is assigned a **composite risk score** based on two factors:

#### a) Road Type Risk

| Road Type | Risk Score | Rationale |
|---|---|---|
| Motorway / Trunk | 1 | High traffic, well-lit, monitored |
| Primary | 2 | Major roads with moderate safety |
| Secondary | 3 | Less traffic, moderate risk |
| Tertiary | 4 | Smaller roads, higher risk |
| Residential / Unclassified | 6 | Low traffic, poorly lit, highest risk |

#### b) Police Proximity Risk

| Distance to Nearest Station | Risk Score |
|---|---|
| < 0.5 km | 1 (safest) |
| 0.5 – 1 km | 2 |
| 1 – 2 km | 4 |
| > 2 km | 6 (most risky) |

**Total Risk = Road Type Risk + Police Proximity Risk** (range: 2–12)

The safest route weight adds `risk × 0.2` km equivalent penalty to each segment, causing Dijkstra to prefer segments near police stations and on major roads.

### 3. Haversine Formula

Used to compute great-circle distances between GPS coordinates:

```
a = sin²(Δlat/2) + cos(lat₁) · cos(lat₂) · sin²(Δlon/2)
distance = 2R · atan2(√a, √(1−a))
```

Where R = 6,371 km (Earth's radius).

### 4. Road Segmentation

Roads (polylines) are split into individual segments (consecutive coordinate pairs). Each segment becomes a graph edge with computed Haversine distance and safety weight.

### 5. Nearest Neighbor Search

Linear scan over all police stations to find the closest one to any given coordinate — used for:
- Safety score computation per road segment
- "Go to Nearest Police Station" feature
- SOS alert target identification

### 6. SOS Inactivity Detection

- Monitors GPS location changes during active navigation
- If no movement detected for **5 minutes**, triggers a **30-second countdown popup**
- If not dismissed, automatically sends an SOS alert to the nearest police station

---

## Data Sources

| Data | Details |
|---|---|
| **Roads** | Vadodara road network data with geometry coordinates, classified by highway type (primary, secondary, tertiary, residential) |
| **Police Stations** | 50+ real Vadodara police station locations with GPS coordinates |
| **Map Tiles** | OpenStreetMap raster tiles via Leaflet |
| **Geocoding** | Nominatim API (`nominatim.openstreetmap.org`) |

---

## Project Structure

```
src/
├── components/
│   ├── MapView.tsx           # Main map UI with controls and route display
│   ├── LocationSearch.tsx    # Geocoding search with dropdown (portal-based)
│   ├── SOSDialog.tsx         # Inactivity-based SOS system
│   └── NavLink.tsx           # Navigation link component
├── data/
│   ├── roads.ts              # Vadodara road network data
│   └── policeStations.ts     # Police station coordinates
├── lib/
│   ├── routing.ts            # Dijkstra's algorithm (fastest + safest)
│   ├── graphBuilder.ts       # Builds weighted adjacency list graph
│   ├── roadSegmenter.ts      # Splits roads into segments
│   ├── safetyScore.ts        # Composite risk scoring model
│   ├── policeDistance.ts      # Nearest police station utilities
│   ├── haversine.ts          # Great-circle distance formula
│   └── utils.ts              # General utilities
├── pages/
│   ├── Index.tsx              # Main page
│   └── NotFound.tsx           # 404 page
└── main.tsx                   # App entry point
```

---

## How It Works

1. **Graph Construction:** On load, all roads are segmented and built into a weighted adjacency list graph using `buildGraph()`.
2. **Point Selection:** User sets start/end points via map click, GPS location, or location search (Nominatim geocoding).
3. **Route Calculation:** Dijkstra's algorithm runs with either `fastWeight` (pure distance) or `safeWeight` (distance + safety penalty).
4. **Route Display:** Computed path is rendered as a Leaflet polyline overlay — solid blue for fastest, dashed green for safest.
5. **Navigation:** GPS `watchPosition` tracks user movement in real-time; SOS system monitors for inactivity.
6. **SOS Trigger:** If stationary for 5 minutes → 30-second dismissible countdown → auto-alert to nearest police station.

---

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

---

## License

This project is for educational and research purposes.
