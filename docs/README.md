# TransitPulse

A smart public transport tracking and fleet management system built with ESP32 edge components, a Node.js simulator for scaling, Firebase Realtime Database cloud-backend, and a dynamic Leaflet.js dashboard. 

## Features
* **Real-time Map Visualization**: Fluid Leaflet map powered by OpenStreetMap markers updating via Firebase.
* **Hybrid Virtual/Physical Fleet**: Handles simulated bus movements seamlessly alongside real-life ESP32 IoT endpoints.
* **Heartbeat & Status Detection**: Identifies offline or delayed transport components natively.
* **Premium UX/UI**: Clean gradients, glassmorphism, responsive summary panels, and live event alert grids.

## Setup Instructions

### 1. Firebase Setup
1. Create a Firebase project at console.firebase.google.com.
2. Enable **Realtime Database**. 
3. Edit Rules to be open for development:
   ```json
   {
     "rules": {
       ".read": "true",
       ".write": "true"
     }
   }
   ```
4. Copy your Web Config details (apiKey, databaseURL, projectId, etc.).

### 2. Frontend Configuration
1. Open `frontend/app.js`.
2. Replace the `firebaseConfig` object with your Firebase project credentials.
3. Simply open `frontend/index.html` in any modern web browser to view the application locally (or host it via Vercel/Netlify for production).

### 3. Node.js Simulator
1. Navigate to the `simulator` directory via Terminal: `cd TransitPulse/simulator`
2. Run `npm install` to grab the Firebase Admin SDK.
3. Download your Firebase Admin `service-account-key.json` and place it in the simulator folder.
4. Update initialization inside `simulate.js`.
5. Run the simulator: `node simulate.js`.
6. Watch the buses magically appear on your frontend.

### 4. ESP32 Edge Device
1. Open the `esp32/transitpulse_esp32/transitpulse_esp32.ino` sketch in Arduino IDE.
2. Install the `Firebase ESP Client` library by Mobizt.
3. Install `WiFi` library.
4. Insert your Wi-Fi SSID, Password, Firebase Project URL, and Auth Secret inside the `.ino` file.
5. Compile and flash to the ESP32.
6. The ESP32 will connect and publish to `/buses/Bus_ESP32_01`, appearing automatically on the web dashboard.
