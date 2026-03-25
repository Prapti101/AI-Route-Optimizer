/* ===================================================
   AI DELIVERY ROUTE OPTIMIZER — script.js
   Features: Leaflet Map, TSP (Nearest Neighbor), 
   Haversine Formula, Route Animation, Delivery Sim
=================================================== */

'use strict';

// ── State ──────────────────────────────────────────
const state = {
  locations: [],        // { lat, lng, label }
  distMatrix: [],       // NxN Haversine distance matrix
  optimizedRoute: [],   // Indices of optimized order
  randomRoute: [],      // Indices of random order
  optimizedDist: 0,
  randomDist: 0,
  isSimulating: false,
  agentMarker: null,
  optimizedPolyline: null,
  randomPolyline: null,
  locationMarkers: [],
  animationId: null,
};

// ── Map Initialization ─────────────────────────────
const map = L.map('map', {
  center: [20.5937, 78.9629],   // India center
  zoom: 5,
  zoomControl: true,
});

// OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
  maxZoom: 19,
}).addTo(map);

// ── Icon Factories ─────────────────────────────────
function makeWarehouseIcon() {
  return L.divIcon({
    className: '',
    html: `<div class="warehouse-icon-inner"><i class="fas fa-warehouse"></i></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -38],
  });
}

function makeStopIcon() {
  return L.divIcon({
    className: '',
    html: `<div class="stop-icon-inner"><i class="fas fa-box"></i></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -32],
  });
}

