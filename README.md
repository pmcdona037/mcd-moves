# Hiking Journal — Static GitHub Pages Site

A personal long-distance hiking journal built with pure HTML, CSS, and vanilla JavaScript.
No backend. No build tools. No dependencies beyond Leaflet (loaded from CDN).

---

## Folder Structure

```
/
├── index.html               ← Homepage (lists all trips)
├── css/
│   └── style.css            ← All styles
├── js/
│   ├── utils.js             ← Shared math helpers (distance, elevation, date)
│   ├── main.js              ← Homepage script (reads trips.json, renders cards)
│   └── trip.js              ← Trip page script (map, stats, day table)
├── data/
│   ├── trips.json           ← Master list of trips (homepage reads this)
│   ├── appalachian-trail/
│   │   ├── meta.json        ← Trip metadata (title, dates, day file list)
│   │   ├── day-1.geojson
│   │   ├── day-2.geojson
│   │   └── day-3.geojson
│   └── john-muir-trail/
│       ├── meta.json
│       ├── day-1.geojson
│       ├── day-2.geojson
│       └── day-3.geojson
└── trips/
    ├── appalachian-trail.html
    └── john-muir-trail.html
```

---

## Deploy to GitHub Pages

1. Push this entire folder to a GitHub repository.
2. Go to **Settings → Pages**.
3. Set source to **Deploy from a branch**, branch: `main`, folder: `/ (root)`.
4. Visit `https://<your-username>.github.io/<repo-name>/`.

---

## Adding a New Trip (Step-by-Step)

### 1. Create a data folder

```
data/
└── my-new-trip/
    ├── meta.json
    ├── day-1.geojson
    ├── day-2.geojson
    └── ...
```

### 2. Fill in `meta.json`

```json
{
  "title": "My New Trip",
  "description": "A short description shown below the title.",
  "start_date": "2025-06-01",
  "start_time": "07:00",
  "end_date":   "2025-06-10",
  "end_time":   "15:30",
  "days": [
    "day-1.geojson",
    "day-2.geojson",
    "day-3.geojson"
  ]
}
```

### 3. Create GeoJSON files for each day

Each file is a GeoJSON FeatureCollection with a single LineString feature.
Coordinates are `[longitude, latitude, elevation_meters]`.

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "day": 1,
        "name": "Day 1 description"
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-118.2923, 36.5785, 2100],
          [-118.2901, 36.5712, 2210],
          [-118.2876, 36.5648, 2380]
        ]
      }
    }
  ]
}
```

**Notes on coordinates:**
- Longitude comes BEFORE latitude (this is the GeoJSON standard).
- Elevation is in **metres** above sea level (3rd element; optional but needed for elevation gain calculation).
- The more points, the smoother and more accurate the route will appear.
- You can export a GPX from your GPS watch/Garmin/Strava, then convert it to GeoJSON using a free tool like [gpx.studio](https://gpx.studio) or [MyGeodata Converter](https://mygeodata.cloud/converter/).

**Optional: provide stats manually (overrides calculation):**

```json
"properties": {
  "day": 1,
  "distance_miles": 14.2,
  "elevation_gain_ft": 3800
}
```

If these properties are present, the app uses them directly instead of computing from coordinates.

### 4. Create a trip HTML page

Copy `trips/appalachian-trail.html` to `trips/my-new-trip.html`.

Change **only** this line:

```html
<script>
  window.TRIP_ID = 'my-new-trip';  ← change this to match your /data/ folder name
</script>
```

### 5. Add the trip to `trips.json`

Open `data/trips.json` and add a new entry:

```json
{
  "title": "My New Trip",
  "start_date": "2025-06-01",
  "end_date": "2025-06-10",
  "total_distance_miles": 87.4,
  "total_elevation_gain_ft": 18200,
  "days": 10,
  "page_url": "trips/my-new-trip.html"
}
```

The `total_distance_miles`, `total_elevation_gain_ft`, and `days` values are shown on the
homepage card only; they are entered manually here for quick display.
The trip page itself calculates these live from GeoJSON.

### 6. Push and done

Commit and push. No build step required.

---

## GeoJSON Tips

**Getting your GPS data into GeoJSON:**

- **Garmin / GPS watch**: Export as GPX → convert with [gpsbabel](https://www.gpsbabel.org/) or [gpx.studio](https://gpx.studio)
- **AllTrails**: Download GPX → convert to GeoJSON
- **Gaia GPS**: Export as GPX → convert
- **Komoot**: Export as GPX → convert
- **Online converter**: [mygeodata.cloud/converter](https://mygeodata.cloud/converter/) — accepts GPX, KML, and others

**Splitting by day:**
Split your route file at each campsite point. One GeoJSON file = one day.

---

## Customisation

| What                          | Where                          |
|-------------------------------|--------------------------------|
| Site title / tagline          | `index.html` — `.home-hero`    |
| Colour palette                | `css/style.css` — `:root`      |
| Map tile layer                | `js/trip.js` — `buildMap()`    |
| Day route colours             | `js/utils.js` — `DAY_COLORS_*` |
| Nav links                     | Any HTML file — `<nav>`        |

---

## Map Tile Layers (free, no API key)

The default is ESRI World Imagery (satellite). Alternatives:

```javascript
// OpenStreetMap (street)
'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

// OpenTopoMap (topographic)
'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'

// ESRI World Topo
'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'
```

Change the tile URL in `buildMap()` inside `js/trip.js`.

---

## Browser Compatibility

Works in all modern browsers. No polyfills needed.
Requires JavaScript enabled for map and dynamic content.
Static HTML/CSS works without JavaScript (except map and dynamically loaded stats).
