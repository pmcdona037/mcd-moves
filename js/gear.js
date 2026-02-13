/* ============================================================
   HIKING JOURNAL — gear.js
   Loads and renders a gear list from a local gear.json file.

   The gear.json file lives at:  /data/{trip_id}/gear.json

   This script reads window.TRIP_ID (already set by the trip page)
   and constructs the path automatically — no extra config needed.

   To add a gear list to a trip:
     1. Create gear.json in /data/{trip_id}/
     2. That's it — the section appears automatically.

   If gear.json doesn't exist for a trip, the section stays hidden.

   gear.json structure:
   {
     "title": "Trip Name - Date",
     "summary": [
       { "category": "Big 4",            "weight_lbs": "5.39" },
       { "category": "Total Base Weight", "weight_lbs": "10.00 lbs" }
     ],
     "categories": [
       {
         "name": "Big 4",
         "items": [
           { "gear": "Item name", "item_type": "Type", "quantity": "1", "weight_oz": "20.60" }
         ]
       }
     ]
   }
   ============================================================ */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const tripId   = window.TRIP_ID;
  const dataRoot = window.DATA_ROOT || '../data';
  if (!tripId) return;

  loadGearList(`${dataRoot}/${tripId}/gear.json`);
});

/* ---- Main loader ------------------------------------------ */
async function loadGearList(url) {
  const section   = document.getElementById('gear-section');
  const container = document.getElementById('gear-content');
  if (!section || !container) return;

  let data;
  try {
    const res = await fetch(url);
    if (!res.ok) return; // No gear.json — silently hide the section
    data = await res.json();
  } catch {
    return; // Network or parse error — hide silently
  }

  // Show section now that we have data
  section.style.display = 'block';
  container.innerHTML   = renderGearList(data);
}

/* ---- Renderer --------------------------------------------- */
function renderGearList(data) {
  let html = '';

  // Optional sheet title
  if (data.title) {
    html += `<p class="gear-sheet-title">${esc(data.title)}</p>`;
  }

  // Summary table
  if (Array.isArray(data.summary) && data.summary.length) {
    html += buildSummaryTable(data.summary);
  }

  // Category sections
  if (Array.isArray(data.categories)) {
    for (const cat of data.categories) {
      if (cat.name && Array.isArray(cat.items) && cat.items.length) {
        html += buildCategorySection(cat);
      }
    }
  }

  return html;
}

/* ---- Summary table --------------------------------------- */
function buildSummaryTable(rows) {
  let html = `
    <table class="gear-summary-table">
      <thead>
        <tr class="gear-summary-header">
          <th>Category</th>
          <th>Weight (lbs)</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const row of rows) {
    const isTotal = row.category.toLowerCase().startsWith('total');
    const cls     = isTotal ? ' class="gear-summary-total"' : '';
    html += `
        <tr${cls}>
          <td>${esc(row.category)}</td>
          <td>${esc(row.weight_lbs)}</td>
        </tr>`;
  }

  html += `
      </tbody>
    </table>`;

  return html;
}

/* ---- Category section ------------------------------------ */
function buildCategorySection(cat) {
  let html = `
    <div class="gear-category">
      <h3 class="gear-category-name">${esc(cat.name)}</h3>
      <table class="gear-items-table">
        <colgroup>
          <col style="width:50%">
          <col style="width:25%">
          <col style="width:8%">
          <col style="width:17%">
        </colgroup>
        <thead>
          <tr>
            <th>Gear</th>
            <th>Item Type</th>
            <th>Qty</th>
            <th>Weight (oz)</th>
          </tr>
        </thead>
        <tbody>
  `;

  for (const item of cat.items) {
    html += `
          <tr>
            <td>${esc(item.gear      || '')}</td>
            <td>${esc(item.item_type || '')}</td>
            <td>${esc(item.quantity  || '')}</td>
            <td>${esc(item.weight_oz || '')}</td>
          </tr>`;
  }

  html += `
        </tbody>
      </table>
    </div>`;

  return html;
}

/* ---- Helper ---------------------------------------------- */
function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