function makeAgentIcon() {
  return L.divIcon({
    className: '',
    html: `<div class="agent-icon-inner"><i class="fas fa-motorcycle"></i></div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -20],
  });
}

// ── Haversine Formula ──────────────────────────────
// Calculates great-circle distance between two lat/lng points
// Returns distance in kilometres
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;                   // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) { return deg * (Math.PI / 180); }

// ── Build NxN Distance Matrix ──────────────────────
function buildDistMatrix(locs) {
  const n = locs.length;
  const matrix = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = haversine(locs[i].lat, locs[i].lng, locs[j].lat, locs[j].lng);
      matrix[i][j] = d;
      matrix[j][i] = d;
    }
  }
  return matrix;
}

// ── TSP: Nearest Neighbor Heuristic ───────────────
// Greedy algorithm: always move to closest unvisited node
// Time complexity: O(N²)
function nearestNeighborTSP(matrix, startIdx) {
  const n = matrix.length;
  const visited = new Array(n).fill(false);
  const route = [startIdx];
  visited[startIdx] = true;

  for (let step = 0; step < n - 1; step++) {
    const current = route[route.length - 1];
    let nearestDist = Infinity;
    let nearestIdx = -1;

    for (let j = 0; j < n; j++) {
      if (!visited[j] && matrix[current][j] < nearestDist) {
        nearestDist = matrix[current][j];
        nearestIdx = j;
      }
    }

    visited[nearestIdx] = true;
    route.push(nearestIdx);
  }

  route.push(startIdx); // Return to depot
  return route;
}

// ── Calculate Total Route Distance ────────────────
function totalRouteDistance(route, matrix) {
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    total += matrix[route[i]][route[i + 1]];
  }
  return total;
}

// ── Generate Random Route ──────────────────────────
function randomRoute(n, startIdx) {
  const indices = Array.from({ length: n }, (_, i) => i).filter(i => i !== startIdx);
  // Fisher-Yates shuffle
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return [startIdx, ...indices, startIdx];
}

// ── Map Click Handler ──────────────────────────────
map.on('click', (e) => {
  const { lat, lng } = e.latlng;
  addLocation(lat, lng);
});

function addLocation(lat, lng) {
  const idx = state.locations.length;
  const isWarehouse = idx === 0;
  const label = isWarehouse ? 'Warehouse' : `Stop ${String.fromCharCode(64 + idx)}`; // A, B, C…

  state.locations.push({ lat, lng, label });

  const icon = isWarehouse ? makeWarehouseIcon() : makeStopIcon();
  const marker = L.marker([lat, lng], { icon })
    .addTo(map)
    .bindPopup(makePopupContent(label, lat, lng));

  state.locationMarkers.push(marker);

  // Update start select dropdown
  const opt = document.createElement('option');
  opt.value = idx; opt.textContent = label;
  document.getElementById('startSelect').appendChild(opt);

  // Hide the hint overlay after first click
  document.getElementById('mapHint').classList.add('hidden');

  updateStatUI();
  log(`📍 Added ${label} (${lat.toFixed(4)}, ${lng.toFixed(4)})`, 'info');
}

function makePopupContent(label, lat, lng, status = '') {
  return `
    <div class="popup-title">${label}</div>
    <div class="popup-coords">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
    ${status ? `<div class="popup-status ${status.cls}">${status.text}</div>` : ''}
  `;
}

// ── Draw Route Polyline ────────────────────────────
function drawRoute(route, color, className, tooltip) {
  const latlngs = route.map(i => [state.locations[i].lat, state.locations[i].lng]);
  const poly = L.polyline(latlngs, {
    color,
    weight: 4,
    opacity: 0.9,
    className,
    smoothFactor: 1,
  }).addTo(map);

  // Hover tooltip showing segment distance
  poly.on('mouseover', function(e) {
    L.popup({ closeButton: false })
      .setLatLng(e.latlng)
      .setContent(`<div style="font-family:Share Tech Mono,monospace;font-size:11px;color:#00c8ff">${tooltip}</div>`)
      .openOn(map);
  });
  poly.on('mouseout', () => map.closePopup());

  return poly;
}

// ── Animate Polyline Drawing ───────────────────────
// Draws route segment by segment with a delay
async function animatePolyline(route, color, className, tooltip) {
  const locs = state.locations;
  // Remove old
  if (className.includes('green') && state.optimizedPolyline) {
    map.removeLayer(state.optimizedPolyline);
    state.optimizedPolyline = null;
  }
  if (className.includes('red') && state.randomPolyline) {
    map.removeLayer(state.randomPolyline);
    state.randomPolyline = null;
  }

  const segments = [];
  for (let i = 0; i < route.length - 1; i++) {
    const seg = L.polyline(
      [[locs[route[i]].lat, locs[route[i]].lng],
       [locs[route[i+1]].lat, locs[route[i+1]].lng]],
      { color, weight: 4, opacity: 0.9, className }
    ).addTo(map);
    segments.push(seg);
    await sleep(80);
  }

  // Merge into single polyline for hover events
  const fullPoly = drawRoute(route, color, className, tooltip);
  segments.forEach(s => map.removeLayer(s));
  return fullPoly;
}

// ── Delivery Simulation ────────────────────────────
// Animates a delivery agent moving smoothly along the route
async function runDeliverySimulation(route) {
  if (state.isSimulating) return;
  state.isSimulating = true;
  setStatus('DELIVERING', '#00ff88');

  const locs = state.locations;

  // Place agent at warehouse
  if (state.agentMarker) map.removeLayer(state.agentMarker);
  state.agentMarker = L.marker(
    [locs[route[0]].lat, locs[route[0]].lng],
    { icon: makeAgentIcon(), zIndexOffset: 1000 }
  ).addTo(map);

  activateStep(0); // Step 1: Start at warehouse
  log('🚴 Agent departed from Warehouse', 'info');
  await sleep(800);

  for (let i = 0; i < route.length - 1; i++) {
    const fromIdx = route[i];
    const toIdx = route[i + 1];
    const from = locs[fromIdx];
    const to = locs[toIdx];
    const isReturn = i === route.length - 2;

    activateStep(1); // Step 2: Go to nearest location
    log(`➡️  Moving to ${to.label}...`, 'info');

    // Smooth interpolation between points
    await animateAgentMove(from, to, 60);

    if (!isReturn) {
      activateStep(2); // Step 3: Deliver package

      // Show "Delivering" popup
      state.agentMarker.bindPopup(
        `<div class="popup-title">${to.label}</div>
         <div class="popup-status delivering">📦 Delivering…</div>`,
        { autoClose: false, closeOnClick: false }
      ).openPopup();

      log(`📦 Delivering to ${to.label}`, 'warning');
      await sleep(900);

      // Show "Delivered" popup
      state.agentMarker.setPopupContent(
        `<div class="popup-title">${to.label}</div>
         <div class="popup-status delivered">✅ Delivered!</div>`
      );
      log(`✅ Delivered at ${to.label}!`, 'success');
      await sleep(600);
      state.agentMarker.closePopup();

      activateStep(3); // Step 4: Continue
    } else {
      activateStep(4); // Step 5: Return to warehouse
      log('🏁 Agent returning to Warehouse', 'info');
      await sleep(600);
      log('🎉 All deliveries complete! Back at Warehouse.', 'success');
    }
  }

  // Mark all steps done
  for (let i = 0; i <= 4; i++) doneStep(i);
  state.isSimulating = false;
  setStatus('COMPLETE', '#00ff88');
}

// Smooth agent movement between two points
async function animateAgentMove(from, to, steps) {
  for (let t = 0; t <= steps; t++) {
    const lat = from.lat + (to.lat - from.lat) * (t / steps);
    const lng = from.lng + (to.lng - from.lng) * (t / steps);
    state.agentMarker.setLatLng([lat, lng]);
    await sleep(18);
  }
}

// ── Step Helpers ───────────────────────────────────
function resetSteps() {
  for (let i = 0; i <= 4; i++) {
    const el = document.getElementById(`step-${i}`);
    el.className = 'step-item step-idle';
  }
}

function activateStep(i) {
  // Deactivate all, mark previous as done
  for (let j = 0; j < i; j++) doneStep(j);
  const el = document.getElementById(`step-${i}`);
  el.className = 'step-item step-active';
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function doneStep(i) {
  const el = document.getElementById(`step-${i}`);
  if (el) el.className = 'step-item step-done';
}

// ── Route Sequence Display ─────────────────────────
function renderRouteSequence(route) {
  const container = document.getElementById('routeSequence');
  container.innerHTML = '';
  route.forEach((idx, i) => {
    const loc = state.locations[idx];
    const badge = document.createElement('span');
    badge.className = `seq-badge ${idx === 0 ? 'warehouse' : 'stop'}`;
    badge.textContent = idx === 0 ? '🏭' : loc.label;
    badge.title = `${loc.label} (${loc.lat.toFixed(3)}, ${loc.lng.toFixed(3)})`;
    container.appendChild(badge);
    if (i < route.length - 1) {
      const arrow = document.createElement('span');
      arrow.className = 'seq-arrow'; arrow.textContent = '→';
      container.appendChild(arrow);
    }
  });
}

// ── Statistics UI Update ───────────────────────────
function updateStatUI() {
  flashStat('statLocations', state.locations.length);
  if (state.optimizedDist > 0) {
    flashStat('statOptDist', state.optimizedDist.toFixed(2));
  }
  if (state.randomDist > 0) {
    flashStat('statRandDist', state.randomDist.toFixed(2));
  }
  if (state.optimizedDist > 0 && state.randomDist > 0) {
    const saved = ((state.randomDist - state.optimizedDist) / state.randomDist * 100).toFixed(1);
    flashStat('statSaved', saved);
  }
}

function flashStat(id, value) {
  const el = document.getElementById(id);
  el.textContent = value;
  el.classList.remove('updated');
  void el.offsetWidth; // force reflow
  el.classList.add('updated');
}

// ── Status Badge ───────────────────────────────────
function setStatus(text, color) {
  document.getElementById('statusText').textContent = text;
  const dot = document.querySelector('.pulse-dot');
  dot.style.background = color;
  dot.style.boxShadow = `0 0 8px ${color}`;
}

// ── Delivery Log ───────────────────────────────────
function log(message, type = 'info') {
  const logEl = document.getElementById('deliveryLog');
  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;
  entry.textContent = `> ${message}`;
  logEl.appendChild(entry);
  logEl.scrollTop = logEl.scrollHeight;
}

// ── Utility ────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Button: Optimize Route ─────────────────────────
document.getElementById('btnOptimize').addEventListener('click', async () => {
  if (state.locations.length < 2) {
    log('⚠️  Need at least 2 locations to optimize!', 'warning'); return;
  }

  setStatus('COMPUTING…', '#ffd700');
  resetSteps();

  const startIdx = parseInt(document.getElementById('startSelect').value) || 0;

  // Build distance matrix
  const t0 = performance.now();
  state.distMatrix = buildDistMatrix(state.locations);

  // Run TSP Nearest Neighbor
  state.optimizedRoute = nearestNeighborTSP(state.distMatrix, startIdx);
  state.optimizedDist = totalRouteDistance(state.optimizedRoute, state.distMatrix);

  // Generate random for comparison
  state.randomRoute = randomRoute(state.locations.length, startIdx);
  state.randomDist = totalRouteDistance(state.randomRoute, state.distMatrix);

  const t1 = performance.now();
  flashStat('statTime', (t1 - t0).toFixed(2));

  // Draw optimized route
  if (state.optimizedPolyline) map.removeLayer(state.optimizedPolyline);
  state.optimizedPolyline = await animatePolyline(
    state.optimizedRoute, '#00ff88', 'glowing-green',
    `Optimized: ${state.optimizedDist.toFixed(2)} km`
  );

  updateStatUI();
  renderRouteSequence(state.optimizedRoute);
  setStatus('OPTIMIZED', '#00ff88');
  log(`✅ Route optimized! ${state.optimizedDist.toFixed(2)} km | ${state.locations.length} stops`, 'success');
});

// ── Button: Compare Routes ─────────────────────────
document.getElementById('btnCompare').addEventListener('click', async () => {
  if (state.locations.length < 2) {
    log('⚠️  Optimize first before comparing!', 'warning'); return;
  }
  if (!state.optimizedRoute.length) {
    log('⚠️  Run Optimize Route first!', 'warning'); return;
  }

  // Remove old random route
  if (state.randomPolyline) { map.removeLayer(state.randomPolyline); state.randomPolyline = null; }

  setStatus('COMPARING…', '#9b5de5');

  state.randomPolyline = await animatePolyline(
    state.randomRoute, '#ff3860', 'glowing-red',
    `Random: ${state.randomDist.toFixed(2)} km`
  );

  updateStatUI();
  setStatus('COMPARED', '#9b5de5');
  const saved = ((state.randomDist - state.optimizedDist) / state.randomDist * 100).toFixed(1);
  log(`📊 Random: ${state.randomDist.toFixed(2)} km vs Optimized: ${state.optimizedDist.toFixed(2)} km — Saved ${saved}%!`, 'success');
});

// ── Button: Start Simulation ───────────────────────
document.getElementById('btnSimulate').addEventListener('click', async () => {
  if (!document.getElementById('toggleSimulation').checked) {
    log('⚠️  Simulation Mode is OFF. Enable it in the header toggles.', 'warning'); return;
  }
  if (!state.optimizedRoute.length) {
    log('⚠️  Run Optimize Route first!', 'warning'); return;
  }
  if (state.isSimulating) {
    log('⚠️  Simulation already running!', 'warning'); return;
  }

  resetSteps();
  await runDeliverySimulation(state.optimizedRoute);
});

// ── Button: Generate Random Locations ─────────────
document.getElementById('btnRandom').addEventListener('click', () => {
  clearMap();

  // Random locations centered around a random Indian city
  const cities = [
    { lat: 28.6139, lng: 77.2090 }, // Delhi
    { lat: 19.0760, lng: 72.8777 }, // Mumbai
    { lat: 12.9716, lng: 77.5946 }, // Bangalore
    { lat: 22.5726, lng: 88.3639 }, // Kolkata
    { lat: 13.0827, lng: 80.2707 }, // Chennai
  ];
  const city = cities[Math.floor(Math.random() * cities.length)];
  const spread = 0.35;
  const count = 6 + Math.floor(Math.random() * 5); // 6–10 stops

  map.setView([city.lat, city.lng], 11);

  for (let i = 0; i < count; i++) {
    const lat = city.lat + (Math.random() - 0.5) * spread;
    const lng = city.lng + (Math.random() - 0.5) * spread;
    addLocation(lat, lng);
  }

  log(`🎲 Generated ${count} random locations`, 'info');
});

// ── Button: Clear Map ──────────────────────────────
document.getElementById('btnClear').addEventListener('click', clearMap);

function clearMap() {
  // Remove all markers
  state.locationMarkers.forEach(m => map.removeLayer(m));
  if (state.optimizedPolyline) map.removeLayer(state.optimizedPolyline);
  if (state.randomPolyline)    map.removeLayer(state.randomPolyline);
  if (state.agentMarker)       map.removeLayer(state.agentMarker);

  // Reset state
  Object.assign(state, {
    locations: [],
    distMatrix: [],
    optimizedRoute: [],
    randomRoute: [],
    optimizedDist: 0,
    randomDist: 0,
    isSimulating: false,
    agentMarker: null,
    optimizedPolyline: null,
    randomPolyline: null,
    locationMarkers: [],
  });

  // Reset select
  const sel = document.getElementById('startSelect');
  sel.innerHTML = '<option value="0">Warehouse (Default)</option>';

  // Reset route sequence
  document.getElementById('routeSequence').innerHTML = '<span class="seq-empty">Run optimization to see route</span>';

  // Reset stats
  ['statLocations','statOptDist','statRandDist','statSaved','statTime'].forEach(id => {
    document.getElementById(id).textContent = id === 'statLocations' ? '0' : '—';
  });

  // Reset steps
  resetSteps();

  // Show hint overlay
  document.getElementById('mapHint').classList.remove('hidden');

  // Reset log
  const logEl = document.getElementById('deliveryLog');
  logEl.innerHTML = '<div class="log-entry log-info">> Map cleared. Ready for new session.</div>';

  setStatus('READY', '#00c8ff');
}

// ── Toggle: Show/Hide Random Route ────────────────
document.getElementById('toggleRandom').addEventListener('change', function() {
  if (!state.randomPolyline) return;
  if (this.checked) {
    state.randomPolyline.addTo(map);
  } else {
    map.removeLayer(state.randomPolyline);
  }
});

// ── Toggle: Simulation Mode ────────────────────────
document.getElementById('toggleSimulation').addEventListener('change', function() {
  log(`🔧 Simulation mode ${this.checked ? 'ON' : 'OFF'}`, 'info');
});
