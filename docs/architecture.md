# TransitPulse Architecture & Upgrades

## 1. Current Architecture Analysis

The existing TransitPulse prototype effectively demonstrates a real-time IoT and web dashboard integration. 
- **map.html**: Renders a Leaflet map and listens directly to standard Firebase real-time database paths for bus telemetry. 
- **simulate.js**: Mocks multiple buses traversing coordinates. Crucial for demonstrating a fleet-level view without the overhead of physical devices.
- **ESP32 Node**: Acts as the single real hardware component updating its respective child node in Firebase.
- **Firebase Realtime Database**: Acts as the unified message broker syncing states across the ESP32, simulated units, and web clients.

**Why this is valid without external sensors?**
In many enterprise IoT systems (like shared mobility or smart cities), the physical edge node (ESP32) is simply a telemetry publisher. By simulating the GPS coordinate movement natively on the microcontroller (or pushing location via Wi-Fi triangulation which can be assumed in the context of the simulation), you successfully prove the *data pipeline*—edge to cloud to dashboard. The actual source of the GPS stream (a physical Neo-6M GPS vs an array loop) is transparent to the cloud, validating the overall system design.

**Weaknesses:**
1. Flat database schema lacking relational mapping (routes, stops, historical logs).
2. Lacks a heartbeat or `lastUpdated` timestamp logic, making it impossible to detect off-line or delayed buses.
3. Vulnerable to duplicate markers or malformed data causing UI crashes.
4. Single HTML file approach makes the frontend rigid and unmaintainable.

**Strengths:**
1. Clean separation between edge device stream and simulated streams into a centralized Firebase.
2. Lightweight, real-time sync with Firebase limits latency.

## 2. Final-Year Level Improvements
*All of these are purely software and cloud expansions (No extra hardware).*

1. **Relational Data Mapping**: Normalize Firebase into `/buses`, `/routes`, and `/system_logs`.
2. **Heartbeat Mechanism**: Every update writes a timestamp. The frontend visually fades out markers that haven't updated in 30 seconds (Offline Detection).
3. **Advanced Simulation & ESP32 Virtualization**: Make the ESP32 internally iterate through a predefined real-world coordinate array representing a specific route, making it behave identically to a real GPS stream.
4. **Rich Dashboard Analytics**: High occupancy badges, active/inactive fleet counts, and average speeds derived on the frontend or backend.
5. **Route Filtering**: Only show specific routes on the map to avoid clutter as the fleet scales.
6. **Alerts System**: Logic in `simulate.js` to randomly flag a bus as "Delayed" or "Rerouted", displaying warnings on the dashboard.

## 3. Upgraded Project Structure

```text
/TransitPulse
├── frontend
│   ├── index.html       (Passenger & Admin Dashboard UI)
│   ├── style.css        (Modern, Premium Styling)
│   ├── app.js           (Firebase logic, map rendering, UI updates)
│   └── assets/          (Images, icons, optional)
├── simulator
│   ├── package.json
│   └── simulate.js      (Node.js intelligent fleet simulator)
├── esp32
│   └── transitpulse_esp32
│       └── transitpulse_esp32.ino (Robust IoT client)
└── docs
    ├── architecture.md  (System overview)
    ├── firebase-schema.md
    ├── pitch.md         (Startup-level pitch & vision)
    ├── judges_guide.md  (How to explain to evaluators)
    └── README.md
```
