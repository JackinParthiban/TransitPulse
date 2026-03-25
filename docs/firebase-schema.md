# TransitPulse Firebase Data Schema

For a production-ready application, we replace the flat `/buses` structure with a normalized configuration that separates static data (routes) from ephemeral data (bus telemetry), and logs for future ML functionality.

```json
{
  "buses": {
    "Bus_01": {
      "busId": "Bus_01",
      "lat": 13.0827,
      "lng": 80.2707,
      "speed": 45,
      "status": "On Time",
      "nextStop": "Central Station",
      "eta": 5,
      "occupancy": 65,
      "routeId": "Route_A",
      "lastUpdated": 1698245388000
    },
    ...
    "Bus_ESP32_01": {
      "busId": "Bus_ESP32_01",
      ...
    }
  },

  "routes": {
    "Route_A": {
      "name": "Central to Adyar",
      "color": "#E63946",
      "activeBuses": 2,
      "stops": ["Central Station", "Mount Road", "Mylapore", "Adyar"]
    },
    "Route_B": {
      "name": "Tambaram to Guindy",
      "color": "#457B9D",
      "activeBuses": 1,
      "stops": ["Tambaram", "Chromepet", "Guindy"]
    },
    "Route_ESP": {
      "name": "Velachery to Taramani (IoT Node)",
      "color": "#F4A261",
      "activeBuses": 1,
      "stops": ["Velachery", "Taramani"]
    }
  },

  "alerts": {
    "alert_uuid_1": {
      "busId": "Bus_02",
      "type": "DELAY",
      "message": "Bus_02 experiencing heavy traffic near Guindy. ETA delayed by 10 mins.",
      "timestamp": 1698245388000
    }
  },

  "system_stats": {
    "totalActive": 4,
    "totalOffline": 0,
    "averageSpeed": 42
  }
}
```

## Enhancements Explained
1. **`lastUpdated`**: Acts as a heartbeat. The web dashboard will check `Date.now() - lastUpdated`. If > 30 seconds, the bus UI marker turns gray ("Offline").
2. **`routes` metadata**: Storing colors and stop definitions allows the frontend to dynamically generate filters and legends without hardcoding them.
3. **`alerts` node**: Allows the simulator (or ESP32) to push localized warnings which the dashboard displays in a notification stream.
4. **`system_stats`**: Pre-calculated stats help avoid client-side processing overhead on startup.
