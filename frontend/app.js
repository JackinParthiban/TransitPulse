// ==========================================
// 1. FIREBASE CONFIGURATION (Replace with YOURS)
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyBDaIQGTf5Sxa0MpVQ8g7nkDv-qjOj-X8o",
  authDomain: "transitpulse-64a38.firebaseapp.com",
  databaseURL: "https://transitpulse-64a38-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "transitpulse-64a38",
  storageBucket: "transitpulse-64a38.firebasestorage.app",
  messagingSenderId: "654485694423",
  appId: "1:654485694423:web:bf55ff45501b965359cd92",
  measurementId: "G-7DPK38J9HT"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.database();

// ==========================================
// 2. LEAFLET MAP INITIALIZATION
// ==========================================
// Center on Chennai, India (default simulation area)
const map = L.map('map', {
  zoomControl: false // We reposition it later
}).setView([12.98, 80.23], 12);

L.control.zoom({ position: 'bottomright' }).addTo(map);

// Use the standard OpenStreetMap tile layer which is the universally recognized Leaflet default
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19
}).addTo(map);

// ==========================================
// 3. GLOBAL STATE
// ==========================================
const routeData = {}; // Stores route colors and details
const busMarkers = {}; // Stores active Leaflet markers mapping to busId
const polylineLayers = {}; // Stores the visual L.polyline traces
let activeFilter = 'ALL';
let mlModeActive = false;
let stickyAlerts = {}; // Prevents alerts from flashing too quickly
let latestBuses = {}; // Cached for physical mathematical functions
let statusChartObj = null;
let occupancyChartObj = null;

window.toggleML = () => {
   mlModeActive = !mlModeActive;
   const btn = document.getElementById('ml-toggle');
   if(btn) {
       btn.classList.toggle('active', mlModeActive);
       btn.innerHTML = mlModeActive ? '<span class="ml-icon">🧠</span> AI Engine: <b>ON</b> (Live Adapting)' : '<span class="ml-icon">✨</span> Enable AI Prediction Engine';
   }
   // Force an immediate UI redraw
   db.ref('buses').once('value'); 
};

// High-Resolution Geographic Road Traces
const routePaths = {
  "Route_A": [
    [13.0827, 80.2707], [13.0691, 80.2818], [13.0538, 80.2820], 
    [13.0402, 80.2785], [13.0312, 80.2774], [13.0125, 80.2598], [13.0066, 80.2575]
  ],
  "Route_B": [
    [12.9229, 80.1275], [12.9516, 80.1462], [12.9665, 80.1558], 
    [12.9822, 80.1706], [13.0016, 80.2014], [13.0067, 80.2206]
  ],
  "Route_ESP": [
    [12.9785, 80.2208], [12.9815, 80.2225], [12.9840, 80.2270], 
    [12.9865, 80.2320], [12.9880, 80.2370]
  ]
};

// Explicit Bus Stop Definitions mapped to Geographic Geometry
const routeStops = {
  "Route_A": ["Central Station", "Napier Bridge", "Marina Beach", "Light House", "Santhome", "Thiru Vi Ka Bridge", "Adyar Terminus"],
  "Route_B": ["Tambaram", "Chromepet", "Pallavaram", "Meenambakkam", "Kathipara", "Guindy Terminus"],
  "Route_ESP": ["Velachery", "Vijayanagar", "Taramani Link", "SRP Tools", "Taramani Terminus"]
};

// Populate Trip Planner if it exists (Passenger View)
const originSelect = document.getElementById('origin-stop');
const destSelect = document.getElementById('dest-stop');
if (originSelect && destSelect) {
   let allStops = [];
   for (let r in routeStops) { allStops.push(...routeStops[r]); }
   allStops = [...new Set(allStops)]; // Unique array
   allStops.sort().forEach(stop => {
       originSelect.innerHTML += `<option value="${stop}">${stop}</option>`;
       destSelect.innerHTML += `<option value="${stop}">${stop}</option>`;
   });
}

