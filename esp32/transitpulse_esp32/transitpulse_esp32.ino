#include <WiFi.h>
#include <Firebase_ESP_Client.h>

// Provide the token generation process info.
#include "addons/TokenHelper.h"
// Provide the RTDB payload printing info and other helper functions.
#include "addons/RTDBHelper.h"

// ==========================================
// CONFIGURATION
// ==========================================
#define WIFI_SSID "NetBro"
#define WIFI_PASSWORD "bro123bro"
#define API_KEY "AIzaSyBDaIQGTf5Sxa0MpVQ8g7nkDv-qjOj-X8o"
#define DATABASE_URL "transitpulse-64a38-default-rtdb.asia-southeast1.firebasedatabase.app"

// ==========================================
// FIREBASE OBJECTS
// ==========================================
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

bool signupOK = false;
unsigned long sendDataPrevMillis = 0;
const unsigned long timerDelay = 4000; // Update all buses every 4 seconds

// ==========================================
// SIMULATED ROUTE PATHS 
// ==========================================
// Since GPS is restricted, the ESP32 acts as the Fleet Management Edge Node.
struct GeoPoint {
  float lat;
  float lng;
};

// Map real-world coordinates for the routes
GeoPoint routeA[] = { {13.0827, 80.2707}, {13.0691, 80.2818}, {13.0538, 80.2820}, {13.0402, 80.2785}, {13.0312, 80.2774}, {13.0125, 80.2598}, {13.0066, 80.2575} };
GeoPoint routeB[] = { {12.9229, 80.1275}, {12.9516, 80.1462}, {12.9665, 80.1558}, {12.9822, 80.1706}, {13.0016, 80.2014}, {13.0067, 80.2206} };
GeoPoint routeESP[] = { {12.9785, 80.2208}, {12.9815, 80.2225}, {12.9840, 80.2270}, {12.9865, 80.2320}, {12.9880, 80.2370} };

// ==========================================
// BUS STATE MACHINE
// ==========================================
struct BusSim {
    String busId;
    String routeId;
    GeoPoint* path;
    int pathLen;
    int currentIndex;
    int targetIndex;
    int direction;
    float currentLat;
    float currentLng;
    int speed;
    int etaBase;
};

const int NUM_BUSES = 11;
BusSim fleet[NUM_BUSES] = {
  // 4 Buses on Route A
  {"Bus_01", "Route_A", routeA, 7, 0, 1, 1, 13.0827, 80.2707, 40, 15},
  {"Bus_02", "Route_A", routeA, 7, 1, 2, 1, 13.0691, 80.2818, 42, 12},
  {"Bus_03", "Route_A", routeA, 7, 4, 3, -1, 13.0312, 80.2774, 38, 18},
  {"Bus_04", "Route_A", routeA, 7, 2, 1, -1, 13.0538, 80.2820, 45, 8},
  // 3 Buses on Route B
  {"Bus_05", "Route_B", routeB, 6, 0, 1, 1, 12.9229, 80.1275, 35, 25},
  {"Bus_06", "Route_B", routeB, 6, 1, 2, 1, 12.9516, 80.1462, 37, 15},
  {"Bus_07", "Route_B", routeB, 6, 3, 2, -1, 12.9822, 80.1706, 40, 20},
  // 3 Simulated Buses on Route ESP
  {"Bus_08", "Route_ESP", routeESP, 5, 0, 1, 1, 12.9785, 80.2208, 32, 10},
  {"Bus_09", "Route_ESP", routeESP, 5, 1, 2, 1, 12.9815, 80.2225, 35, 8},
  {"Bus_10", "Route_ESP", routeESP, 5, 3, 2, -1, 12.9865, 80.2320, 42, 14},
  // The actual ESP32 primary identifier demonstrating hardware operation
  {"Bus_ESP32_01", "Route_ESP", routeESP, 5, 0, 1, 1, 12.9785, 80.2208, 40, 15}
};

// ==========================================
// INTERPOLATION HELPER
// ==========================================
float stepTowards(float current, float target, float stepSize) {
  float diff = target - current;
  if (abs(diff) < stepSize) return target;
  if (diff > 0) return current + stepSize;
  return current - stepSize;
}

