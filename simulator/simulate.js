const admin = require('firebase-admin');
const fs = require('fs');

try {
  var serviceAccount = require('./service-account.json');
} catch (e) {
  console.log('⚠️ Warning: service-account.json not found.');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://transitpulse-64a38-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const db = admin.database();

async function seedData() {
  console.log('🌱 Seeding startup database parameters...');
  await db.ref('routes').set({
    "Route_A": {
      "name": "Central to Adyar",
      "color": "#E63946",
      "stops": ["Central Station", "Mount Road", "Mylapore", "Adyar"]
    },
    "Route_B": {
      "name": "Tambaram to Guindy",
      "color": "#457B9D",
      "stops": ["Tambaram", "Chromepet", "Guindy"]
    },
    "Route_ESP": {
      "name": "Velachery to Taramani (Hardware Node)",
      "color": "#F4A261",
      "stops": ["Velachery", "Taramani"]
    }
  });
  
  await db.ref('system_stats').update({
    "totalActive": 11,
    "totalOffline": 0
  });
}

// Organic Road Maps
const rA = [{lat: 13.0827, lng: 80.2707}, {lat: 13.0691, lng: 80.2818}, {lat: 13.0538, lng: 80.2820}, {lat: 13.0402, lng: 80.2785}, {lat: 13.0312, lng: 80.2774}, {lat: 13.0125, lng: 80.2598}, {lat: 13.0066, lng: 80.2575}];
const rB = [{lat: 12.9229, lng: 80.1275}, {lat: 12.9516, lng: 80.1462}, {lat: 12.9665, lng: 80.1558}, {lat: 12.9822, lng: 80.1706}, {lat: 13.0016, lng: 80.2014}, {lat: 13.0067, lng: 80.2206}];
const rESP = [{lat: 12.9785, lng: 80.2208}, {lat: 12.9815, lng: 80.2225}, {lat: 12.9840, lng: 80.2270}, {lat: 12.9865, lng: 80.2320}, {lat: 12.9880, lng: 80.2370}];

const simulatedBuses = [
  { busId: "Bus_01", routeId: "Route_A", path: rA, currentIndex: 0, targetIndex: 1, direction: 1, currentLat: rA[0].lat, currentLng: rA[0].lng, speed: 40, etaBase: 15 },
  { busId: "Bus_02", routeId: "Route_A", path: rA, currentIndex: 1, targetIndex: 2, direction: 1, currentLat: rA[1].lat, currentLng: rA[1].lng, speed: 42, etaBase: 12 },
  { busId: "Bus_03", routeId: "Route_A", path: rA, currentIndex: 4, targetIndex: 3, direction: -1, currentLat: rA[4].lat, currentLng: rA[4].lng, speed: 38, etaBase: 18 },
  { busId: "Bus_04", routeId: "Route_A", path: rA, currentIndex: 2, targetIndex: 1, direction: -1, currentLat: rA[2].lat, currentLng: rA[2].lng, speed: 45, etaBase: 8 },

  { busId: "Bus_05", routeId: "Route_B", path: rB, currentIndex: 0, targetIndex: 1, direction: 1, currentLat: rB[0].lat, currentLng: rB[0].lng, speed: 35, etaBase: 25 },
  { busId: "Bus_06", routeId: "Route_B", path: rB, currentIndex: 1, targetIndex: 2, direction: 1, currentLat: rB[1].lat, currentLng: rB[1].lng, speed: 37, etaBase: 15 },
  { busId: "Bus_07", routeId: "Route_B", path: rB, currentIndex: 3, targetIndex: 2, direction: -1, currentLat: rB[3].lat, currentLng: rB[3].lng, speed: 40, etaBase: 20 },

  { busId: "Bus_08", routeId: "Route_ESP", path: rESP, currentIndex: 0, targetIndex: 1, direction: 1, currentLat: rESP[0].lat, currentLng: rESP[0].lng, speed: 32, etaBase: 10 },
  { busId: "Bus_09", routeId: "Route_ESP", path: rESP, currentIndex: 1, targetIndex: 2, direction: 1, currentLat: rESP[1].lat, currentLng: rESP[1].lng, speed: 35, etaBase: 8 },
  { busId: "Bus_10", routeId: "Route_ESP", path: rESP, currentIndex: 3, targetIndex: 2, direction: -1, currentLat: rESP[3].lat, currentLng: rESP[3].lng, speed: 42, etaBase: 14 }
];

function stepTowards(current, target, stepSize) {
  const diff = target - current;
  if (Math.abs(diff) < stepSize) return target;
  return current + Math.sign(diff) * stepSize;
}

async function runSimulation() {
  setInterval(async () => {
    let totalSpeed = 0;
    
    for (let bus of simulatedBuses) {
      const targetPoint = bus.path[bus.targetIndex];
      const stepSize = (bus.speed / 100000); 

      bus.currentLat = stepTowards(bus.currentLat, targetPoint.lat, stepSize);
      bus.currentLng = stepTowards(bus.currentLng, targetPoint.lng, stepSize);

      if (bus.currentLat === targetPoint.lat && bus.currentLng === targetPoint.lng) {
        bus.currentIndex = bus.targetIndex;
        bus.targetIndex += bus.direction;
        
        if (bus.targetIndex >= bus.path.length || bus.targetIndex < 0) {
          bus.direction *= -1;
          bus.targetIndex = bus.currentIndex + bus.direction;
        }
      }

      let status = "On Time";
      bus.speed = Math.floor(Math.random() * 20) + 30; 
      let occupancy = Math.floor(Math.random() * 50) + 20;

      if (Math.random() < 0.05) {
        status = "Delayed";
        bus.speed = Math.floor(Math.random() * 15); 
      }

      totalSpeed += bus.speed;

      const payload = {
        busId: bus.busId,
        routeId: bus.routeId,
        lat: bus.currentLat,
        lng: bus.currentLng,
        speed: bus.speed,
        occupancy: occupancy,
        status: status,
        nextStop: bus.direction === 1 ? "Forward Terminus" : "Reverse Terminus", 
        eta: Math.max(1, bus.etaBase - Math.floor(Math.random() * 5)),
        lastUpdated: admin.database.ServerValue.TIMESTAMP
      };

      await db.ref(`buses/${bus.busId}`).set(payload).catch(e => {});
    }

    await db.ref('system_stats').update({
      averageSpeed: Math.floor(totalSpeed / simulatedBuses.length)
    });

  }, 3000); 
}

seedData().then(() => {
  console.log('🚀 Starting Organic Fleet Simulation...');
  runSimulation();
});