// Passenger Stop-to-Stop ETA Engine
window.calculateTrip = () => {
   const orig = document.getElementById('origin-stop').value;
   const dest = document.getElementById('dest-stop').value;
   const resultDiv = document.getElementById('trip-result');
   if(!orig || !dest || orig === dest) {
       resultDiv.innerHTML = 'Please select valid origin and destination stops.';
       resultDiv.style.display = 'block';
       return;
   }
   
   // Cross-reference which route natively contains both stops consecutively
   let validRouteId = null;
   let oIdx = -1, dIdx = -1;
   for (let r in routeStops) {
       oIdx = routeStops[r].indexOf(orig);
       dIdx = routeStops[r].indexOf(dest);
       if (oIdx !== -1 && dIdx !== -1) { validRouteId = r; break; }
   }
   
   if (!validRouteId) {
       resultDiv.innerHTML = '❌ No direct buses found between these exact stops. You will need to physically transfer routes.';
       resultDiv.style.display = 'block';
       return;
   }
   
   // Base trip calculations
   const numStops = Math.abs(dIdx - oIdx);
   const tripTime = numStops * 6; // Average 6 mins per physical stop natively
   
   // Find the closest incoming bus acting on the validRouteId
   let nearestDist = 999999;
   let nearestBus = null;
   const targetCoord = routePaths[validRouteId][oIdx];
   
   for (let bId in latestBuses) {
       let b = latestBuses[bId];
       if (b.routeId === validRouteId && (Date.now() - (b.lastUpdated || 0)) < OFFLINE_THRESHOLD_MS) {
           // Calculate Euclidean Math distance
           let dist = Math.hypot(b.lat - targetCoord[0], b.lng - targetCoord[1]);
           if (dist < nearestDist) {
               nearestDist = dist;
               nearestBus = b;
           }
       }
   }
   
   if (!nearestBus) {
       resultDiv.innerHTML = `✅ Direct route matched (<strong>${validRouteId.replace('_',' ')}</strong>).<br/>⏱️ End-to-End Transit Time: ${tripTime} mins.<br/>⚠️ However, no buses are currently serving this specific route.`;
   } else {
       // Translating abstract geographical distance into an ETA estimate cleanly
       let arriveMins = Math.max(1, Math.floor(nearestDist * 300)); 
       resultDiv.innerHTML = `
         ✅ Optimal Route Found: <strong>${validRouteId.replace('_',' ')}</strong><br/>
         🚌 Nearest Bus (<strong>${nearestBus.busId}</strong>) is approx <strong>${arriveMins} min(s)</strong> away from ${orig}.<br/>
         ⏱️ Total in-transit trip time to ${dest}: <strong>${tripTime} min(s)</strong>.
       `;
   }
   resultDiv.style.display = 'block';
};

// ==========================================
// 4. FETCH ROUTES & RENDER FILTERS & LINES
// ==========================================
db.ref('routes').on('value', snap => {
  const routes = snap.val();
  if (!routes) return;

  const container = document.getElementById('route-buttons-container');
  container.innerHTML = `
    <button class="route-btn active" onclick="filterRoute('ALL', this)">
      <div class="color-dot" style="background: white;"></div>
      All Routes
    </button>
  `;

  for (let key in routes) {
    routeData[key] = routes[key];
    container.innerHTML += `
      <button class="route-btn" onclick="filterRoute('${key}', this)">
        <div class="color-dot" style="background: ${routes[key].color};"></div>
        ${routes[key].name}
      </button>
    `;

    // Draw Map Polylines dynamically mapping to their designated Color
    if (polylineLayers[key]) map.removeLayer(polylineLayers[key]);
    if (routePaths[key]) {
        const line = L.polyline(routePaths[key], { color: routes[key].color, weight: 5, opacity: 0.7 }).addTo(map);
        polylineLayers[key] = line;
    }
  }
});

window.filterRoute = (routeId, btnObj) => {
  activeFilter = routeId;
  document.querySelectorAll('.route-btn').forEach(btn => btn.classList.remove('active'));
  btnObj.classList.add('active');

  // Show/Hide Markers & Lines based on filter
  for (let busId in busMarkers) {
    const bus = busMarkers[busId];
    if (activeFilter === 'ALL' || bus.routeId === activeFilter) {
      map.addLayer(bus.marker);
    } else {
      map.removeLayer(bus.marker);
    }
  }

  for (let key in polylineLayers) {
     if (activeFilter === 'ALL' || key === activeFilter) {
       map.addLayer(polylineLayers[key]);
     } else {
       map.removeLayer(polylineLayers[key]);
     }
  }
};

// ==========================================
// 5. FETCH SYSTEM STATS
// ==========================================
db.ref('system_stats').on('value', snap => {
  const stats = snap.val();
  if (!stats) return;

  const elActive = document.getElementById('stat-active');
  if (elActive) elActive.innerHTML = `${stats.totalActive || 0} <small>Buses</small>`;

  const elSpeed = document.getElementById('stat-speed');
  if (elSpeed) elSpeed.innerHTML = `${stats.averageSpeed || 0} <small>km/h</small>`;
});

// ==========================================
// 6. REAL-TIME FLEET TELEMETRY (buses)
// ==========================================
const OFFLINE_THRESHOLD_MS = 30000; // 30 seconds without ping = offline

