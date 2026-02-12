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

  setTextContent('trip-total-distance',  `${Math.round(totalDistance * 10) / 10} mi`);
  setTextContent('trip-total-elevation', `${formatNumber(Math.round(totalElevation / 10) * 10)} ft`);
  setTextContent('trip-days-count',      `${validDays.length}`);

  // Render day table
  buildDayTable(dayResults);

  // Initialise map
  buildMap(dayResults);

  // Build legend
  buildLegend(dayResults);
}

/* ---- Load all GeoJSON day files concurrently ---------------- */
async function loadAllDays(tripId, dataRoot, dayFiles) {
  const promises = dayFiles.map((filename, index) =>
    loadDayGeoJSON(tripId, dataRoot, filename, index)
  );
  return Promise.all(promises);
}

/**
 * Fetch a single day GeoJSON file and extract stats.
 * Returns a result object whether or not the fetch succeeded.
 */
async function loadDayGeoJSON(tripId, dataRoot, filename, index) {
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

    // Extract coords from the first LineString feature
    const coords = extractCoords(geojson);

    // Use embedded properties if present; otherwise compute from coordinates
    const props = getFirstFeatureProps(geojson);
    result.dayNumber = (props && props.day != null) ? props.day : index + 1;

    result.distance = (props && props.distance_miles != null)
      ? props.distance_miles
      : calcDistance(coords);

    result.elevation = (props && props.elevation_gain_ft != null)
      ? props.elevation_gain_ft
      : calcElevationGain(coords);

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

  // Use ESRI World Imagery (satellite) — free, no API key required
  const map = L.map('trip-map', {
    zoomControl: true,
    scrollWheelZoom: true,
    attributionControl: true,
  });

  L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      attribution: 'Tiles © Esri — Source: Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community',
      maxZoom: 18,
    }
  ).addTo(map);

  const allBounds = [];
  const layers = [];

  for (const day of dayResults) {
    if (!day.ok || !day.geojson) continue;

    const colorNeutral = dayColorNeutral(day.index);
    const colorHover   = dayColorHover(day.index);

    const layer = L.geoJSON(day.geojson, {
      style: {
        color: colorNeutral,
        weight: 2.5,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
      },
      onEachFeature: (_feature, featureLayer) => {
        // Hover interactions
        featureLayer.on('mouseover', (e) => {
          e.target.setStyle({ color: colorHover, weight: 4, opacity: 1 });

          const tooltipHtml = buildTooltipHtml(day);
          featureLayer.bindTooltip(tooltipHtml, {
            sticky: true,
            direction: 'top',
            offset: [0, -6],
            className: 'hike-tooltip',
          }).openTooltip(e.latlng);
        });

        featureLayer.on('mouseout', (e) => {
          e.target.setStyle({ color: colorNeutral, weight: 2.5, opacity: 0.85 });
          featureLayer.closeTooltip();
        });

        featureLayer.on('mousemove', (e) => {
          if (featureLayer.isTooltipOpen()) {
            featureLayer.getTooltip().setLatLng(e.latlng);
          }
        });
      }
    }).addTo(map);

    layers.push(layer);

    try {
      const bounds = layer.getBounds();
      if (bounds.isValid()) allBounds.push(bounds);
    } catch { /* skip */ }
  }

  // Fit map to full route
  if (allBounds.length > 0) {
    let combined = allBounds[0];
    for (let i = 1; i < allBounds.length; i++) {
      combined = combined.extend(allBounds[i]);
    }
    map.fitBounds(combined, { padding: [32, 32] });
  } else {
    // Fallback view if no valid bounds
    map.setView([39.5, -98.35], 4);
    showMapError('Could not determine route bounds.');
  }

  // Hide loading placeholder
  const loadingEl = document.getElementById('map-loading');
  if (loadingEl) loadingEl.remove();
}

function buildTooltipHtml(day) {
  return `
    <div class="tooltip-day">Day ${day.dayNumber}</div>
    <div class="tooltip-stats">
      <div class="tooltip-stat">
        <span class="tooltip-stat-val">${day.distance} mi</span>
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
        <td>${day.distance} mi</td>
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
