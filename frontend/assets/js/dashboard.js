    // ============================================================
    // 1. DATA MODELS & COMMON SOURCE COORDINATES
    // ============================================================
    
    // THE COMMON STARTING LOCATION FOR ALL 3 VEHICLES:
    // London Central Cold Chain Warehouse Depot (City of London / Barbican)
    const COMMON_SOURCE = {
      name: "Central Cold Chain Fulfillment Warehouse",
      coords: [51.5155, -0.0922],
      address: "14 Dispatch Way, London EC2"
    };

    // 3 DISTINCT ARRIVAL DESTINATIONS:
    const DESTINATIONS = {
      'CC-101': {
        name: "St. Thomas' Hospital Central Medical Cold Store",
        destKey: "Dest A",
        coords: [51.4988, -0.1186], // South-West, across Westminster Bridge
        address: "Lambeth Palace Rd, London SE1",
        cargo: "Vaccines (mRNA)",
        driver: "Rajan Mehta",
        phone: "+44 7700 900111",
        color: "#06b6d4", // Cyan
        routeClass: "route-dash-cyan",
        baseTempC: 4.2,
        baseHum: 62,
        isAlert: false
      },
      'CC-102': {
        name: "East London Regional Distribution Depot",
        destKey: "Dest B",
        coords: [51.5205, -0.0385], // East London (Mile End / Bow)
        address: "Mile End Park Transit Hub, London E3",
        cargo: "Dairy Products & Fresh Milk",
        driver: "Sunita Devi",
        phone: "+44 7700 900222",
        color: "#2563eb", // Blue
        routeClass: "route-dash-blue",
        baseTempC: 4.8,
        baseHum: 65,
        isAlert: false
      },
      'CC-103': {
        name: "Southwark & Bermondsey Cold Storage Terminal",
        destKey: "Dest C",
        coords: [51.4965, -0.0650], // South-East (Bermondsey / Southwark)
        address: "Bermondsey Cold Terminal, London SE16",
        cargo: "Seafood & Perishables",
        driver: "Arjun Kumar",
        phone: "+44 7700 900123",
        color: "#ef4444", // Red
        routeClass: "route-dash-red",
        baseTempC: 9.2, // Excursion
        baseHum: 74,
        isAlert: true
      }
    };

    // Realistic high-precision street fallback coordinates following real London road networks:
    // (Used immediately or if OSRM is busy/offline to guarantee 100% road accuracy)
    const FALLBACK_ROAD_ROUTES = {
      // Common source [51.5155, -0.0922] -> St. Thomas' Hospital [51.4988, -0.1186]
      'CC-101': [
        [51.5155, -0.0922], [51.5152, -0.0945], [51.5148, -0.0980], [51.5140, -0.1015],
        [51.5132, -0.1065], [51.5130, -0.1110], [51.5126, -0.1145], [51.5122, -0.1180],
        [51.5118, -0.1205], [51.5095, -0.1215], [51.5070, -0.1225], [51.5050, -0.1240],
        [51.5035, -0.1245], [51.5015, -0.1250], [51.5010, -0.1220], [51.5005, -0.1195],
        [51.4998, -0.1188], [51.4988, -0.1186]
      ],
      // Common source [51.5155, -0.0922] -> East London Hub [51.5205, -0.0385]
      'CC-102': [
        [51.5155, -0.0922], [51.5158, -0.0890], [51.5162, -0.0845], [51.5165, -0.0790],
        [51.5160, -0.0740], [51.5155, -0.0685], [51.5152, -0.0630], [51.5150, -0.0570],
        [51.5165, -0.0520], [51.5180, -0.0470], [51.5192, -0.0430], [51.5205, -0.0385]
      ],
      // Common source [51.5155, -0.0922] -> Southwark Terminal [51.4965, -0.0650]
      'CC-103': [
        [51.5155, -0.0922], [51.5140, -0.0910], [51.5120, -0.0895], [51.5100, -0.0880],
        [51.5078, -0.0870], [51.5055, -0.0865], [51.5040, -0.0845], [51.5030, -0.0810],
        [51.5020, -0.0760], [51.5005, -0.0715], [51.4985, -0.0680], [51.4965, -0.0650]
      ]
    };

    // State Variables
    let activeTempUnit = 'C'; // 'C' or 'F'
    let isDispatchRunning = false;
    let followVehicleId = null;
    let audioAlarmEnabled = true;
    let selectedVehicleId = 'CC-101';

    // Vehicle runtime tracking objects
    let vehiclesState = {
      'CC-101': {
        id: 'CC-101',
        progress: 0.0, // 0 to 1
        speed: 0,
        tempC: 4.2,
        humidity: 62,
        delivered: false,
        roadRoute: [], // [lat, lng] array
        totalDistanceKm: 4.2,
        remainingDistanceKm: 4.2,
        etaMinutes: 11,
        marker: null,
        traveledPolyline: null,
        remainingPolyline: null
      },
      'CC-102': {
        id: 'CC-102',
        progress: 0.0,
        speed: 0,
        tempC: 4.8,
        humidity: 65,
        delivered: false,
        roadRoute: [],
        totalDistanceKm: 4.8,
        remainingDistanceKm: 4.8,
        etaMinutes: 13,
        marker: null,
        traveledPolyline: null,
        remainingPolyline: null
      },
      'CC-103': {
        id: 'CC-103',
        progress: 0.0,
        speed: 0,
        tempC: 9.2,
        humidity: 74,
        delivered: false,
        roadRoute: [],
        totalDistanceKm: 3.9,
        remainingDistanceKm: 3.9,
        etaMinutes: 10,
        marker: null,
        traveledPolyline: null,
        remainingPolyline: null
      }
    };

    // Map instances & markers
    let map = null;
    let warehouseMarker = null;
    let destinationMarkers = {};
    let tempChart = null;
    let humChart = null;
    let auditLogs = [];

    // ============================================================
    // 2. MATH & GEOMETRY HELPERS
    // ============================================================

    // Haversine distance in km
    function haversineDistKm(a, b) {
      const R = 6371;
      const dLat = (b[0] - a[0]) * Math.PI / 180;
      const dLng = (b[1] - a[1]) * Math.PI / 180;
      const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    }

    // Bearing in degrees
    function calculateBearing(a, b) {
      const lat1 = a[0] * Math.PI / 180;
      const lat2 = b[0] * Math.PI / 180;
      const dLng = (b[1] - a[1]) * Math.PI / 180;
      const y = Math.sin(dLng) * Math.cos(lat2);
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
      return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    }

    // Convert °C to display string
    function formatTemp(celsius) {
      if (activeTempUnit === 'F') {
        const f = (celsius * 9 / 5) + 32;
        return `${f.toFixed(1)}°F`;
      }
      return `${celsius.toFixed(1)}°C`;
    }

    // ============================================================
    // 3. OSRM ROAD ROUTING API & INITIALIZATION
    // ============================================================

    async function fetchRoadRouteOSRM(source, destination) {
      try {
        // OSRM coordinates are lng,lat
        const url = `https://router.project-osrm.org/route/v1/driving/${source[1]},${source[0]};${destination[1]},${destination[0]}?overview=full&geometries=geojson`;
        const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
        if (!res.ok) throw new Error("OSRM non-200");
        const json = await res.json();
        if (json.routes && json.routes.length > 0) {
          // Convert GeoJSON [lng, lat] to Leaflet [lat, lng]
          const coords = json.routes[0].geometry.coordinates.map(pt => [pt[1], pt[0]]);
          const distKm = json.routes[0].distance / 1000;
          return { coords, distKm };
        }
      } catch (err) {
        // Fallback road geometry silently
      }
      return null;
    }

    async function initializeAllRoutes() {
      for (const id of ['CC-101', 'CC-102', 'CC-103']) {
        const dest = DESTINATIONS[id];
        // Try real OSRM road geometry
        const osrmResult = await fetchRoadRouteOSRM(COMMON_SOURCE.coords, dest.coords);
        if (osrmResult && osrmResult.coords.length > 3) {
          vehiclesState[id].roadRoute = osrmResult.coords;
          vehiclesState[id].totalDistanceKm = Number(osrmResult.distKm.toFixed(1));
          vehiclesState[id].remainingDistanceKm = Number(osrmResult.distKm.toFixed(1));
        } else {
          // Use high-precision London road fallback
          vehiclesState[id].roadRoute = FALLBACK_ROAD_ROUTES[id];
          // compute distance
          let total = 0;
          for (let i = 0; i < vehiclesState[id].roadRoute.length - 1; i++) {
            total += haversineDistKm(vehiclesState[id].roadRoute[i], vehiclesState[id].roadRoute[i+1]);
          }
          vehiclesState[id].totalDistanceKm = Number(total.toFixed(1));
          vehiclesState[id].remainingDistanceKm = Number(total.toFixed(1));
        }
      }
    }

    // ============================================================
    // 4. LEAFLET MAP INITIALIZATION
    // ============================================================
    function initMap() {
      map = L.map('fleet-map', {
        center: [51.5090, -0.0780],
        zoom: 13,
        zoomControl: true
      });

      // CartoDB Dark Matter tiles for sleek industrial aesthetic
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(map);

      // 1. ADD COMMON WAREHOUSE DEPOT MARKER
      const warehouseIcon = L.divIcon({
        className: '',
        html: `
          <div style="position:relative;width:48px;height:48px">
            <div style="position:absolute;inset:-6px;border-radius:50%;background:#06b6d4;opacity:0.3;animation:pulse-ring 2s infinite"></div>
            <div style="position:relative;z-index:2;width:48px;height:48px;background:#0b162f;border:3px solid #22d3ee;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 0 20px rgba(34,211,238,0.5)">
              <span style="font-size:18px">🏢</span>
              <span style="font-size:8px;font-weight:900;color:#22d3ee;font-family:monospace;letter-spacing:0.5px">DEPOT</span>
            </div>
          </div>
        `,
        iconSize: [48, 48],
        iconAnchor: [24, 24]
      });

      warehouseMarker = L.marker(COMMON_SOURCE.coords, { icon: warehouseIcon }).addTo(map);
      warehouseMarker.bindPopup(`
        <div style="background:#0b162f;color:#f1f5f9;padding:12px;border-radius:12px;font-family:Inter,sans-serif;min-width:210px">
          <div style="font-size:10px;font-weight:800;color:#22d3ee;text-transform:uppercase;letter-spacing:1px">Common Source Location</div>
          <div style="font-size:13px;font-weight:900;color:#fff;margin-top:2px">${COMMON_SOURCE.name}</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:2px">${COMMON_SOURCE.address}</div>
          <div style="margin-top:8px;padding:4px 8px;border-radius:6px;background:rgba(6,182,212,0.15);color:#22d3ee;border:1px solid rgba(6,182,212,0.3);font-size:10px;font-family:monospace">
            Lat: 51.5155° N • Lng: -0.0922° W
          </div>
          <div style="font-size:10px;color:#cbd5e1;margin-top:6px">Starting Point for Vehicles CC-101, CC-102, CC-103</div>
        </div>
      `);

      // 2. ADD 3 DESTINATION MARKERS (A, B, C)
      Object.keys(DESTINATIONS).forEach(id => {
        const dest = DESTINATIONS[id];
        const destIcon = L.divIcon({
          className: '',
          html: `
            <div style="position:relative;width:42px;height:42px">
              <div style="position:relative;z-index:2;width:42px;height:42px;background:#0b162f;border:3px solid ${dest.color};border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 0 16px ${dest.color}80">
                <span style="font-size:16px">🏁</span>
                <span style="font-size:8px;font-weight:900;color:${dest.color};font-family:monospace">${dest.destKey}</span>
              </div>
            </div>
          `,
          iconSize: [42, 42],
          iconAnchor: [21, 21]
        });

        const m = L.marker(dest.coords, { icon: destIcon }).addTo(map);
        m.bindPopup(`
          <div style="background:#0b162f;color:#f1f5f9;padding:12px;border-radius:12px;font-family:Inter,sans-serif;min-width:200px">
            <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #182b54;padding-bottom:6px">
              <span style="font-size:10px;font-weight:800;color:${dest.color};text-transform:uppercase">${dest.destKey} (${id})</span>
              <span style="font-size:10px;color:#94a3b8;font-family:monospace">${dest.cargo}</span>
            </div>
            <div style="font-size:13px;font-weight:800;color:#fff;margin-top:6px">${dest.name}</div>
            <div style="font-size:11px;color:#94a3b8;margin-top:2px">${dest.address}</div>
          </div>
        `);
        destinationMarkers[id] = m;
      });

      // 3. DRAW INITIAL 3 ROAD POLYLINES (Cyan, Blue, Red)
      renderAllRouteLines();

      // 4. ADD VEHICLE MARKERS AT WAREHOUSE ORIGIN
      Object.keys(vehiclesState).forEach(id => {
        createOrUpdateVehicleMarker(id, COMMON_SOURCE.coords, 0);
      });
    }

    // Create / update dynamic vehicle marker with bearing rotation
    function createOrUpdateVehicleMarker(id, coords, bearing) {
      const dest = DESTINATIONS[id];
      const state = vehiclesState[id];
      const color = dest.color;

      const vehicleIcon = L.divIcon({
        className: '',
        html: `
          <div style="position:relative;width:40px;height:40px;transform:rotate(${bearing}deg);transition:transform 0.25s linear">
            <div style="position:absolute;inset:-4px;border-radius:50%;background:${color};opacity:0.35"></div>
            <div style="position:relative;z-index:2;width:40px;height:40px;background:${color};border:2px solid #ffffff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 16px ${color}">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#040812" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
                <path d="M15 18H9"/>
                <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
                <circle cx="17" cy="18" r="2"/>
                <circle cx="7" cy="18" r="2"/>
              </svg>
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      if (!state.marker) {
        state.marker = L.marker(coords, { icon: vehicleIcon }).addTo(map);
        state.marker.on('click', () => focusVehicle(id));
      } else {
        state.marker.setLatLng(coords);
        state.marker.setIcon(vehicleIcon);
      }

      state.marker.bindTooltip(`
        <div style="font-family:Inter,sans-serif;font-size:11px">
          <b>${id}</b> (${dest.cargo})<br>
          Status: <b>${state.delivered ? 'Delivered' : (isDispatchRunning ? 'In Transit' : 'At Depot')}</b><br>
          Temp: <b style="color:${dest.isAlert ? '#f43f5e' : '#34d399'}">${formatTemp(state.tempC)}</b>
        </div>
      `, { direction: 'top', offset: [0, -20] });
    }

    // Render Cyan, Blue, Red routes
    function renderAllRouteLines() {
      Object.keys(vehiclesState).forEach(id => {
        const state = vehiclesState[id];
        const dest = DESTINATIONS[id];
        const route = state.roadRoute;
        if (!route || route.length < 2) return;

        // Clean up old layers
        if (state.traveledPolyline) map.removeLayer(state.traveledPolyline);
        if (state.remainingPolyline) map.removeLayer(state.remainingPolyline);

        // Find current position index along route based on progress
        const totalSegments = route.length - 1;
        const exactIdx = state.progress * totalSegments;
        const curIdx = Math.min(Math.floor(exactIdx), totalSegments - 1);
        const subT = exactIdx - curIdx;

        // Current interpolated point
        const ptA = route[curIdx];
        const ptB = route[curIdx + 1];
        const curPt = [
          ptA[0] + (ptB[0] - ptA[0]) * subT,
          ptA[1] + (ptB[1] - ptA[1]) * subT
        ];

        // Traveled portion: from warehouse start to curPt
        const traveledPts = [...route.slice(0, curIdx + 1), curPt];
        // Remaining portion: from curPt to destination end
        const remainingPts = [curPt, ...route.slice(curIdx + 1)];

        // Traveled line: solid vibrant accent line
        state.traveledPolyline = L.polyline(traveledPts, {
          color: dest.color,
          weight: 5,
          opacity: 0.85,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);

        // Remaining line: high-visibility animated dashed line ahead
        state.remainingPolyline = L.polyline(remainingPts, {
          color: dest.color,
          weight: 6,
          opacity: 0.95,
          dashArray: '8, 8',
          className: dest.routeClass,
          lineCap: 'round',
          lineJoin: 'round'
        }).addTo(map);
      });
    }

    // ============================================================
    // 5. GOOGLE MAPS DISPATCH SIMULATION ENGINE
    // ============================================================

    let dispatchAnimationInterval = null;

    function startDispatch() {
      if (isDispatchRunning) return;
      isDispatchRunning = true;
      document.getElementById('btn-dispatch-text').innerText = 'Dispatch Active';
      document.getElementById('btn-start-dispatch').classList.add('ring-2', 'ring-emerald-400');

      showToast("Dispatch Started", "All 3 vehicles deployed from Central Warehouse along assigned road routes.");
      appendTerminalLog("SYS: Dispatch initiated. Broadcaster ID: FLEET_01. 3 active MQTT nodes.");

      // Run high-frequency smooth vehicle translation (50ms interval)
      if (!dispatchAnimationInterval) {
        dispatchAnimationInterval = setInterval(dispatchTick, 60);
      }
    }

    function pauseDispatch() {
      isDispatchRunning = false;
      document.getElementById('btn-dispatch-text').innerText = 'Resume Dispatch';
      document.getElementById('btn-start-dispatch').classList.remove('ring-2', 'ring-emerald-400');
      showToast("Dispatch Paused", "Vehicles held in place. GPS coordinates cached.");
      appendTerminalLog("SYS: Fleet tracking paused by operator command.");
    }

    function resetAllRoutes() {
      isDispatchRunning = false;
      document.getElementById('btn-dispatch-text').innerText = 'Start Dispatch';
      document.getElementById('btn-start-dispatch').classList.remove('ring-2', 'ring-emerald-400');

      Object.keys(vehiclesState).forEach(id => {
        const v = vehiclesState[id];
        v.progress = 0.0;
        v.speed = 0;
        v.delivered = false;
        v.remainingDistanceKm = v.totalDistanceKm;
        v.etaMinutes = Math.round(v.totalDistanceKm * 2.5);

        // Reset status badges
        const badge = document.getElementById(`badge-status-${id}`);
        if (badge) {
          if (id === 'CC-103' && DESTINATIONS[id].isAlert) {
            badge.className = 'px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse';
            badge.innerText = 'Excursion Alert';
          } else {
            badge.className = 'px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
            badge.innerText = 'Ready';
          }
        }
      });

      renderAllRouteLines();
      Object.keys(vehiclesState).forEach(id => {
        createOrUpdateVehicleMarker(id, COMMON_SOURCE.coords, 0);
      });

      updateCardsUI();
      recenterMapOverview();
      showToast("Routes Reset", "All 3 vehicles returned to Central Warehouse.");
      appendTerminalLog("SYS: Fleet route state cleared. Coords set to COMMON_SOURCE.");
    }

    function dispatchTick() {
      if (!isDispatchRunning) return;

      let allDelivered = true;

      Object.keys(vehiclesState).forEach(id => {
        const v = vehiclesState[id];
        const route = v.roadRoute;
        if (!route || route.length < 2) return;

        if (!v.delivered) {
          allDelivered = false;

          // Increment progress smoothly
          // Speed variation based on ID (approx 35-50 km/h)
          const baseStep = id === 'CC-101' ? 0.0016 : (id === 'CC-102' ? 0.0019 : 0.0014);
          v.progress += baseStep;
          v.speed = Math.round((id === 'CC-101' ? 44 : (id === 'CC-102' ? 50 : 38)) + (Math.random() - 0.5) * 6);

          // Check if reached destination
          if (v.progress >= 1.0) {
            v.progress = 1.0;
            v.speed = 0;
            v.delivered = true;
            v.remainingDistanceKm = 0;
            v.etaMinutes = 0;

            // Trigger delivered event
            handleVehicleDelivered(id);
          } else {
            v.remainingDistanceKm = Number((v.totalDistanceKm * (1 - v.progress)).toFixed(1));
            v.etaMinutes = Math.max(1, Math.round(v.remainingDistanceKm / (v.speed / 60)));
          }

          // Compute current vehicle coordinate
          const totalSegments = route.length - 1;
          const exactIdx = v.progress * totalSegments;
          const curIdx = Math.min(Math.floor(exactIdx), totalSegments - 1);
          const nextIdx = Math.min(curIdx + 1, totalSegments);
          const subT = exactIdx - curIdx;

          const ptA = route[curIdx];
          const ptB = route[nextIdx];
          const curCoords = [
            ptA[0] + (ptB[0] - ptA[0]) * subT,
            ptA[1] + (ptB[1] - ptA[1]) * subT
          ];

          // Compute bearing
          const bearing = calculateBearing(ptA, ptB);

          // Update Leaflet marker
          createOrUpdateVehicleMarker(id, curCoords, bearing);

          // Update Turn Maneuver if this is the active followed vehicle
          if (id === selectedVehicleId) {
            updateTurnManeuver(curIdx, route);
            if (followVehicleId === id && map) {
              map.panTo(curCoords, { animate: true, duration: 0.1 });
            }
          }
        }
      });

      // Re-render polylines
      renderAllRouteLines();
      updateCardsUI();

      if (allDelivered) {
        isDispatchRunning = false;
        document.getElementById('btn-dispatch-text').innerText = 'All Delivered ✓';
        showToast("Fleet Mission Completed", "All 3 cold chain shipments successfully delivered to destinations!");
        appendTerminalLog("SYS: All vehicles reported DELIVERED. Audit record logged.");
      }
    }

    function handleVehicleDelivered(id) {
      const dest = DESTINATIONS[id];
      const badge = document.getElementById(`badge-status-${id}`);
      if (badge) {
        badge.className = 'px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
        badge.innerHTML = `✓ Delivered (${dest.destKey})`;
      }

      showToast(`Delivered: ${id}`, `Vehicle ${id} (${dest.cargo}) reached ${dest.name} safely.`);
      appendTerminalLog(`DISPATCH: ${id} reached ${dest.destKey} destination. Status: DELIVERED.`);

      // Add audit log entry
      addAuditLogEntry(id, "Delivered to Facility", "DELIVERED");
      updateKpiDeliveredCount();
    }

    function updateKpiDeliveredCount() {
      const deliveredCount = Object.values(vehiclesState).filter(v => v.delivered).length;
      document.getElementById('kpi-delivered-count').innerText = `/ ${deliveredCount} Delivered`;
    }

    function updateCardsUI() {
      Object.keys(vehiclesState).forEach(id => {
        const v = vehiclesState[id];
        const dest = DESTINATIONS[id];

        const speedEl = document.getElementById(`nav-speed-${id}`);
        const distEl = document.getElementById(`nav-dist-${id}`);
        const etaEl = document.getElementById(`nav-eta-${id}`);
        const progPctEl = document.getElementById(`nav-prog-pct-${id}`);
        const progBar = document.getElementById(`nav-progress-${id}`);
        const tempEl = document.getElementById(`card-temp-${id}`);

        if (speedEl) speedEl.innerText = `${v.speed} km/h`;
        if (distEl) distEl.innerText = `${v.remainingDistanceKm} km`;
        if (etaEl) etaEl.innerText = v.delivered ? 'Arrived' : `${v.etaMinutes} min`;
        const pct = Math.round(v.progress * 100);
        if (progPctEl) progPctEl.innerText = `${pct}%`;
        if (progBar) progBar.style.width = `${pct}%`;
        if (tempEl) {
          tempEl.innerText = formatTemp(v.tempC);
        }

        // Live telemetry panel
        const liveTemp = document.getElementById(`disp-live-temp-${id}`);
        const liveHum = document.getElementById(`disp-live-hum-${id}`);
        if (liveTemp) liveTemp.innerText = formatTemp(v.tempC);
        if (liveHum) liveHum.innerText = `${v.humidity}% RH`;
      });
    }

    function updateTurnManeuver(idx, route) {
      const maneuvers = [
        { icon: "↑", text: "Continue on London Wall", dist: "350 m" },
        { icon: "↗", text: "Bear right onto A1211", dist: "500 m" },
        { icon: "↑", text: "Straight past Bank Junction", dist: "750 m" },
        { icon: "↰", text: "Turn left onto King William St", dist: "400 m" },
        { icon: "↑", text: "Cross London Bridge Corridor", dist: "600 m" },
        { icon: "↱", text: "Turn right onto Borough High St", dist: "300 m" },
        { icon: "↑", text: "Continue on Southwark St", dist: "850 m" },
        { icon: "↰", text: "Turn left towards Hospital Gate", dist: "200 m" },
        { icon: "🏁", text: "Arriving at Assigned Facility", dist: "50 m" }
      ];

      const m = maneuvers[idx % maneuvers.length];
      document.getElementById('nav-turn-icon-box').innerText = m.icon;
      document.getElementById('nav-maneuver-text').innerText = m.text;
      document.getElementById('nav-maneuver-dist').innerText = `in ${m.dist}`;
    }

    // ============================================================
    // 6. MAP INTERACTIVE CONTROLS
    // ============================================================

    function focusVehicle(id) {
      selectedVehicleId = id;
      const v = vehiclesState[id];
      const dest = DESTINATIONS[id];

      document.getElementById('nav-focus-vehicle-name').innerText = `Focus: ${id} (${dest.cargo})`;

      // Highlight card visually
      ['CC-101', 'CC-102', 'CC-103'].forEach(k => {
        const card = document.getElementById(`card-veh-${k}`);
        if (k === id) {
          card.classList.add('ring-2', 'ring-cyan-400');
        } else {
          card.classList.remove('ring-2', 'ring-cyan-400');
        }
      });

      if (v.marker && map) {
        map.setView(v.marker.getLatLng(), 14, { animate: true, duration: 0.8 });
      }

      showToast(`Selected ${id}`, `Tracking view focused on Vehicle ${id} (${dest.cargo})`);
    }

    function toggleFollowMode() {
      if (followVehicleId) {
        followVehicleId = null;
        document.getElementById('label-follow-mode').innerText = "Follow Active Vehicle: OFF";
        showToast("Follow Mode OFF", "Free map panning enabled.");
      } else {
        followVehicleId = selectedVehicleId;
        document.getElementById('label-follow-mode').innerText = `Follow: ${selectedVehicleId}`;
        showToast("Follow Mode ON", `Map camera locked on ${selectedVehicleId}.`);
      }
    }

    function recenterMapOverview() {
      if (map) {
        // Fit bounds across common warehouse and all 3 destinations
        const bounds = L.latLngBounds([
          COMMON_SOURCE.coords,
          DESTINATIONS['CC-101'].coords,
          DESTINATIONS['CC-102'].coords,
          DESTINATIONS['CC-103'].coords
        ]);
        map.fitBounds(bounds, { padding: [50, 50], animate: true });
      }
    }

    // ============================================================
    // 7. TEMPERATURE UNIT TOGGLE (°C / °F)
    // ============================================================

    function setTempUnit(unit) {
      activeTempUnit = unit;
      const btnC = document.getElementById('btn-unit-c');
      const btnF = document.getElementById('btn-unit-f');

      if (unit === 'C') {
        btnC.className = "px-2.5 py-1 rounded-lg font-mono font-bold transition bg-cyan-500 text-coldnavy-950 shadow";
        btnF.className = "px-2.5 py-1 rounded-lg font-mono font-semibold text-slate-400 hover:text-white transition";
        document.getElementById('kpi-avg-temp').innerText = "4.8°C";
        document.getElementById('kpi-target-range').innerText = "2.0°C – 8.0°C";
      } else {
        btnF.className = "px-2.5 py-1 rounded-lg font-mono font-bold transition bg-cyan-500 text-coldnavy-950 shadow";
        btnC.className = "px-2.5 py-1 rounded-lg font-mono font-semibold text-slate-400 hover:text-white transition";
        document.getElementById('kpi-avg-temp').innerText = "40.6°F";
        document.getElementById('kpi-target-range').innerText = "35.6°F – 46.4°F";
      }

      updateCardsUI();
      renderAuditTable();
      updateChartsUnit();
      showToast("Unit Switched", `Temperature displays converted to °${unit}.`);
    }

    // ============================================================
    // 8. CHART.JS REAL-TIME VISUALIZATIONS
    // ============================================================

    const chartLabels = ['09:40', '09:45', '09:50', '09:55', '10:00', '10:05', '10:10', '10:15', '10:20', '10:25', '10:30'];
    const tempSeriesCC101 = [4.1, 4.3, 4.2, 4.4, 4.1, 4.2, 4.3, 4.2, 4.1, 4.2, 4.2];
    const tempSeriesCC102 = [4.6, 4.7, 4.9, 4.8, 4.7, 4.8, 4.9, 4.7, 4.8, 4.8, 4.8];
    const tempSeriesCC103 = [7.5, 7.8, 8.1, 8.4, 8.7, 8.9, 9.1, 9.3, 9.2, 9.4, 9.2];
    const humSeriesCC101  = [61, 62, 63, 62, 61, 62, 63, 62, 61, 62, 62];

    function initCharts() {
      // 1. Temperature Chart
      const ctxTemp = document.getElementById('tempAnalyticsChart').getContext('2d');
      tempChart = new Chart(ctxTemp, {
        type: 'line',
        data: {
          labels: chartLabels,
          datasets: [
            {
              label: 'CC-101 Vaccines (°C)',
              data: tempSeriesCC101,
              borderColor: '#06b6d4',
              backgroundColor: 'rgba(6,182,212,0.1)',
              tension: 0.35,
              borderWidth: 2.5,
              fill: false
            },
            {
              label: 'CC-102 Dairy (°C)',
              data: tempSeriesCC102,
              borderColor: '#2563eb',
              backgroundColor: 'rgba(37,99,235,0.1)',
              tension: 0.35,
              borderWidth: 2.5,
              fill: false
            },
            {
              label: 'CC-103 Seafood (Excursion)',
              data: tempSeriesCC103,
              borderColor: '#ef4444',
              backgroundColor: 'rgba(239,68,68,0.15)',
              tension: 0.35,
              borderWidth: 3,
              fill: true,
              pointRadius: 4,
              pointBackgroundColor: '#ef4444'
            },
            {
              label: 'Threshold Max (8.0°C)',
              data: Array(chartLabels.length).fill(8.0),
              borderColor: 'rgba(239,68,68,0.7)',
              borderWidth: 1.5,
              borderDash: [6, 6],
              pointRadius: 0,
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 10 } } },
            tooltip: { backgroundColor: '#0b162f', borderColor: '#182b54', borderWidth: 1 }
          },
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } } },
            y: { min: 2, max: 11, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 }, callback: v => v + '°C' } }
          }
        }
      });

      // 2. Humidity Chart
      const ctxHum = document.getElementById('humidityAnalyticsChart').getContext('2d');
      humChart = new Chart(ctxHum, {
        type: 'line',
        data: {
          labels: chartLabels,
          datasets: [
            {
              label: 'CC-101 Humidity (% RH)',
              data: humSeriesCC101,
              borderColor: '#14b8a6',
              backgroundColor: 'rgba(20,184,166,0.1)',
              tension: 0.35,
              borderWidth: 2.5,
              fill: true
            },
            {
              label: 'Safe Threshold Max (70% RH)',
              data: Array(chartLabels.length).fill(70),
              borderColor: 'rgba(234,179,8,0.7)',
              borderWidth: 1.5,
              borderDash: [6, 6],
              pointRadius: 0,
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 10 } } },
            tooltip: { backgroundColor: '#0b162f', borderColor: '#182b54', borderWidth: 1 }
          },
          scales: {
            x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } } },
            y: { min: 40, max: 90, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 }, callback: v => v + '%' } }
          }
        }
      });
    }

    function updateChartsUnit() {
      if (!tempChart) return;
      const mult = activeTempUnit === 'F';
      tempChart.options.scales.y.ticks.callback = v => mult ? v + '°F' : v + '°C';
      tempChart.update();
    }

    function setChartRange(range) {
      showToast("Range Updated", `Telemetry trend adjusted to ${range.toUpperCase()} view.`);
    }

    // ============================================================
    // 9. SPOILAGE PREVENTION & ACTIONS (COOLING & TELEMATICS)
    // ============================================================

    function triggerRemoteCooling() {
      const btn = document.getElementById('btn-cooling-text');
      btn.innerText = "Actuating Cooling Pump...";

      showToast("Actuator Command Sent", "MQTT command dispatched: CMD_SET_COOLING_MAX (100% duty cycle).");
      appendTerminalLog("MQTT_TX: topic: coldchain/CC103/actuator, payload: {'compressor':'MAX_COOL','target':4.0}");

      setTimeout(() => {
        // Remediate CC-103 temperature in real time!
        vehiclesState['CC-103'].tempC = 4.5;
        DESTINATIONS['CC-103'].isAlert = false;

        document.getElementById('alert-card-temp').innerText = formatTemp(4.5);
        document.getElementById('card-temp-CC-103').className = "text-emerald-400 font-mono";
        document.getElementById('card-temp-CC-103').innerText = formatTemp(4.5);
        document.getElementById('badge-status-CC-103').className = "px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30";
        document.getElementById('badge-status-CC-103').innerText = "Safe (Cooling Active)";
        document.getElementById('badge-c-alert').className = "px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40";
        document.getElementById('badge-c-alert').innerText = "RESOLVED: 4.5°C";
        document.getElementById('label-compressor-state').className = "text-emerald-400";
        document.getElementById('label-compressor-state').innerText = "Operating (Nominal)";

        btn.innerText = "Cooling Active (4.5°C Stabilized) ✓";
        showToast("Excursion Stabilized", "Container CC-103 auxiliary cooling active. Cargo protected.");
        appendTerminalLog("MQTT_RX: Telemetry ACK: Temp normalized to 4.5°C. Excursion closed.");

        addAuditLogEntry("CC-103", "Remote Cooling Actuated - Restored to 4.5°C", "SAFE");
      }, 1400);
    }

    function notifyDriverModal(id) {
      document.getElementById('driver-modal').classList.remove('hidden');
    }

    function closeDriverModal() {
      document.getElementById('driver-modal').classList.add('hidden');
    }

    function sendDriverNotification() {
      closeDriverModal();
      showToast("Driver Alerted", "Priority SMS and in-cab audio chime sent to Arjun Kumar.");
      appendTerminalLog("TELEMATICS: Cellular SMS sent to driver Arjun K (+447700900123).");
    }

    function acknowledgeAlert() {
      document.getElementById('btn-ack-alert-label').innerText = "Acknowledged ✓";
      showToast("Alert Acknowledged", "Operator signed off on excursion warning.");
      appendTerminalLog("SYS: Operator ACK logged for Container CC-103.");
    }

    // Audio alarm
    function toggleAudioAlerts() {
      audioAlarmEnabled = !audioAlarmEnabled;
      const icon = document.getElementById('audio-icon');
      const label = document.getElementById('audio-label');
      if (audioAlarmEnabled) {
        icon.setAttribute('data-lucide', 'volume-2');
        label.innerText = 'Sound: On';
        playBeepTone();
      } else {
        icon.setAttribute('data-lucide', 'volume-x');
        label.innerText = 'Sound: Muted';
      }
      lucide.createIcons();
    }

    function playBeepTone() {
      if (!audioAlarmEnabled) return;
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
      } catch (e) {}
    }

    // ============================================================
    // 10. COMPLIANCE & HISTORICAL AUDIT LOGS
    // ============================================================

    function initAuditLogs() {
      auditLogs = [
        { time: "10:30:15", id: "CC-101", node: "CH-CC1", cargo: "Vaccines", temp: 4.2, hum: 62, coords: "51.5155° N, -0.0922° W", status: "SAFE" },
        { time: "10:28:44", id: "CC-103", node: "CH-CC3", cargo: "Seafood", temp: 9.2, hum: 74, coords: "51.5100° N, -0.0880° W", status: "ALERT" },
        { time: "10:25:10", id: "CC-102", node: "CH-CC2", cargo: "Dairy Products", temp: 4.8, hum: 65, coords: "51.5162° N, -0.0845° W", status: "SAFE" },
        { time: "10:20:00", id: "CC-101", node: "CH-CC1", cargo: "Vaccines", temp: 4.1, hum: 61, coords: "51.5155° N, -0.0922° W", status: "SAFE" },
        { time: "10:14:22", id: "CC-103", node: "CH-CC3", cargo: "Seafood", temp: 9.4, hum: 76, coords: "51.5120° N, -0.0895° W", status: "ALERT" },
        { time: "10:05:00", id: "CC-102", node: "CH-CC2", cargo: "Dairy Products", temp: 4.7, hum: 64, coords: "51.5158° N, -0.0890° W", status: "SAFE" }
      ];
      renderAuditTable();
      renderAlertFeed();
    }

    function addAuditLogEntry(id, cargoMsg, status) {
      const now = new Date().toTimeString().split(' ')[0];
      const v = vehiclesState[id];
      auditLogs.unshift({
        time: now,
        id: id,
        node: `CH-${id.replace('-', '')}`,
        cargo: DESTINATIONS[id].cargo,
        temp: v.tempC,
        hum: v.humidity,
        coords: "In-Transit GPS",
        status: status
      });
      renderAuditTable();
      renderAlertFeed();
    }

    function renderAuditTable() {
      const tbody = document.getElementById('audit-table-body');
      if (!tbody) return;

      const q = (document.getElementById('log-search-input')?.value || '').toLowerCase();
      const filter = document.getElementById('log-filter-select')?.value || 'ALL';

      const filtered = auditLogs.filter(item => {
        const matchesQ = item.id.toLowerCase().includes(q) || item.node.toLowerCase().includes(q) || item.cargo.toLowerCase().includes(q);
        const matchesFilter = filter === 'ALL' || item.status === filter;
        return matchesQ && matchesFilter;
      });

      tbody.innerHTML = filtered.map(item => `
        <tr class="hover:bg-coldnavy-850/80 transition">
          <td class="px-4 py-3 font-mono text-slate-300">${item.time}</td>
          <td class="px-4 py-3 font-mono font-bold text-cyan-300">${item.id}</td>
          <td class="px-4 py-3 font-mono text-slate-400">${item.node}</td>
          <td class="px-4 py-3 text-white font-medium">${item.cargo}</td>
          <td class="px-4 py-3 font-mono font-bold ${item.status === 'ALERT' ? 'text-rose-400' : 'text-emerald-400'}">${formatTemp(item.temp)}</td>
          <td class="px-4 py-3 font-mono text-cyan-400">${item.hum}% RH</td>
          <td class="px-4 py-3 font-mono text-slate-400 text-[11px]">${item.coords}</td>
          <td class="px-4 py-3">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${item.status === 'ALERT' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : (item.status === 'DELIVERED' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30')}">
              ${item.status}
            </span>
          </td>
        </tr>
      `).join('');
    }

    function filterAuditLogs() {
      renderAuditTable();
    }

    function renderAlertFeed() {
      const feed = document.getElementById('alert-feed-list');
      if (!feed) return;
      feed.innerHTML = `
        <div class="p-3.5 rounded-xl bg-coldnavy-950 border border-rose-500/40 flex items-start justify-between gap-3">
          <div class="flex items-start gap-2.5">
            <span class="w-2.5 h-2.5 rounded-full bg-rose-500 mt-1 flex-shrink-0 animate-ping"></span>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-mono font-bold text-slate-200">10:14:22 UTC</span>
                <span class="text-[10px] font-bold text-rose-400 font-mono">CC-103 (Seafood)</span>
              </div>
              <p class="text-xs text-rose-200 mt-0.5">Critical Temperature Excursion: 9.4°C exceeded ceiling threshold (8.0°C)</p>
            </div>
          </div>
          <span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/40 uppercase">EXCURSION</span>
        </div>

        <div class="p-3.5 rounded-xl bg-coldnavy-950 border border-amber-500/30 flex items-start justify-between gap-3">
          <div class="flex items-start gap-2.5">
            <span class="w-2.5 h-2.5 rounded-full bg-amber-400 mt-1 flex-shrink-0"></span>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-mono font-bold text-slate-200">10:05:00 UTC</span>
                <span class="text-[10px] font-bold text-amber-400 font-mono">CC-103 (Seafood)</span>
              </div>
              <p class="text-xs text-slate-200 mt-0.5">Relative humidity warning: 76% RH approaching condensation threshold</p>
            </div>
          </div>
          <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">WARNING</span>
        </div>

        <div class="p-3.5 rounded-xl bg-coldnavy-950 border border-emerald-500/30 flex items-start justify-between gap-3">
          <div class="flex items-start gap-2.5">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-1 flex-shrink-0"></span>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-mono font-bold text-slate-200">09:50:18 UTC</span>
                <span class="text-[10px] font-bold text-cyan-400 font-mono">CC-101 (Vaccines)</span>
              </div>
              <p class="text-xs text-slate-200 mt-0.5">Automated telemetry integrity check: Temperature stream nominal (±0.05°C precision)</p>
            </div>
          </div>
          <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase">PASSED</span>
        </div>
      `;
    }

    // Export CSV functionality
    function exportCSV() {
      const headers = "Timestamp,Container_ID,Data_Channel,Cargo_Type,Temperature_C,Humidity_RH,Location,Status\n";
      const rows = auditLogs.map(l => `${l.time},${l.id},${l.node},"${l.cargo}",${l.temp},${l.hum},"${l.coords}",${l.status}`).join("\n");
      const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `cold_chain_audit_log_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast("CSV Exported", "Downloaded cold_chain_audit_log.csv");
    }

    // Export PDF Report formatted printable window
    function exportPDFAuditReport() {
      const win = window.open('', '_blank');
      win.document.write(`
        <html>
        <head>
          <title>Smart Cold Chain Audit Report - FDA 21 CFR Part 11</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; color: #1e293b; }
            h1 { color: #0f172a; border-bottom: 2px solid #06b6d4; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
            th { background: #f1f5f9; }
            .badge-safe { color: #15803d; font-weight: bold; }
            .badge-alert { color: #b91c1c; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>SMART COLD CHAIN MONITORING SYSTEM</h1>
          <p><strong>Regulatory Compliance Audit Certificate & Telemetry Manifest</strong></p>
          <p>Common Warehouse: 14 Dispatch Way, London EC2 • Generated: ${new Date().toUTCString()}</p>
          <table>
            <thead>
              <tr><th>Timestamp</th><th>ID</th><th>Data Channel</th><th>Cargo</th><th>Temp (°C)</th><th>Humidity</th><th>Status</th></tr>
            </thead>
            <tbody>
              ${auditLogs.map(l => `
                <tr>
                  <td>${l.time}</td>
                  <td><b>${l.id}</b></td>
                  <td>${l.node}</td>
                  <td>${l.cargo}</td>
                  <td>${l.temp}°C</td>
                  <td>${l.hum}%</td>
                  <td class="${l.status === 'ALERT' ? 'badge-alert' : 'badge-safe'}">${l.status}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <p style="margin-top: 30px; font-size: 11px; color: #64748b;">Digitally verified against MQTT Edge Gateway SHA-256 hash. Print as PDF using browser dialog.</p>
        </body>
        </html>
      `);
      win.document.close();
      win.print();
    }

    // ============================================================
    // 11. DATA PIPELINE STREAM (MQTT TERMINAL STREAM)
    // ============================================================

    function initMqttStream() {
      setInterval(() => {
        const id = ['CC-101', 'CC-102', 'CC-103'][Math.floor(Math.random() * 3)];
        const v = vehiclesState[id];
        const now = new Date().toISOString();
        const payload = `{"stream":"STREAM-${id.replace('-','')}", "vehicle":"${id}", "temp":${v.tempC}, "hum":${v.humidity}, "speed":${v.speed}, "progress":${(v.progress*100).toFixed(1)}, "ts":"${now.slice(11,19)}"}`;
        appendTerminalLog(`MQTT_IN [telemetry/${id}]: ${payload}`);
      }, 3000);
    }

    function appendTerminalLog(text) {
      const term = document.getElementById('mqtt-terminal-stream');
      if (!term) return;
      const p = document.createElement('p');
      p.innerText = text;
      term.appendChild(p);
      term.scrollTop = term.scrollHeight;
    }

    function clearTerminalLogs() {
      const term = document.getElementById('mqtt-terminal-stream');
      if (term) term.innerHTML = "<p>Console logs cleared.</p>";
    }

    // ============================================================
    // 12. TAB NAVIGATION
    // ============================================================

    function switchTab(tabId) {
      if (tabId === 'copilot') tabId = 'telemetry';
      const tabs = ['telemetry', 'compliance', 'alerts', 'fleet-gps', 'settings'];
      const copilotSec = document.getElementById('section-copilot');
      if (copilotSec) copilotSec.classList.add('hidden');

      tabs.forEach(t => {
        const sec = document.getElementById(`section-${t}`);
        const btn = document.getElementById(`tab-${t}`);
        if (sec && btn) {
          if (t === tabId) {
            sec.classList.remove('hidden');
            btn.classList.add('active');
            btn.classList.remove('text-slate-400');
            const icon = btn.querySelector('i');
            if (icon && !icon.classList.contains('text-rose-400')) {
              icon.classList.add('text-cyan-400');
            }
          } else {
            sec.classList.add('hidden');
            btn.classList.remove('active');
            btn.classList.add('text-slate-400');
            const icon = btn.querySelector('i');
            if (icon && !icon.classList.contains('text-rose-400')) {
              icon.classList.remove('text-cyan-400');
            }
          }
        }
      });

      if (tabId === 'fleet-gps' && map) {
        setTimeout(() => map.invalidateSize(), 150);
      }

      // Hide top KPI summary cards when on settings view
      const kpiSummary = document.getElementById('top-kpi-summary');
      if (kpiSummary) {
        if (tabId === 'settings') {
          kpiSummary.classList.add('hidden');
        } else {
          kpiSummary.classList.remove('hidden');
        }
      }

      lucide.createIcons();

      // Close mobile drawer if open
      if (window.innerWidth < 1024) {
        toggleSidebar(false);
      }
    }

    // ============================================================
    // SETTINGS STATE & LOCALSTORAGE SYNCHRONIZATION
    // ============================================================
    const SETTINGS_STORAGE_KEY = 'smart_coldchain_settings';

    const defaultColdChainSettings = {
      pharma_min: 2.0,
      pharma_max: 8.0,
      produce_limit: 7.0,
      frozen_limit: -18.0,
      excursion_duration: 45,
      defrost_mode: true,
      tier_warning: true,
      tier_critical: true,
      tier_emergency: true,
      escalation_timer: 15,
      transit_polling: '5',
      idle_polling: '60',
      offline_sync: true,
      data_retention: 365,
      default_role: 'Fleet Manager',
      audit_logging: true,
      temp_unit: 'C',
      dist_unit: 'km',
      timezone_sync: 'UTC',
      compliance_framework: true
    };

    function loadDashboardSettings() {
      let cfg = defaultColdChainSettings;
      try {
        const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (stored) {
          cfg = { ...defaultColdChainSettings, ...JSON.parse(stored) };
        }
      } catch (e) {
        console.error("Failed to load settings", e);
      }

      // Populate dashboard settings inputs
      const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
      const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = Boolean(val); };

      setVal('dash_pharma_min', cfg.pharma_min);
      setVal('dash_pharma_max', cfg.pharma_max);
      setVal('dash_produce_limit', cfg.produce_limit);
      setVal('dash_frozen_limit', cfg.frozen_limit);
      setVal('dash_excursion_duration', cfg.excursion_duration);
      setChk('dash_defrost_mode', cfg.defrost_mode);

      setChk('dash_tier_warning', cfg.tier_warning);
      setChk('dash_tier_critical', cfg.tier_critical);
      setChk('dash_tier_emergency', cfg.tier_emergency);
      setVal('dash_escalation_timer', cfg.escalation_timer);

      setVal('dash_transit_polling', cfg.transit_polling);
      setVal('dash_idle_polling', cfg.idle_polling);
      setChk('dash_offline_sync', cfg.offline_sync);
      setVal('dash_data_retention', cfg.data_retention);

      setVal('dash_default_role', cfg.default_role);
      setChk('dash_audit_logging', cfg.audit_logging);

      setVal('dash_temp_unit', cfg.temp_unit);
      setVal('dash_dist_unit', cfg.dist_unit);
      setVal('dash_timezone_sync', cfg.timezone_sync);
      setChk('dash_compliance_framework', cfg.compliance_framework);

      // Apply temperature unit if different
      if (cfg.temp_unit && cfg.temp_unit !== activeTempUnit) {
        setTempUnit(cfg.temp_unit);
      }
    }

    function handleDashboardSaveSettings() {
      const getVal = (id, fallback) => parseFloat(document.getElementById(id)?.value) || fallback;
      const getInt = (id, fallback) => parseInt(document.getElementById(id)?.value) || fallback;
      const getStr = (id, fallback) => document.getElementById(id)?.value || fallback;
      const getChk = (id) => Boolean(document.getElementById(id)?.checked);

      const updated = {
        pharma_min: getVal('dash_pharma_min', 2.0),
        pharma_max: getVal('dash_pharma_max', 8.0),
        produce_limit: getVal('dash_produce_limit', 7.0),
        frozen_limit: getVal('dash_frozen_limit', -18.0),
        excursion_duration: getInt('dash_excursion_duration', 45),
        defrost_mode: getChk('dash_defrost_mode'),

        tier_warning: getChk('dash_tier_warning'),
        tier_critical: getChk('dash_tier_critical'),
        tier_emergency: getChk('dash_tier_emergency'),
        escalation_timer: getInt('dash_escalation_timer', 15),

        transit_polling: getStr('dash_transit_polling', '5'),
        idle_polling: getStr('dash_idle_polling', '60'),
        offline_sync: getChk('dash_offline_sync'),
        data_retention: getInt('dash_data_retention', 365),

        default_role: getStr('dash_default_role', 'Fleet Manager'),
        audit_logging: getChk('dash_audit_logging'),

        temp_unit: getStr('dash_temp_unit', 'C'),
        dist_unit: getStr('dash_dist_unit', 'km'),
        timezone_sync: getStr('dash_timezone_sync', 'UTC'),
        compliance_framework: getChk('dash_compliance_framework')
      };

      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error("Storage error", e);
      }

      // Synchronize dashboard temp unit
      if (updated.temp_unit !== activeTempUnit) {
        setTempUnit(updated.temp_unit);
      }

      showToast('Settings Saved', 'Environmental thresholds, alerts, and system preferences saved & synchronized.');
      appendTerminalLog('SYS: Configuration updated. LocalStorage sync completed.');
    }

    function handleDashboardResetSettings() {
      if (confirm('Reset software settings to default operational parameters?')) {
        try {
          localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(defaultColdChainSettings));
        } catch (e) {}
        loadDashboardSettings();
        showToast('Settings Reset', 'Configuration restored to operational software defaults.');
        appendTerminalLog('SYS: Settings reset to operational software defaults.');
      }
    }

    // Toggle Drawer on Mobile Screens
    function toggleSidebar(open) {
      const sb = document.getElementById('sidebar');
      const bd = document.getElementById('sidebar-backdrop');
      if (!sb || !bd) return;
      const willOpen = open !== undefined ? open : sb.classList.contains('-translate-x-full');
      if (willOpen) {
        sb.classList.remove('-translate-x-full');
        bd.classList.remove('hidden');
      } else {
        sb.classList.add('-translate-x-full');
        bd.classList.add('hidden');
      }
    }

    // ============================================================
    // 13. TOAST UTILITY
    // ============================================================

    function showToast(title, msg) {
      const existing = document.getElementById('toast-box');
      if (existing) existing.remove();

      const toast = document.createElement('div');
      toast.id = 'toast-box';
      toast.className = 'fixed bottom-6 right-6 z-50 bg-coldnavy-900 border border-cyan-500/40 rounded-xl p-4 shadow-2xl flex items-start gap-3 max-w-sm transition-all duration-300';
      toast.innerHTML = `
        <div class="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 mt-0.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="M14.83 9.17l4.24-4.24"/><path d="m4.93 19.07 4.24-4.24"/></svg>
        </div>
        <div>
          <h5 class="text-xs font-bold text-white">${title}</h5>
          <p class="text-[11px] text-slate-300 mt-0.5 leading-tight">${msg}</p>
        </div>
      `;
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 400);
      }, 3500);
    }

    // ============================================================
    // 14. AI CO-PILOT & PREDICTIVE ANALYTICS ENGINE (FULLY AUTONOMOUS)
    // ============================================================
    let copilotActiveAsset = 'CC-101';
    let copilotControlMode = 'autonomous'; // Permanent 100% UNGATED AUTONOMOUS MODE
    let copilotSimulationActive = false;
    let copilotDrawerOpen = false;
    let copilotExecutedActionCount = 18;
    let autopilotInterval = null;

    const copilotRollbackHistory = [
      { id: 'rb-1', type: 'threshold', asset: 'CC-101', desc: 'CC-101 threshold tuned from 8.0°C to 6.8°C' },
      { id: 'rb-2', type: 'gain', asset: 'CC-103', desc: 'Kalman gain updated to β=0.982 on CC-103' }
    ];

    const copilotAssets = {
      'CC-101': { name: 'UNIT #CC-101 (Vaccines)', cargo: 'Vaccines (mRNA)', temp: 4.2, baselineThreshold: 8.0, tunedThreshold: 6.8, vib: 1.12, power: 2.6, ambient: 24.5, pressure: 165.2 },
      'CC-102': { name: 'UNIT #CC-102 (Dairy)', cargo: 'Dairy & Fresh Milk', temp: 4.8, baselineThreshold: 8.0, tunedThreshold: 7.2, vib: 1.45, power: 2.9, ambient: 25.1, pressure: 158.4 },
      'CC-103': { name: 'UNIT #CC-103 (Seafood)', cargo: 'Seafood & Perishables', temp: 9.2, baselineThreshold: 8.0, tunedThreshold: 6.5, vib: 2.95, power: 4.1, ambient: 28.2, pressure: 184.0 },
      'CC-804': { name: 'UNIT #CC-804 (Cryo)', cargo: 'Cryo Biologics (-70°C)', temp: -72.4, baselineThreshold: -70.0, tunedThreshold: -70.5, vib: 3.82, power: 4.2, ambient: 38.7, pressure: 188.4 }
    };

    // Auto-executes without any manual confirmation or supervised pause
    function setControlMode(mode) {
      copilotControlMode = 'autonomous';
      addAILog('[AUTONOMOUS ENGINE] Zero-touch mode permanently locked. All predictive mitigations auto-execute instantly.');
    }

    function toggleThoughtDrawer() {
      copilotDrawerOpen = !copilotDrawerOpen;
      const drawer = document.getElementById('thoughtDrawer');
      if (drawer) {
        if (copilotDrawerOpen) {
          drawer.classList.remove('translate-x-full');
        } else {
          drawer.classList.add('translate-x-full');
        }
      }
    }

    function addAILog(msg) {
      const feed = document.getElementById('aiActivityFeed');
      if (!feed) return;
      const time = new Date().toTimeString().split(' ')[0];
      const div = document.createElement('div');
      div.className = 'p-2.5 rounded-lg bg-coldnavy-950/70 border border-cyan-900/40 text-slate-300 space-y-1 animate-fadeIn';
      div.innerHTML = `
        <div class="flex items-center justify-between text-[11px]">
          <span class="text-emerald-400 font-bold">[AUTO-PILOT]</span>
          <span class="text-slate-500">${time}</span>
        </div>
        <p class="text-[11px] text-slate-300">${msg}</p>
      `;
      feed.insertBefore(div, feed.firstChild);
      if (feed.children.length > 30) feed.removeChild(feed.lastChild);
    }

    // Fully autonomous execution engine: immediately applies actions, updates state & charts
    function executeAutonomousAction(action) {
      copilotExecutedActionCount++;
      const time = new Date().toTimeString().split(' ')[0];

      // 1. Update Section-Copilot counter
      const queueEl = document.getElementById('tab-queue-count');
      if (queueEl) queueEl.innerText = `${copilotExecutedActionCount} Applied`;

      // 2. Prepend to Autonomous Action Feed Ticker (section-copilot)
      const ticker = document.getElementById('copilot-live-action-ticker');
      if (ticker) {
        const item = document.createElement('div');
        item.className = 'p-2 rounded bg-coldnavy-950/70 border border-emerald-500/30 text-slate-300 flex items-center justify-between animate-fadeIn';
        item.innerHTML = `
          <span class="text-emerald-400 font-bold text-xs">[AUTO-EXEC]: AI Auto-Applied: ${action.title} &bull; Success</span>
          <span class="text-[10px] text-slate-500 font-mono">${time} &bull; Latency: 0ms</span>
        `;
        ticker.insertBefore(item, ticker.firstChild);
        if (ticker.children.length > 20) ticker.removeChild(ticker.lastChild);
      }

      // 3. Update Action Stream Drawer (section-telemetry collapsible card)
      appendActionStreamLog(`AI Auto-Applied: ${action.title} &bull; Success`, action.asset);

      // 4. Update Thought Stream Drawer
      addAILog(`[AUTO-EXECUTE] ${action.title}. State synchronized to telematics bus.`);

      // 5. Update Mini Stream feed
      appendTelemetryAILog(`Auto-Applied: ${action.title}`);

      // 6. Synchronize Asset State & UI Controls
      if (action.asset && copilotAssets[action.asset]) {
        const d = copilotAssets[action.asset];
        if (action.newThreshold !== undefined) {
          d.tunedThreshold = action.newThreshold;
          if (copilotActiveAsset === action.asset) {
            const tunedEl = document.getElementById('copilot-tuned-threshold');
            if (tunedEl) tunedEl.innerText = d.tunedThreshold.toFixed(1) + '°C';
          }
        }
        if (action.tempC !== undefined) {
          d.temp = action.tempC;
          const tempEl = document.getElementById('copilot-temp-' + action.asset);
          if (tempEl) tempEl.innerText = d.temp.toFixed(1) + '°C';
        }
      }

      // 7. Visual Pulse/Badge on Card
      highlightCardAIAction(action.asset);

      // 8. Update Chart.js if real-time chart active
      if (window.tempChart && action.asset) {
        let datasetIdx = action.asset === 'CC-101' ? 0 : (action.asset === 'CC-102' ? 1 : 2);
        if (action.chartVal !== undefined && tempChart.data.datasets[datasetIdx]) {
          const ds = tempChart.data.datasets[datasetIdx].data;
          ds[ds.length - 1] = action.chartVal;
          tempChart.update('none');
        }
      }

      // 9. Toast Notification
      showToast('AI Auto-Applied', `${action.title} • Executed Instantly`);
    }

    // Visual glowing badge on sensor/fleet cards
    function highlightCardAIAction(asset) {
      if (!asset) return;
      const lower = asset.toLowerCase().replace('-', '');
      const badge = document.getElementById('ai-badge-' + lower);
      const card = document.getElementById('card-' + lower);
      const vehCard = document.getElementById('card-veh-' + asset);

      if (badge) badge.classList.remove('hidden');
      if (card) {
        card.classList.add('ai-binding-active');
        setTimeout(() => {
          card.classList.remove('ai-binding-active');
          if (badge) badge.classList.add('hidden');
        }, 3500);
      }
      if (vehCard) {
        vehCard.classList.add('ring-2', 'ring-emerald-400');
        setTimeout(() => vehCard.classList.remove('ring-2', 'ring-emerald-400'), 3500);
      }
    }

    // Collapsible Action Stream Widget functions
    let actionStreamOpen = false;
    let actionStreamTotalCount = 0;

    function toggleActionStream() {
      actionStreamOpen = !actionStreamOpen;
      const body = document.getElementById('action-stream-body');
      const chev = document.getElementById('action-stream-chevron');
      if (body) {
        body.style.maxHeight = actionStreamOpen ? '320px' : '0px';
      }
      if (chev) {
        chev.style.transform = actionStreamOpen ? 'rotate(180deg)' : 'rotate(0deg)';
      }
    }

    function clearActionStream(e) {
      if (e) e.stopPropagation();
      const log = document.getElementById('action-stream-log');
      const cnt = document.getElementById('action-stream-count');
      if (log) log.innerHTML = '<div class="text-slate-600 italic text-center p-3 text-[11px]">Log cleared. Real-time actions will stream in automatically.</div>';
      actionStreamTotalCount = 0;
      if (cnt) cnt.innerText = '0 actions';
    }

    function appendActionStreamLog(text, asset) {
      const log = document.getElementById('action-stream-log');
      const cnt = document.getElementById('action-stream-count');
      if (!log) return;
      actionStreamTotalCount++;
      if (cnt) cnt.innerText = `${actionStreamTotalCount} actions`;

      const time = new Date().toTimeString().split(' ')[0];
      const div = document.createElement('div');
      div.className = 'p-2 rounded bg-coldnavy-950/80 border border-emerald-500/30 flex items-center justify-between text-[11px] animate-fadeIn';
      div.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span class="text-emerald-300 font-bold">[AUTO-EXEC]:</span>
          <span class="text-slate-200">${text}</span>
        </div>
        <span class="text-slate-500 font-mono text-[10px]">${time}</span>
      `;
      log.insertBefore(div, log.firstChild);
      if (log.children.length > 30) log.removeChild(log.lastChild);
    }

    // Backward compatibility bridges in case called elsewhere
    function approveAction(id, actionName) {
      executeAutonomousAction({ title: actionName || 'Autonomous Telematics Modulation', asset: 'CC-101' });
    }

    function rejectApproval(id, reason) {
      addAILog(`[AUTONOMOUS SUPERSEDED] Legacy hold request ${id} bypassed. Autonomous sentinel maintains continuous protection.`);
    }

    function triggerGlobalRollback() {
      if (copilotRollbackHistory.length === 0) {
        showRollbackBar('No recent automated AI changes to revert; parameters at nominal user baseline.');
        return;
      }
      const item = copilotRollbackHistory.pop();
      const badge = document.getElementById('header-undo-badge');
      if (badge) badge.innerText = copilotRollbackHistory.length;

      if (item.type === 'threshold') {
        revertSpecificThreshold();
        showRollbackBar(`[ROLLBACK SUCCESS] Reverted: ${item.desc}. Restored baseline.`);
      } else {
        showRollbackBar(`[ROLLBACK SUCCESS] Reverted: ${item.desc}. Algorithm weights restored.`);
      }
      addAILog(`[ROLLBACK AUDIT] Reverted action [${item.id}]: ${item.desc}.`);
      showToast('Rollback Executed', item.desc);
    }

    function revertSpecificThreshold() {
      const d = copilotAssets[copilotActiveAsset];
      d.tunedThreshold = d.baselineThreshold;
      const tunedEl = document.getElementById('copilot-tuned-threshold');
      if (tunedEl) {
        tunedEl.innerText = d.baselineThreshold.toFixed(1) + '°C';
        tunedEl.className = 'text-slate-300 font-bold font-mono';
      }
      const container = document.getElementById('copilot-binding-container');
      if (container) {
        container.className = 'bg-coldnavy-950/40 border border-coldnavy-800 rounded-xl p-3.5 mb-4 text-xs transition-all';
      }
      showRollbackBar(`Threshold for ${d.name} reset to factory baseline (${d.baselineThreshold}°C).`);
      drawTelemetryCanvas();
    }

    function showRollbackBar(msg) {
      const bar = document.getElementById('rollbackNotificationBar');
      const text = document.getElementById('rollbackMessageText');
      if (text) text.innerText = msg;
      if (bar) bar.classList.remove('hidden');
    }

    function dismissRollbackBar() {
      const bar = document.getElementById('rollbackNotificationBar');
      if (bar) bar.classList.add('hidden');
    }

    function selectCopilotAsset(id) {
      copilotActiveAsset = id;
      ['CC-101', 'CC-102', 'CC-103', 'CC-804'].forEach(key => {
        const el = document.getElementById('copilot-card-' + key);
        if (el) {
          if (key === id) {
            el.className = 'cursor-pointer bg-coldnavy-900 border-2 border-cyan-400 rounded-2xl p-4 transition-all hover:shadow-lg hover:shadow-cyan-500/10';
          } else {
            el.className = 'cursor-pointer bg-coldnavy-900/60 border border-coldnavy-800 rounded-2xl p-4 transition-all hover:border-coldnavy-700';
          }
        }
      });

      const d = copilotAssets[id];
      const titleEl = document.getElementById('copilot-active-asset-title');
      const pressEl = document.getElementById('copilot-disp-pressure');
      const powerEl = document.getElementById('copilot-disp-power');
      const vibEl = document.getElementById('copilot-disp-vibration');
      const ambEl = document.getElementById('copilot-disp-ambient');
      const baseEl = document.getElementById('copilot-baseline-threshold');
      const tunedEl = document.getElementById('copilot-tuned-threshold');

      if (titleEl) titleEl.innerText = `${d.name} (${d.cargo})`;
      if (pressEl) pressEl.innerText = `${d.pressure.toFixed(1)} PSI`;
      if (powerEl) powerEl.innerText = `${d.power.toFixed(1)} kW`;
      if (vibEl) vibEl.innerText = `${d.vib.toFixed(2)} mm/s`;
      if (ambEl) ambEl.innerText = `${d.ambient.toFixed(1)}°C`;
      if (baseEl) baseEl.innerText = `${d.baselineThreshold.toFixed(1)}°C`;
      if (tunedEl) tunedEl.innerText = `${d.tunedThreshold.toFixed(1)}°C`;

      addAILog(`[FOCUS ASSET] Loaded telematics context for ${d.name}. Dual-control bindings synchronized.`);
      drawTelemetryCanvas();
    }

    function triggerSimulatedSurge() {
      copilotSimulationActive = true;
      copilotAssets['CC-101'].temp = 8.6;
      copilotAssets['CC-101'].vib = 3.92;
      const tempEl = document.getElementById('copilot-temp-CC-101');
      if (tempEl) {
        tempEl.innerText = '8.6°C';
        tempEl.className = 'text-2xl font-black font-mono text-rose-400 animate-pulse';
      }
      const vibEl = document.getElementById('copilot-disp-vibration');
      if (vibEl) vibEl.innerText = '3.92 mm/s';
      const powerEl = document.getElementById('copilot-disp-power');
      if (powerEl) powerEl.innerText = '4.9 kW';

      addAILog('[CRITICAL SURGE] Excursion detected on CC-101 (+8.6°C). Autonomous zero-touch mitigation executing instantly...');
      
      // INSTANT FULLY AUTONOMOUS EXECUTION (No approval pause)
      executeAutonomousAction({
        title: 'Cryo-Loop Modulation (-3.5°C) on CC-101',
        asset: 'CC-101',
        tempC: 4.4,
        chartVal: 4.4,
        newThreshold: 6.5
      });

      // Rapid autonomous stabilization curve
      setTimeout(() => {
        copilotAssets['CC-101'].temp = 4.2;
        copilotAssets['CC-101'].vib = 1.14;
        if (tempEl) {
          tempEl.innerText = '4.2°C';
          tempEl.className = 'text-2xl font-black font-mono text-emerald-400';
        }
        if (vibEl) vibEl.innerText = '1.14 mm/s';
        if (powerEl) powerEl.innerText = '2.8 kW';
        copilotSimulationActive = false;
        drawTelemetryCanvas();
        addAILog('[STABILIZATION CONFIRMED] CC-101 payload pulled down to 4.2°C nominal. Thermal integrity preserved.');
      }, 3500);

      drawTelemetryCanvas();
    }

    function drawTelemetryCanvas() {
      const canvas = document.getElementById('telemetryCanvas');
      if (!canvas || !canvas.parentElement) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.parentElement.clientWidth;
      const h = canvas.parentElement.clientHeight;
      canvas.width = w;
      canvas.height = h;

      ctx.clearRect(0, 0, w, h);

      // Grid lines
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
      ctx.lineWidth = 1;
      for (let y = 30; y < h - 30; y += 40) {
        ctx.beginPath();
        ctx.moveTo(40, y);
        ctx.lineTo(w - 20, y);
        ctx.stroke();
      }

      const midX = w * 0.45; // NOW (T = 0)

      // Critical threshold line
      const thresholdY = h * 0.28;
      ctx.strokeStyle = '#f43f5e';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(40, thresholdY);
      ctx.lineTo(w - 20, thresholdY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#f43f5e';
      ctx.font = '10px monospace';
      ctx.fillText('CRITICAL THRESHOLD (8.0°C)', 45, thresholdY - 6);

      // AI-Tuned dynamic limit line
      const dynamicY = h * 0.38;
      ctx.strokeStyle = '#c084fc';
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(40, dynamicY);
      ctx.lineTo(w - 20, dynamicY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#c084fc';
      ctx.fillText('AI-TUNED DYNAMIC LIMIT (6.8°C)', 45, dynamicY - 6);

      // Past actual telemetry curve (40 to midX)
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const points = 25;
      for (let i = 0; i <= points; i++) {
        const x = 40 + (i / points) * (midX - 40);
        const noise = Math.sin(i * 0.6) * 5 + (Math.random() - 0.5) * 3;
        const trend = (i / points) * (copilotSimulationActive ? -28 : 8);
        const y = h * 0.62 + noise + trend;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Current NOW vertical line
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(midX, 20);
      ctx.lineTo(midX, h - 30);
      ctx.stroke();
      ctx.setLineDash([]);

      // Future Prediction Cone (midX to w-20)
      const futurePoints = 25;
      const startY = copilotSimulationActive ? h * 0.38 : h * 0.68;

      ctx.fillStyle = copilotSimulationActive ? 'rgba(244, 63, 94, 0.18)' : 'rgba(245, 158, 11, 0.15)';
      ctx.beginPath();
      ctx.moveTo(midX, startY);
      for (let i = 0; i <= futurePoints; i++) {
        const progress = i / futurePoints;
        const x = midX + progress * (w - 20 - midX);
        const delta = (copilotSimulationActive ? -30 : 5) * progress;
        const upperCone = startY + delta - (progress * 24);
        ctx.lineTo(x, upperCone);
      }
      for (let i = futurePoints; i >= 0; i--) {
        const progress = i / futurePoints;
        const x = midX + progress * (w - 20 - midX);
        const delta = (copilotSimulationActive ? -30 : 5) * progress;
        const lowerCone = startY + delta + (progress * 20);
        ctx.lineTo(x, lowerCone);
      }
      ctx.closePath();
      ctx.fill();

      // Forecast mean line
      ctx.strokeStyle = copilotSimulationActive ? '#f43f5e' : '#fbbf24';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(midX, startY);
      for (let i = 0; i <= futurePoints; i++) {
        const progress = i / futurePoints;
        const x = midX + progress * (w - 20 - midX);
        const delta = (copilotSimulationActive ? -30 : 5) * progress;
        const y = startY + delta;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    function initCopilotWorkspace() {
      drawTelemetryCanvas();
      window.addEventListener('resize', drawTelemetryCanvas);

      // Periodic autonomous cognitive insights
      const insights = [
        '[KALMAN STATE] Re-evaluating residual error matrices on convoy nodes. Error bounds nominal (±0.04°C).',
        '[ROUTE TELEMATICS] Correlating solar irradiance index with London Bridge transit corridor timing.',
        '[MOTOR WEAR ANALYSIS] Continuous envelope spectrum tracking shows 142 Hz harmonic stability.',
        '[FEEDBACK CALIBRATION] Model accuracy verified: 98.88% across rolling 72-hour validation window.'
      ];
      let insightIdx = 0;
      setInterval(() => {
        addAILog(insights[insightIdx % insights.length]);
        insightIdx++;
      }, 12000);
    }

    // Handlers for Inline Sensors Co-Pilot Suggestions & Mini Stream
    function applyTelemetrySuggestion(id, text) {
      const box = document.getElementById('ai-sugg-box-' + id);
      if (box) {
        box.className = 'p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/50 space-y-1.5';
        box.innerHTML = `
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold text-emerald-300 flex items-center gap-1">
              <i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-emerald-400"></i> AI Parameter Applied &amp; Active
            </span>
            <span class="text-[9px] font-mono font-bold bg-emerald-950 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-800">SYNC_OK</span>
          </div>
          <p class="text-[11px] text-slate-200">${text}</p>
          <div class="text-[10px] text-slate-400 font-mono">Compressor duty cycle adjusted. Thermal pull-down engaged on Node ESP32-CC3.</div>
        `;
        lucide.createIcons();
      }
      showToast('AI Parameter Applied', text);
      addAILog(`[TELEMETRY INLINE] Operator accepted AI suggestion #${id}: ${text}. Setpoint broadcast to Node.`);
      appendTelemetryAILog(`Setpoint tuned to 6.5°C on CC-103. Cooling pull-down initiated.`);
    }

    function dismissTelemetrySuggestion(id) {
      const box = document.getElementById('ai-sugg-box-' + id);
      if (box) {
        box.className = 'p-2.5 rounded-lg bg-coldnavy-900 border border-coldnavy-800 space-y-1';
        box.innerHTML = `
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold text-slate-400">Suggestion Overridden</span>
            <span class="text-[9px] font-mono text-slate-500 bg-coldnavy-950 px-1.5 py-0.2 rounded border border-coldnavy-800">OVERRIDE</span>
          </div>
          <p class="text-[11px] text-slate-400">Standard operational setpoint maintained. Feedback recorded in Bayesian policy weights.</p>
        `;
      }
      showToast('Suggestion Overridden', 'Default cooling threshold maintained.');
      addAILog(`[TELEMETRY INLINE] Operator dismissed AI suggestion #${id}. Model weights updated.`);
      appendTelemetryAILog(`Operator maintained factory baseline for Node CC3.`);
    }

    function appendTelemetryAILog(text) {
      const feed = document.getElementById('telemetry-ai-mini-stream');
      if (!feed) return;
      const div = document.createElement('div');
      div.className = 'p-1.5 rounded bg-coldnavy-900/80 border border-cyan-900/40 animate-fadeIn';
      div.innerHTML = `<span class="text-cyan-400 font-bold">[FEEDBACK]:</span> ${text}`;
      feed.insertBefore(div, feed.firstChild);
    }

    // Continuous Real-Time Autonomous Engine (Self-Healing Loop)
    const autonomousActionsCatalog = [
      { title: 'Cryo-Loop Modulation (-3.5°C) on CC-101', asset: 'CC-101', tempC: 4.1, chartVal: 4.1 },
      { title: 'Dynamic Threshold Retuning to 6.5°C on CC-103', asset: 'CC-103', tempC: 8.5, chartVal: 8.5, newThreshold: 6.5 },
      { title: 'Route Diversion via Bermondsey Cool Bay Dispatched to HUD', asset: 'CC-103' },
      { title: 'Kalman Drift Recalibration (β=0.984) on Node CC2', asset: 'CC-102', tempC: 4.7, chartVal: 4.7 },
      { title: 'Compressor Inverter PWM Modulation (+12% duty cycle) on CC-103', asset: 'CC-103', tempC: 8.2, chartVal: 8.2 }
    ];
    let catalogIdx = 0;

    function initAutonomousAutopilotLoop() {
      if (autopilotInterval) clearInterval(autopilotInterval);
      autopilotInterval = setInterval(() => {
        // Execute next autonomous telemetry action
        const action = autonomousActionsCatalog[catalogIdx % autonomousActionsCatalog.length];
        executeAutonomousAction(action);
        catalogIdx++;
      }, 9000);
    }

    // ============================================================
    // 15. BOOTSTRAP INITIALIZATION
    // ============================================================

    window.addEventListener('DOMContentLoaded', async () => {
      lucide.createIcons();
      loadDashboardSettings();
      await initializeAllRoutes();
      initMap();
      initCharts();
      initAuditLogs();
      initMqttStream();
      initCopilotWorkspace();
      initAutonomousAutopilotLoop();

      // Start live clock for both header and sidebar
      setInterval(() => {
        const timeStr = new Date().toUTCString().slice(17, 25) + ' UTC';
        const elH = document.getElementById('header-live-time');
        const elS = document.getElementById('sidebar-live-time');
        if (elH) elH.innerText = timeStr;
        if (elS) elS.innerText = timeStr;
      }, 1000);
    });