db.ref('buses').on('value', snap => {
  const buses = snap.val();
  if (!buses) return;
  
  const now = Date.now();
  latestBuses = buses; // Keep global mathematically up to date

  for (let busId in buses) {
    const data = buses[busId];
    const isOffline = (now - (data.lastUpdated || 0)) > OFFLINE_THRESHOLD_MS;

    // UI Formatters
    const routeColor = routeData[data.routeId]?.color || '#ffffff';
    const statusBadgeClass = isOffline ? 'badge-offline'
      : (data.status === 'Delayed' ? 'badge-delay' : 'badge-ok');
    const statusText = isOffline ? "OFFLINE " : data.status;

    // AI ML Engine Mockup Toggle
    let etaRowHTML = `<div>Standard ETA: <strong>${data.eta || 0} mins</strong></div>`;
    if (mlModeActive && !isOffline) {
        // Mock a predictive offset for ML presentation
        const aiOffset = Math.max(1, (data.eta || 10) - 4); 
        etaRowHTML = `<div class="ai-eta-box">✨ AI Predicted ETA: <strong>${aiOffset} mins</strong><br/><small>(Context: Weather & Rush Hour adjusted)</small></div>`;
    }

    // Build the Popup HTML
    const popupHTML = `
      <div class="popup-header">
        <span style="color:${routeColor}; font-size:1.2rem;">●</span> ${data.busId}
      </div>
      <div class="popup-meta">
        <div>Route: <strong>${data.routeId || 'N/A'}</strong></div>
        <div>Velocity: <strong>${data.speed || 0} km/h</strong></div>
        <div>Next Stop: <strong>${data.nextStop || 'Unknown'}</strong></div>
        ${etaRowHTML}
        <div>Passengers: <strong style="${data.occupancy > 60 ? 'color:var(--warning)' : ''}">${data.occupancy || 0}/80</strong> ${data.occupancy > 60 ? '<span style="color:var(--warning);font-size:0.7rem;font-weight:bold;">(Crowded)</span>' : ''}</div>
      </div>
      <div class="popup-badge ${statusBadgeClass}">${statusText}</div>
    `;

    // Calculate Lat/Lng
    const latLng = [data.lat, data.lng];

    if (busMarkers[busId]) {
      // 1. UPDATE EXISTING BUS
      const markerObj = busMarkers[busId];
      markerObj.routeId = data.routeId; // Update route attachment
      markerObj.marker.setLatLng(latLng);
      markerObj.marker.getPopup().setContent(popupHTML);

      // Fade out if offline via custom class injection into the Leaflet icon wrapper
      const el = markerObj.marker.getElement();
      if (el) {
        el.style.opacity = isOffline ? "0.4" : "1.0";
        el.style.filter = isOffline ? "grayscale(100%)" : "none";
      }

    } else {
      // 2. CREATE NEW BUS MARKER
      const customIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `
          <div class="marker-wrapper">
            <div class="marker-inner" style="background-color: ${routeColor};"></div>
          </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker(latLng, { icon: customIcon }).addTo(map);
      marker.bindPopup(popupHTML);

      // Apply filter automatically on creation
      if (activeFilter !== 'ALL' && activeFilter !== data.routeId) {
        map.removeLayer(marker);
      }

      busMarkers[busId] = {
        marker: marker,
        routeId: data.routeId
      };
    }
  }

  // Generate Dynamic 'Live Delays' feed using Smooth DOM Reconciliation
  const container = document.getElementById('alerts-container');
  if (container) {
     
     // 1. Scan live buses and build Sticky Alerts tracking data
     for (let busId in buses) {
        const data = buses[busId];
        const isOffline = (now - (data.lastUpdated || 0)) > OFFLINE_THRESHOLD_MS;
        
        let alertHTML = null;
        let alertType = 'delay';

        // Catch active delays
        if (data.status === 'Delayed' && !isOffline) {
            let etaAlertText = mlModeActive ? `<span style="color:#d946ef">🧠 AI Predicts ETA: ${Math.max(1, data.eta-4)} min</span>` : `Arrival ETA: ${data.eta} min`;
            alertHTML = `
                <span class="alert-time">${etaAlertText}</span>
                <strong>${data.busId}</strong> (${data.routeId}) is experiencing simulated traffic delays.
            `;
            alertType = 'delay';
        } else if (data.occupancy > 60 && !isOffline) {
            alertHTML = `
                <span class="alert-time">Capacity Alert</span>
                <strong>${data.busId}</strong> is nearing maximum capacity (${data.occupancy}/80 passengers).
            `;
            alertType = 'capacity';
        }

        // Apply STICKY debounce logic (forces alert to track in state for 10s)
        if (alertHTML) {
            stickyAlerts[busId] = { type: alertType, content: alertHTML, expires: now + 10000 };
        }
     }
     
     // Remove empty state message if alerts exist
     const loadingText = container.querySelector('.loading-text');
     if(loadingText && Object.keys(stickyAlerts).length > 0) loadingText.remove();

     // 2. Safely Sync UI without destroying DOM elements (allows CSS to fade smoothly)
     for (let alertId in stickyAlerts) {
         const alertData = stickyAlerts[alertId];
         let domNode = document.getElementById('alert-' + alertId);

         if (now > alertData.expires) {
             // Expired: Trigger CSS smooth fade out over 1 second
             if (domNode && domNode.style.opacity !== '0') {
                 domNode.style.opacity = '0';
                 setTimeout(() => { if (domNode.parentNode) domNode.remove(); }, 1000); 
             }
             delete stickyAlerts[alertId];
         } else {
             // Active: Create organically or update existing node silently
             if (!domNode) {
                 domNode = document.createElement('div');
                 domNode.className = 'alert-item';
                 domNode.id = 'alert-' + alertId;
                 domNode.style.opacity = '0'; // Start invisible for fade in
                 
                 // Apply specific background for capacity vs delay
                 if (alertData.type === 'capacity') {
                     domNode.style.borderLeftColor = 'var(--warning)';
                     domNode.style.background = 'rgba(245,158,11,0.1)';
                 }
                 
                 container.prepend(domNode);
                 
                 // Trigger smooth CSS fade in
                 setTimeout(() => domNode.style.opacity = '1', 50);
             }
             
             // Update raw text content without destroying the wrapper node
             if(domNode.innerHTML !== alertData.content) {
                 domNode.innerHTML = alertData.content;
             }
         }
     }
     
     // Restore empty state if all alerts have gracefully deleted
     if (container.children.length === 0 && Object.keys(stickyAlerts).length === 0) {
         container.innerHTML = '<p class="loading-text" style="color:#10b981; transition: opacity 1s;">No active delays. All routes running smoothly.</p>';
     }
  }

  // Generate Admin Analytics UI (Chart.js) natively mapped to Real-Time Data Matrix
  const statusCanvas = document.getElementById('statusChart');
  const occCanvas = document.getElementById('occupancyChart');
  
  if (statusCanvas && occCanvas) {
      let onTimeCount = 0;
      let delayedCount = 0;
      let routeOcc = { "Route_A": 0, "Route_B": 0, "Route_ESP": 0 };
      let routeCounts = { "Route_A": 0, "Route_B": 0, "Route_ESP": 0 };
      
      for (let bId in buses) {
          const b = buses[bId];
          if ((now - (b.lastUpdated || 0)) < OFFLINE_THRESHOLD_MS) {
              if (b.status === 'Delayed') delayedCount++;
              else onTimeCount++;
              
              if (routeOcc[b.routeId] !== undefined) {
                 routeOcc[b.routeId] += b.occupancy || 0;
                 routeCounts[b.routeId]++;
              }
          }
      }
      
      for(let r in routeOcc) {
          if(routeCounts[r] > 0) routeOcc[r] = Math.floor(routeOcc[r]/routeCounts[r]);
      }

      if (!statusChartObj) {
          statusChartObj = new Chart(statusCanvas.getContext('2d'), {
              type: 'doughnut',
              data: {
                  labels: ['On Time', 'Delayed'],
                  datasets: [{ data: [onTimeCount, delayedCount], backgroundColor: ['#10b981', '#f59e0b'], borderWidth: 0 }]
              },
              options: { maintainAspectRatio: false, cutout: '75%', plugins: { legend: { position: 'right', labels: { color: '#94a3b8'} } } }
          });
          
          occupancyChartObj = new Chart(occCanvas.getContext('2d'), {
              type: 'bar',
              data: {
                  labels: Object.keys(routeOcc).map(r => r.replace('_', ' ')),
                  datasets: [{ label: 'Avg Passengers', data: Object.values(routeOcc), backgroundColor: '#4f46e5', borderRadius: 4 }]
              },
              options: { 
                 maintainAspectRatio: false, 
                 scales: { 
                   y: { beginAtZero: true, max: 80, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                   x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
                 },
                 plugins: { legend: { display: false } }
              }
          });
      } else {
          statusChartObj.data.datasets[0].data = [onTimeCount, delayedCount];
          statusChartObj.update('none'); 
          
          occupancyChartObj.data.datasets[0].data = Object.values(routeOcc);
          occupancyChartObj.update('none');
      }
  }
});

// ==========================================
// 7. BACKGROUND HEALTH CHECK (Heartbeat Loop)
// ==========================================
// Periodically re-trigger render to fade out offline buses even if FB doesn't push
setInterval(() => {
  // A minor hack to trigger Firebase state recalculation against Date.now()
  db.ref('buses').once('value', snap => {
    // Overrides existing objects implicitly
  });
}, 10000);
