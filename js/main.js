/* ============================================================
   HIKING JOURNAL — main.js
   Homepage script.

   Reads /data/trips.json for the list of trips (trip_id + page_url).
   For each trip:
     1. Fetches /data/{trip_id}/meta.json  → title, dates, day file list
     2. Fetches each day's GeoJSON         → computes distance & elevation
   Then renders a trip card with live-computed stats.

   To add a new trip: add one entry to trips.json with trip_id and page_url.
   No stats need to be entered manually.
   ============================================================ */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  loadTrips();
});

/* ---- Load trip index and kick off per-trip fetches --------- */
async function loadTrips() {
  const container = document.getElementById('trip-list');
  if (!container) return;

  container.innerHTML = `<p class="loading-state">Loading trips…</p>`;

  let tripIndex;
  try {
    const res = await fetch('./data/trips.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    tripIndex = await res.json();
  } catch (err) {
    container.innerHTML = `<p class="error-state">Could not load trip list. (${err.message})</p>`;
    return;
  }

  if (!Array.isArray(tripIndex) || tripIndex.length === 0) {
    container.innerHTML = `<p class="loading-state">No trips found.</p>`;
    return;
  }

  // Render skeleton cards immediately so the page doesn't look blank
  container.innerHTML = tripIndex
    .map(t => buildSkeletonCard(t.page_url))
    .join('');

  // Fetch and compute each trip in parallel
  const results = await Promise.all(
    tripIndex.map(entry => computeTripData(entry))
  );

  // Replace skeleton cards with real content
  container.innerHTML = results
    .map(trip => buildTripCard(trip))
    .join('');
}

/* ---- Fetch meta.json + all GeoJSON for one trip ------------ */
async function computeTripData(entry) {
  const { trip_id, page_url } = entry;
  const dataRoot = './data';

  const result = {
    trip_id,
    page_url,
    title: trip_id,
    description: '',
    start_date: null,
    start_time: null,
    end_date: null,
    end_time: null,
    totalDistance: null,
    totalElevation: null,
    duration: null,
    error: null,
  };

  // 1. Fetch meta.json
  let meta;
  try {
    const res = await fetch(`${dataRoot}/${trip_id}/meta.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    meta = await res.json();
  } catch (err) {
    result.error = `Could not load meta.json (${err.message})`;
    return result;
  }

  result.title       = meta.title       || trip_id;
  result.description = meta.description || '';
  result.start_date  = meta.start_date  || null;
  result.start_time  = meta.start_time  || null;
  result.end_date    = meta.end_date    || null;
  result.end_time    = meta.end_time    || null;

  // Duration formatted as "5d 4h 3m"
  if (meta.start_date && meta.end_date) {
    result.duration = calcElapsedTime(
      meta.start_date, meta.start_time,
      meta.end_date,   meta.end_time
    );
  }

  // 2. Fetch all day GeoJSON files and compute totals
  const dayFiles = Array.isArray(meta.days) ? meta.days : [];
  if (dayFiles.length === 0) return result;

  const dayResults = await Promise.all(
    dayFiles.map(filename =>
      fetchDayStats(`${dataRoot}/${trip_id}/${filename}`)
    )
  );

  let totalDistance  = 0;
  let totalElevation = 0;

  for (const day of dayResults) {
    if (day.ok) {
      totalDistance  += day.distance;
      totalElevation += day.elevation;
    }
  }

  result.totalDistance  = Math.round(totalDistance  * 10) / 10;
  result.totalElevation = Math.round(totalElevation / 10) * 10;

  return result;
}

/* ---- Fetch a single GeoJSON file and return stats ---------- */
async function fetchDayStats(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const geojson = await res.json();

    const coords = extractCoords(geojson);
    const props  = getFirstFeatureProps(geojson);

    const distance = (props && props.distance_miles != null)
      ? props.distance_miles
      : calcDistance(coords);

    const elevation = (props && props.elevation_gain_ft != null)
      ? props.elevation_gain_ft
      : calcElevationGain(coords);

    return { ok: true, distance, elevation };
  } catch {
    return { ok: false, distance: 0, elevation: 0 };
  }
}

/* ---- GeoJSON helpers -------------------------------------- */
function extractCoords(geojson) {
  if (!geojson) return [];
  if (geojson.type === 'FeatureCollection') {
    for (const f of geojson.features || []) {
      const c = extractCoordsFromGeometry(f.geometry);
      if (c.length) return c;
    }
  }
  if (geojson.type === 'Feature')
    return extractCoordsFromGeometry(geojson.geometry);
  return extractCoordsFromGeometry(geojson);
}

function extractCoordsFromGeometry(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'LineString')      return geometry.coordinates || [];
  if (geometry.type === 'MultiLineString') return (geometry.coordinates || []).flat();
  return [];
}

function getFirstFeatureProps(geojson) {
  if (!geojson) return null;
  if (geojson.type === 'FeatureCollection')
    return (geojson.features?.[0]?.properties) || null;
  if (geojson.type === 'Feature')
    return geojson.properties || null;
  return null;
}

/* ---- Card renderers --------------------------------------- */
function buildSkeletonCard(pageUrl) {
  return `
    <a class="trip-card trip-card--loading" href="${pageUrl || '#'}">
      <div class="trip-card-info">
        <div class="trip-card-title trip-skeleton" style="width:55%;height:1.4rem;"></div>
        <div class="trip-card-dates trip-skeleton" style="width:38%;height:0.85rem;margin:0.5rem 0 0.9rem;"></div>
        <div class="trip-card-stats">
          <div class="trip-skeleton" style="width:70px;height:1rem;"></div>
          <div class="trip-skeleton" style="width:80px;height:1rem;"></div>
          <div class="trip-skeleton" style="width:70px;height:1rem;"></div>
        </div>
      </div>
    </a>
  `;
}

function buildTripCard(trip) {
  const dateRange = buildDateRange(trip.start_date, trip.end_date);
  const distance  = trip.totalDistance  != null ? `${trip.totalDistance} mi`               : '—';
  const elevation = trip.totalElevation != null ? `${formatNumber(trip.totalElevation)} ft` : '—';
  const duration  = trip.duration || '—';

  return `
    <a class="trip-card" href="${trip.page_url || '#'}">
      <div class="trip-card-info">
        <div class="trip-card-title">${escapeHtml(trip.title)}</div>
        <div class="trip-card-dates">${dateRange}</div>
        <div class="trip-card-stats">
          <div class="trip-stat">
            <span class="trip-stat-value">${distance}</span>
            <span class="trip-stat-label">Distance</span>
          </div>
          <div class="trip-stat">
            <span class="trip-stat-value">${elevation}</span>
            <span class="trip-stat-label">Elevation gain</span>
          </div>
          <div class="trip-stat">
            <span class="trip-stat-value">${duration}</span>
            <span class="trip-stat-label">Duration</span>
          </div>
        </div>
      </div>
      <div class="trip-card-arrow">→</div>
    </a>
  `;
}

function buildDateRange(start, end) {
  if (!start) return '—';
  const s = formatDate(start);
  if (!end || end === start) return s;
  const e = formatDate(end);
  if (start.slice(0, 4) === end.slice(0, 4)) {
    const sShort = new Date(start + 'T00:00').toLocaleDateString('en-US', {
      month: 'long', day: 'numeric'
    });
    return `${sShort} – ${e}`;
  }
  return `${s} – ${e}`;
}

function escapeHtml(str) {
  if (typeof str !== 'string') return String(str || '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
