# McD Moves — Trip Recap Site

A personal long-distance backpacking journal built with pure HTML, CSS, and vanilla JavaScript.
No backend. No build tools. No frameworks. No API keys. Runs entirely on GitHub Pages.

---

## Folder Structure

```
/
├── index.html                        ← Homepage (lists all trips dynamically)
├── css/
│   └── style.css                     ← All styles for every page
├── js/
│   ├── utils.js                      ← Shared math: distance, elevation, dates
│   ├── main.js                       ← Homepage: fetches meta + GeoJSON, renders cards
│   ├── trip.js                       ← Trip page: map, stats, day table
│   └── gear.js                       ← Trip page: loads and renders gear list
├── data/
│   ├── trips.json                    ← Master list of trips (homepage reads this)
│   └── {trip-folder}/
│       ├── meta.json                 ← Trip metadata: title, dates, day file list
│       ├── gear.json                 ← Gear list (optional — section hidden if absent)
│       ├── day-1.geojson
│       ├── day-2.geojson
│       └── ...
├── trips/
│   └── {trip-name}.html             ← One HTML file per trip
└── photos/
    └── {trip-folder}/               ← Photos for journal section
        └── your-photo.jpg
```

---

## Adding a New Trip — Step by Step

### Step 1 — Create the data folder

Create a new folder inside `/data/` using a short, lowercase, hyphenated name.
This name is your **trip ID** and must be used consistently across all files.

```
data/
└── my-new-trip/
    ├── meta.json
    ├── day-1.geojson
    ├── day-2.geojson
    └── ...
```

---

### Step 2 — Create `meta.json`

```json
{
  "title": "Trip Name",
  "description": "One sentence shown below the title on the trip page.",
  "start_date": "2025-06-01",
  "start_time": "07:00",
  "end_date": "2025-06-10",
  "end_time": "15:30",
  "days": [
    "day-1.geojson",
    "day-2.geojson",
    "day-3.geojson"
  ]
}
```

- `start_time` / `end_time` are in 24-hour format (`HH:MM`) and used to compute Duration
- The `days` array must list filenames that exactly match your GeoJSON files (case-sensitive)

---

### Step 3 — Add GeoJSON files for each day

Each file represents one day's route. Coordinates are `[longitude, latitude, elevation_meters]`.

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "day": 1,
        "name": "Optional day description"
      },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-72.1234, 43.5678, 450],
          [-72.1198, 43.5701, 512],
          [-72.1162, 43.5731, 598]
        ]
      }
    }
  ]
}
```

**Important coordinate notes:**
- Longitude comes **before** latitude (GeoJSON standard — opposite of Google Maps)
- Elevation is in **metres**, not feet
- More points = smoother, more accurate route on the map
- Distance and elevation gain are **computed automatically** from coordinates

**Optional — provide stats manually to override calculation:**
```json
"properties": {
  "day": 1,
  "distance_miles": 14.2,
  "elevation_gain_ft": 3800
}
```

**Getting GPS data into GeoJSON:**
1. Export your route from Caltopo as **GPX** with "Add SRTM elevation to track points" checked
2. Convert GPX to GeoJSON at [gpx.studio](https://gpx.studio) or [mygeodata.cloud/converter](https://mygeodata.cloud/converter/)
3. Split into one file per day at each campsite

---

### Step 4 — Create the trip HTML page

Copy any existing file from `/trips/` to `/trips/my-new-trip.html`.

Change **only** this one line near the bottom of the file:

```html
<script>
  window.TRIP_ID = 'my-new-trip';   ← must match your /data/ folder name exactly
</script>
```

Everything else — the map, stats, day table, journal section, and gear list — loads automatically.

---

### Step 5 — Add the trip to `trips.json`

Open `/data/trips.json` and add a new entry. This is the only file that needs editing
to make a trip appear on the homepage.

```json
[
  {
    "trip_id": "my-new-trip",
    "page_url": "trips/my-new-trip.html"
  }
]
```

The homepage fetches `meta.json` and all GeoJSON files automatically to compute
distance, elevation gain, and duration — no manual stat entry required.

---

### Step 6 — Push and you're done

Commit and push all new files. GitHub Pages deploys automatically within ~60 seconds.

---

## Optional — Adding a Gear List

If a `gear.json` file exists in the trip's data folder, a Gear section appears
automatically below the Journal section. If it doesn't exist, the section is hidden.

**`gear.json` structure:**
```json
{
  "title": "Trip Name - Gear List",
  "summary": [
    { "category": "Big 4",             "weight_lbs": "5.37" },
    { "category": "Clothing",          "weight_lbs": "1.35" },
    { "category": "Total Base Weight", "weight_lbs": "9.46 lbs" },
    { "category": "Total Worn Weight", "weight_lbs": "4.04 lbs" }
  ],
  "categories": [
    {
      "name": "Big 4",
      "items": [
        { "gear": "KS50 (w CF Stays)", "item_type": "Pack", "quantity": "1", "weight_oz": "19.20" }
      ]
    }
  ]
}
```

**To generate `gear.json` from your Word doc:**
Send the `.docx` gear list file to Claude and ask to convert it to `gear.json`.
The converter handles the summary table, all category sections, and the Worn Weight section.

---

## Optional — Adding a Journal and Photos

Each trip HTML file has a Journal section below the Day-by-Day table.
Edit the HTML directly to add your narrative and photos.

**Text block:**
```html
<div class="journal-entry">
  <p>Your paragraph text goes here.</p>
  <p>Add as many paragraphs as you like.</p>