// ==========================================
// SETUP
// ==========================================
void setup() {
  Serial.begin(115200);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to Wi-Fi");

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    Serial.print(".");
    delay(500);
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nConnected! IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nFailed to connect to Wi-Fi.");
    while (1) delay(1000); 
  }

  // Firebase Setup
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  
  // Bypass Authentication completely since your Database Rules are set to Public
  config.signer.test_mode = true; 

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  
  Serial.println("Firebase initialized in Test Mode (No Auth)");
  signupOK = true;
}

// ==========================================
// MAIN LOOP
// ==========================================
bool routesSeeded = false;

void loop() {
  if (Firebase.ready() && signupOK) {

    // First time Firebase connects, inject the UI Route configs once.
    if (!routesSeeded) {
       FirebaseJson routesJson;
       routesJson.set("Route_A/name", "Central to Adyar");
       routesJson.set("Route_A/color", "#E63946");
       routesJson.set("Route_B/name", "Tambaram to Guindy");
       routesJson.set("Route_B/color", "#457B9D");
       routesJson.set("Route_ESP/name", "Velachery to Taramani");
       routesJson.set("Route_ESP/color", "#F4A261");
       Firebase.RTDB.setJSON(&fbdo, "/routes", &routesJson);
       routesSeeded = true;
       Serial.println("Routes Seeded Successfully.");
    }

    if (millis() - sendDataPrevMillis > timerDelay || sendDataPrevMillis == 0) {
      sendDataPrevMillis = millis();
    Serial.println("--- Calculating Fleet Step ---");
    long totalSpeed = 0;

    for (int i = 0; i < NUM_BUSES; i++) {
        BusSim &bus = fleet[i];
        GeoPoint targetPoint = bus.path[bus.targetIndex];
        
        // Define how far the bus moves based on its speed per loop
        float stepSize = bus.speed / 100000.0;

        // Mathematical Translation
        bus.currentLat = stepTowards(bus.currentLat, targetPoint.lat, stepSize);
        bus.currentLng = stepTowards(bus.currentLng, targetPoint.lng, stepSize);

        // Target reached check with a small error tolerance for floating points
        if (abs(bus.currentLat - targetPoint.lat) < 0.0001 && abs(bus.currentLng - targetPoint.lng) < 0.0001) {
            bus.currentIndex = bus.targetIndex;
            bus.targetIndex += bus.direction;
            
            // Rebound physics at the ends of the route
            if (bus.targetIndex >= bus.pathLen || bus.targetIndex < 0) {
                bus.direction *= -1;
                bus.targetIndex = bus.currentIndex + bus.direction;
            }
        }

        // Random mutations for demonstration realism
        String status = "On Time";
        bus.speed = random(30, 50);
        int occupancy = random(20, 70);

        // 5% chance the bus hits traffic
        if (random(0, 20) == 5) {
            status = "Delayed";
            bus.speed = random(5, 15);
        }
        totalSpeed += bus.speed;

        // JSON mapping
        FirebaseJson json;
        json.set("busId", bus.busId);
        json.set("routeId", bus.routeId);
        json.set("lat", bus.currentLat);
        json.set("lng", bus.currentLng);
        json.set("speed", bus.speed);
        json.set("occupancy", occupancy);
        json.set("status", status);
        
        String nextStop = (bus.direction == 1) ? "Forward Terminus" : "Backward Terminus";
        json.set("nextStop", nextStop);
        
        int eta = bus.etaBase - random(0, 5);
        if (eta < 1) eta = 1;
        json.set("eta", eta);
        
        // Tells Firebase to inject the actual Cloud Timestamp mathematically
        json.set("lastUpdated/.sv", "timestamp"); 

        // Send payload to DB
        String fbPath = "/buses/" + bus.busId;
        if (Firebase.RTDB.setJSON(&fbdo, fbPath.c_str(), &json)) {
            Serial.printf("[FWD] %s ok\n", bus.busId.c_str());
        } else {
            Serial.printf("[FAIL] %s: %s\n", bus.busId.c_str(), fbdo.errorReason().c_str());
        }
        
        // Critical: Provide small padding between JSON writes to allow 
        // the ESP32 Wi-Fi buffer to flush and avoid crash/restarts
        delay(50); 
    }

    // Update global dashboard analytics
    Firebase.RTDB.setInt(&fbdo, "/system_stats/averageSpeed", totalSpeed / NUM_BUSES);
    Firebase.RTDB.setInt(&fbdo, "/system_stats/totalActive", NUM_BUSES);
    Serial.println("--- Fleet Payload Send Complete ---");
  }
 }
}
