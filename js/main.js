/* ============================================================
   HIKING JOURNAL — main.js
   Homepage script: reads /data/trips.json and renders trip cards.
   ============================================================ */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  loadTrips();
});

async function loadTrips() {
  const container = document.getElementById('trip-list');
  if (!container) return;

  container.innerHTML = `<p class="loading-state">Loading trips…</p>`;

  let trips;
  try {
    const res = await fetch('./data/trips.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    trips = await res.json();
  } catch (err) {
    container.innerHTML = `<p class="error-state">Could not load trip data. (${err.message})</p>`;
    return;
  }

  if (!Array.isArray(trips) || trips.length === 0) {
    container.innerHTML = `<p class="loading-state">No trips found.</p>`;
    return;
  }

  container.innerHTML = trips.map(trip => buildTripCard(trip)).join('');
}

/**
 * Render a single trip card as HTML.
 * @param {Object} trip - entry from trips.json
 * @returns {string} HTML string
 */
function buildTripCard(trip) {
  const dateRange  = buildDateRange(trip.start_date, trip.end_date);
  const distance   = trip.total_distance_miles != null
    ? `${trip.total_distance_miles} mi` : '—';
  const elevation  = trip.total_elevation_gain_ft != null
    ? `${formatNumber(trip.total_elevation_gain_ft)} ft` : '—';

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
          ${trip.days != null ? `
          <div class="trip-stat">
            <span class="trip-stat-value">${trip.days}</span>
            <span class="trip-stat-label">Days</span>
          </div>` : ''}
        </div>
      </div>
      <div class="trip-card-arrow">→</div>
    </a>
  `;
}

/**
 * Format a human-readable date range.
 * @param {string} start - YYYY-MM-DD
 * @param {string} end   - YYYY-MM-DD
 * @returns {string}
 */
function buildDateRange(start, end) {
  if (!start) return '—';
  const s = formatDate(start);
  if (!end || end === start) return s;
  const e = formatDate(end);
  // If same year, omit year from start date for brevity
  if (start.slice(0, 4) === end.slice(0, 4)) {
    const sShort = new Date(start + 'T00:00').toLocaleDateString('en-US', {
      month: 'long', day: 'numeric'
    });
    return `${sShort} – ${e}`;
  }
  return `${s} – ${e}`;
}

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return String(str || '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