</div>
```

**Photo block — place between text blocks:**
```html
<figure class="journal-photo">
  <img src="../photos/my-new-trip/photo-name.jpg" alt="Describe the photo" />
  <figcaption>Optional caption text.</figcaption>
</figure>
```

### Hosting Photos — Two Options

**Option 1: Flickr (Recommended) — Avoids GitHub storage limits**

1. Upload your photo to Flickr
2. Go to the photo page and click the **download arrow** (bottom right) or **"View all sizes"**
3. Select "Large" or "Medium" size
4. Right-click the displayed image and select "Copy Image Address"
5. The URL will look like: `https://live.staticflickr.com/65535/[photo-id]_[secret]_b.jpg`
6. Use that direct URL in your HTML:

```html
<figure class="journal-photo">
  <img src="https://live.staticflickr.com/65535/55103810265_521182b04b_b.jpg" alt="Summit view" />
  <figcaption>Looking north from the summit.</figcaption>
</figure>
```

**Flickr size suffixes:**
- `_b.jpg` = 1024px (recommended — good quality, works reliably)
- `_h.jpg` = 1600px (if available on your account)
- `_c.jpg` = 800px (smaller, faster loading)

If large sizes aren't working, check **Flickr Settings → Privacy & Permissions → "Who can download your stuff"** and set it to "Anyone."

**Other external hosting options:** Imgur (free, simple), Cloudflare R2 (10GB free), AWS S3 (cheap, reliable)

**Option 2: GitHub repo — Simple but hits storage limits**

1. Rename the file to lowercase with hyphens (e.g. `day-3-summit.jpg`)
2. In GitHub: go to `photos/my-new-trip/` → Add file → Upload files
3. Update the `src` path in the HTML to match the filename
4. Commit — the photo appears on the live site within ~60 seconds

**GitHub limits:** 100MB per file, 1GB total repo size. Resize to ~2000px wide before uploading.

---

## How Stats Are Calculated

| Stat | Source |
|------|--------|
| Distance | Haversine formula applied to GeoJSON coordinates |
| Elevation gain | Cumulative positive elevation change from coordinates (metres → feet) |
| Duration | `end_date` + `end_time` minus `start_date` + `start_time` from `meta.json` |
| Vert / mile | Total elevation gain ÷ total distance |

If `distance_miles` or `elevation_gain_ft` are present in a day's GeoJSON `properties`,
those values are used directly instead of being computed.

---

## Customisation Reference

| What to change | Where |
|----------------|-------|
| Site name in nav | `index.html` — `.nav-logo` |
| Homepage headline and tagline | `index.html` — `.home-hero` |
| Footer quote | `index.html` and every trip HTML — `<footer>` |
| Colors | `css/style.css` — `:root` variables |
| Map tile layer (satellite vs topo vs street) | `js/trip.js` — `buildMap()` |
| Day route colors | `js/utils.js` — `DAY_COLORS_NEUTRAL` and `DAY_COLORS_HOVER` arrays |

---

## Map Tile Options (all free, no API key)

The default is ESRI satellite imagery. Swap the URL in `buildMap()` inside `js/trip.js`:

```javascript
// ESRI Satellite (current default)
'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'

// ESRI Topographic
'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'

// OpenTopoMap
'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'

// OpenStreetMap
'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
```

---

## Troubleshooting

**Homepage shows "—" for all stats**
→ Check that `meta.json` exists in the trip's data folder and is valid JSON.
→ Paste into [jsonlint.com](https://jsonlint.com) to check for syntax errors.

**Map shows a grey box**
→ Open the browser console (F12 → Console tab) — look for red error messages.
→ Most common cause: `window.TRIP_ID` in the HTML doesn't exactly match the `/data/` folder name (case-sensitive on GitHub Pages).

**Route lines don't appear on the map**
→ Check that the filenames listed in `meta.json`'s `days` array exactly match your `.geojson` filenames.
→ Paste a GeoJSON file into [geojsonlint.com](https://geojsonlint.com) to check for structure errors.
→ Verify coordinates are `[longitude, latitude]` order — not `[latitude, longitude]`.

**JSON parse error on homepage or trip page**
→ Paste the relevant JSON file into [jsonlint.com](https://jsonlint.com).
→ Most common issues: missing comma between entries, trailing comma after the last entry, or smart quotes instead of straight quotes.

**Gear section not appearing**
→ Confirm `gear.json` exists at `data/{trip-id}/gear.json`.
→ Check that `window.TRIP_ID` in the trip HTML matches the folder name.

---

## Deploy to GitHub Pages

1. Push all files to your GitHub repository with `index.html` at the root level
2. Go to **Settings → Pages**
3. Set source: **Deploy from a branch**, branch: `main`, folder: `/ (root)`
4. Visit `https://{username}.github.io/{repo-name}/`
