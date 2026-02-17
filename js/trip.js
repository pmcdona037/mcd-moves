/* ============================================================
   HIKING JOURNAL — trip.js
   Trip page script.

   Each trip HTML file sets these globals before loading this script:
     window.TRIP_ID  — folder name under /data/  (e.g. "appalachian-trail")
     window.DATA_ROOT — optional override for data root path (defaults to "../data")

   This script then:
     1. Fetches /data/{TRIP_ID}/meta.json for dates, title, day file list
     2. Populates overview stats (distance + elevation computed from GeoJSON)
     3. Initialises a Leaflet satellite map
     4. Loads each day's GeoJSON as a separate coloured layer
     5. Applies hover interaction on each day's route
   ============================================================ */

'use strict';

/* ---- Initialise on DOM ready -------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  const tripId = window.TRIP_ID;
  if (!tripId) {
    console.error('[trip.js] window.TRIP_ID is not set.');
    return;
  }
  const dataRoot = window.DATA_ROOT || '../data';
  initTripPage(tripId, dataRoot);
});

/* ---- Main entry point --------------------------------------- */
async function initTripPage(tripId, dataRoot) {
  const metaUrl = `${dataRoot}/${tripId}/meta.json`;

  let meta;
  try {
    const res = await fetch(metaUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${metaUrl}`);
    meta = await res.json();
  } catch (err) {
    showMetaError(err.message);
    return;
  }

  // Populate static header fields from meta
  setTextContent('trip-title',       meta.title       || tripId);
  setTextContent('trip-description', meta.description || '');
  setTextContent('trip-start-date',  formatDate(meta.start_date));
  setTextContent('trip-end-date',    formatDate(meta.end_date));
  setTextContent('trip-elapsed',     calcElapsedTime(
    meta.start_date, meta.start_time,
    meta.end_date,   meta.end_time
  ));

  // Set page <title>
  document.title = (meta.title || tripId) + ' — Hiking Journal';

  // Load all day GeoJSON files
  const dayFiles = Array.isArray(meta.days) ? meta.days : [];
  if (dayFiles.length === 0) {
    showMapError('No day files listed in meta.json.');
    return;
  }

  const dayResults = await loadAllDays(tripId, dataRoot, dayFiles);

  // Aggregate totals
  let totalDistance = 0;
  let totalElevation = 0;
  const validDays = dayResults.filter(d => d.ok);

  for (const day of validDays) {
    totalDistance  += day.distance;
    totalElevation += day.elevation;
  }

  setTextContent('trip-total-distance',  `${(totalDistance).toFixed(1)} mi`);
  setTextContent('trip-total-elevation', `${formatNumber(Math.round(totalElevation))} ft`);

  // Vert per mile = total elevation gain (ft) / total distance (miles)
  const vertPerMile = totalDistance > 0
    ? `${formatNumber(Math.round(totalElevation / totalDistance))} ft/mi`
    : '—';
  setTextContent('trip-vert-per-mile', vertPerMile);

  // Render day table
  buildDayTable(dayResults);

  // Initialise map
  buildMap(dayResults);

  // Build legend
  buildLegend(dayResults);
}

/* ---- Load all GeoJSON day files concurrently ---------------- */
async function loadAllDays(tripId, dataRoot, dayFiles) {
  const promises = dayFiles.map((entry, index) =>
    loadDayGeoJSON(tripId, dataRoot, entry, index)
  );
  return Promise.all(promises);
}

/**
 * Fetch a single day GeoJSON file and extract stats.
 *
 * Supports two meta.json formats:
 *
 * LEGACY (string) — stats computed from GeoJSON coordinates,
 * or from embedded GeoJSON properties if present:
 *   "days": ["day-1.geojson", "day-2.geojson"]
 *
 * NEW (object) — stats taken directly from meta.json,
 * GeoJSON still loaded for the map:
 *   "days": [
 *     { "file": "day-1.geojson", "distance_miles": 14.2, "elevation_gain_ft": 3800 },
 *     { "file": "day-2.geojson", "distance_miles": 11.7, "elevation_gain_ft": 2100 }
 *   ]
 */
async function loadDayGeoJSON(tripId, dataRoot, entry, index) {
  // Normalise entry — handle both string and object formats
  const isNewFormat = typeof entry === 'object' && entry !== null;
  const filename    = isNewFormat ? entry.file : entry;
  const manualDist  = isNewFormat ? entry.distance_miles    : null;
  const manualElev  = isNewFormat ? entry.elevation_gain_ft : null;

  const url = `${dataRoot}/${tripId}/${filename}`;
  const result = {
    index,
    filename,
    url,
    ok: false,
    geojson: null,
    dayNumber: index + 1,
    distance: 0,
    elevation: 0,
    error: null,
  };

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const geojson = await res.json();
    result.geojson = geojson;
    result.ok = true;

    const props = getFirstFeatureProps(geojson);
    result.dayNumber = (props && props.day != null) ? props.day : index + 1;

    if (isNewFormat) {
      // New format — use manual numbers from meta.json directly
      result.distance  = manualDist != null ? manualDist : 0;
      result.elevation = manualElev != null ? manualElev : 0;
    } else {
      // Legacy format — use embedded GeoJSON properties if present,
      // otherwise compute from coordinates
      const coords = extractCoords(geojson);
      result.distance = (props && props.distance_miles != null)
        ? props.distance_miles
        : calcDistance(coords);
      result.elevation = (props && props.elevation_gain_ft != null)
        ? props.elevation_gain_ft
        : calcElevationGain(coords);
    }

  } catch (err) {
    result.error = err.message;
    console.warn(`[trip.js] Failed to load ${url}: ${err.message}`);
  }

  return result;
}

/* ---- Extract coordinate array from GeoJSON ---------------- */
function extractCoords(geojson) {
  if (!geojson) return [];
  // FeatureCollection: find first LineString feature
  if (geojson.type === 'FeatureCollection') {
    for (const feature of geojson.features || []) {
      const c = extractCoordsFromGeometry(feature.geometry);
      if (c.length) return c;
    }
  }
  // Feature
  if (geojson.type === 'Feature') {
    return extractCoordsFromGeometry(geojson.geometry);
  }
  // Direct geometry
  return extractCoordsFromGeometry(geojson);
}

function extractCoordsFromGeometry(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'LineString') return geometry.coordinates || [];
  if (geometry.type === 'MultiLineString') return (geometry.coordinates || []).flat();
  return [];
}

function getFirstFeatureProps(geojson) {
  if (!geojson) return null;
  if (geojson.type === 'FeatureCollection') {
    return (geojson.features && geojson.features[0] && geojson.features[0].properties) || null;
  }
  if (geojson.type === 'Feature') return geojson.properties || null;
  return null;
}

/* ---- Build the Leaflet map --------------------------------- */
function buildMap(dayResults) {
  const mapEl = document.getElementById('trip-map');
  if (!mapEl) return;

  const map = L.map('trip-map', {
    zoomControl: true,
    scrollWheelZoom: true,
    attributionControl: true,
  });

  // Base layer — ESRI satellite imagery
  L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      attribution: 'Tiles © Esri',
      maxZoom: 18,
    }
  ).addTo(map);

  // Boundary overlay — ESRI Reference layer (state + country borders, labels)
  // Transparent overlay drawn on top of satellite — no API key required
  L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    {
      opacity: 0.5,
      maxZoom: 18,
      pane: 'overlayPane',
    }
  ).addTo(map);

  const allBounds = [];
  const layers    = [];

  // Track first coord of day 1 and last coord of final day for start/end markers
  let startCoord = null;
  let endCoord   = null;

  const validDays = dayResults.filter(d => d.ok && d.geojson);

  for (const day of validDays) {
    const colorNeutral = dayColorNeutral(day.index);
    const colorHover   = dayColorHover(day.index);

    const layer = L.geoJSON(day.geojson, {
      style: {
        color: colorNeutral,
        weight: 2.5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      },
      onEachFeature: (_feature, featureLayer) => {
        featureLayer.on('mouseover', (e) => {
          e.target.setStyle({ color: colorHover, weight: 4, opacity: 1 });
          featureLayer.bindTooltip(buildTooltipHtml(day), {
            sticky: true,
            direction: 'top',
            offset: [0, -6],
            className: 'hike-tooltip',
          }).openTooltip(e.latlng);
        });
        featureLayer.on('mouseout', (e) => {
          e.target.setStyle({ color: colorNeutral, weight: 2.5, opacity: 0.95 });
          featureLayer.closeTooltip();
        });
        featureLayer.on('mousemove', (e) => {
          if (featureLayer.isTooltipOpen()) featureLayer.getTooltip().setLatLng(e.latlng);
        });
      }
    }).addTo(map);

    layers.push(layer);

    // Capture start and end coordinates across all days
    const coords = extractCoords(day.geojson);
    if (coords.length) {
      if (startCoord === null) {
        // First valid coordinate of the entire trip
        startCoord = [coords[0][1], coords[0][0]]; // [lat, lon] for Leaflet
      }
      // Always update endCoord — will end up as last coord of last day
      endCoord = [coords[coords.length - 1][1], coords[coords.length - 1][0]];
    }

    try {
      const bounds = layer.getBounds();
      if (bounds.isValid()) allBounds.push(bounds);
    } catch { /* skip */ }
  }

  // Fit map to full route
  if (allBounds.length > 0) {
    let combined = allBounds[0];
    for (let i = 1; i < allBounds.length; i++) combined = combined.extend(allBounds[i]);
    map.fitBounds(combined, { padding: [32, 32] });
  } else {
    map.setView([39.5, -98.35], 4);
    showMapError('Could not determine route bounds.');
  }

  // Add pulsing start and end markers
  if (startCoord) addPulseMarker(map, startCoord, 'start');
  if (endCoord)   addPulseMarker(map, endCoord,   'end');

  // Hide loading placeholder
  const loadingEl = document.getElementById('map-loading');
  if (loadingEl) loadingEl.remove();
}

/* ---- Pulsing marker --------------------------------------- */
function addPulseMarker(map, latlng, type) {
  const icon = L.divIcon({
    className: '',
    html: `<div class="pulse-marker pulse-marker--${type}"><div class="pulse-ring"></div></div>`,
    iconSize:   [16, 16],
    iconAnchor: [8, 8],
  });
  L.marker(latlng, { icon, interactive: false }).addTo(map);
}

function buildTooltipHtml(day) {
  return `
    <div class="tooltip-day">Day ${day.dayNumber}</div>
    <div class="tooltip-stats">
      <div class="tooltip-stat">
        <span class="tooltip-stat-val">${day.distance.toFixed(1)} mi</span>
        <span class="tooltip-stat-lbl">Distance</span>
      </div>
      <div class="tooltip-stat">
        <span class="tooltip-stat-val">+${formatNumber(day.elevation)} ft</span>
        <span class="tooltip-stat-lbl">Elevation gain</span>
      </div>
    </div>
  `;
}

/* ---- Build day summary table ------------------------------ */
function buildDayTable(dayResults) {
  const tbody = document.getElementById('days-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';

  for (const day of dayResults) {
    const tr = document.createElement('tr');

    if (day.ok) {
      tr.innerHTML = `
        <td>
          <span class="day-color-dot" style="background:${dayColorNeutral(day.index)}"></span>
          Day ${day.dayNumber}
        </td>
        <td>${day.distance.toFixed(1)} mi</td>
        <td>+${formatNumber(day.elevation)} ft</td>
      `;
    } else {
      tr.innerHTML = `
        <td>
          <span class="day-color-dot" style="background:#3a3a3a"></span>
          Day ${day.dayNumber}
        </td>
        <td colspan="2" style="color:var(--text-dim);font-style:italic">
          Failed to load (${day.error || 'unknown error'})
        </td>
      `;
    }

    tbody.appendChild(tr);
  }
}

/* ---- Build color legend ----------------------------------- */
function buildLegend(dayResults) {
  const legend = document.getElementById('day-legend');
  if (!legend) return;

  const validDays = dayResults.filter(d => d.ok);
  if (validDays.length === 0) {
    legend.style.display = 'none';
    return;
  }

  legend.innerHTML = validDays.map(day => `
    <div class="legend-item">
      <span class="legend-swatch" style="background:${dayColorNeutral(day.index)}"></span>
      Day ${day.dayNumber}
    </div>
  `).join('');
}

/* ---- Helpers ---------------------------------------------- */
function setTextContent(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function showMetaError(msg) {
  const header = document.querySelector('.trip-header');
  if (header) {
    header.insertAdjacentHTML('beforeend',
      `<p class="error-state">Could not load trip metadata: ${escapeHtml(msg)}</p>`);
  }
}

function showMapError(msg) {
  const mapEl = document.getElementById('trip-map');
  if (mapEl) {
    mapEl.outerHTML = `<div class="map-error">${escapeHtml(msg)}</div>`;
  }
}

function escapeHtml(str) {
  if (typeof str !== 'string') return String(str || '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
