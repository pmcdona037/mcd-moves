/* ============================================================
   HIKING JOURNAL — utils.js
   Shared math utilities used by both homepage and trip pages.
   ============================================================ */

'use strict';

/**
 * Haversine distance between two geographic coordinates.
 * @param {number[]} c1 - [longitude, latitude]
 * @param {number[]} c2 - [longitude, latitude]
 * @returns {number} Distance in miles
 */
function haversineDistance(c1, c2) {
  const R = 3958.8; // Earth radius in miles
  const toRad = deg => (deg * Math.PI) / 180;

  const lat1 = toRad(c1[1]);
  const lat2 = toRad(c2[1]);
  const dLat = toRad(c2[1] - c1[1]);
  const dLon = toRad(c2[0] - c1[0]);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calculate total distance of a LineString coordinate array.
 * @param {number[][]} coords - Array of [lon, lat] or [lon, lat, ele] points
 * @returns {number} Total distance in miles, rounded to 1 decimal
 */
function calcDistance(coords) {
  if (!coords || coords.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineDistance(coords[i - 1], coords[i]);
  }
  return Math.round(total * 10) / 10;
}

/**
 * Calculate cumulative elevation gain from a coordinate array.
 * Requires elevation as the 3rd element of each coordinate: [lon, lat, ele_meters].
 * @param {number[][]} coords - Array of [lon, lat, elevation_meters] points
 * @returns {number} Total elevation gain in feet, rounded to nearest 10
 */
function calcElevationGain(coords) {
  if (!coords || coords.length < 2) return 0;
  let gain = 0;
  for (let i = 1; i < coords.length; i++) {
    const prevEle = coords[i - 1][2];
    const currEle = coords[i][2];
    if (typeof prevEle === 'number' && typeof currEle === 'number') {
      const diff = currEle - prevEle;
      if (diff > 0) gain += diff;
    }
  }
  // Convert meters to feet, round to nearest 10
  return Math.round((gain * 3.28084) / 10) * 10;
}

/**
 * Format a number with commas (e.g. 12345 → "12,345").
 * @param {number} n
 * @returns {string}
 */
function formatNumber(n) {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('en-US');
}

/**
 * Compute elapsed time string between two ISO date+time strings.
 * @param {string} startDate  - e.g. "2024-06-01"
 * @param {string} startTime  - e.g. "07:00"
 * @param {string} endDate    - e.g. "2024-06-15"
 * @param {string} endTime    - e.g. "14:30"
 * @returns {string} Human-readable elapsed time, e.g. "14d 7h 30m"
 */
function calcElapsedTime(startDate, startTime, endDate, endTime) {
  try {
    const start = new Date(`${startDate}T${startTime || '00:00'}`);
    const end   = new Date(`${endDate}T${endTime   || '00:00'}`);
    let diffMs  = end - start;
    if (diffMs <= 0) return '—';

    const days    = Math.floor(diffMs / 86400000);
    diffMs       -= days * 86400000;
    const hours   = Math.floor(diffMs / 3600000);
    diffMs       -= hours * 3600000;
    const minutes = Math.floor(diffMs / 60000);

    const parts = [];
    if (days)    parts.push(`${days}d`);
    if (hours)   parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    return parts.join(' ') || '< 1m';
  } catch {
    return '—';
  }
}

/**
 * Format a date string (YYYY-MM-DD) to abbreviated form.
 * Used on trip pages: "Apr 5, 2025"
 * @param {string} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format a date string (YYYY-MM-DD) to full long form.
 * Used on the homepage: "April 5, 2025"
 * @param {string} dateStr
 * @returns {string}
 */
function formatDateLong(dateStr) {
  if (!dateStr) return '—';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

/**
 * Muted neutral colors for each day's route when not hovered.
 * Add more colors here if a trip has more than 8 days.
 */
const DAY_COLORS_NEUTRAL = [
  '#6a85a0',  // steel blue
  '#7a9e78',  // sage green
  '#a09060',  // khaki
  '#9e7878',  // dusty rose
  '#6a9e9e',  // slate teal
  '#8878a0',  // muted lavender
  '#a07860',  // terracotta
  '#6878a0',  // periwinkle
  '#a09878',  // warm sand
  '#6a9080',  // eucalyptus
];

/**
 * Bright highlight colors for each day when hovered.
 * Must correspond 1-to-1 with DAY_COLORS_NEUTRAL.
 */
const DAY_COLORS_HOVER = [
  '#4a9ed4',  // bright blue
  '#5cba5c',  // bright green
  '#d4a832',  // golden yellow
  '#d45c5c',  // coral red
  '#3ab8b8',  // bright teal
  '#a060d0',  // violet
  '#e07832',  // burnt orange
  '#4868d4',  // indigo
  '#c8b050',  // ochre
  '#40a890',  // jade
];

/**
 * Get the neutral color for a day index (0-based).
 * Wraps around if more days than colors.
 * @param {number} index
 * @returns {string} CSS color string
 */
function dayColorNeutral(index) {
  return DAY_COLORS_NEUTRAL[index % DAY_COLORS_NEUTRAL.length];
}

/**
 * Get the hover color for a day index (0-based).
 * @param {number} index
 * @returns {string} CSS color string
 */
function dayColorHover(index) {
  return DAY_COLORS_HOVER[index % DAY_COLORS_HOVER.length];
}
