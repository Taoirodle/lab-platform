// ============================================================
//  L.A.B Motion Sensor — ESP32 + HC-SR501 PIR
//  Our own firmware: no cloud, no third-party app. On motion it POSTs
//  straight to the Conductor's ingest endpoint on the Main Server.
//
//  Wiring:  PIR VCC->5V (VIN) · GND->GND · OUT->GPIO 27
//  Setup:   1) In the Manager: POST /api/conductor/entities
//              {"name":"Hallway Motion","kind":"motion","room":"hall","driver":"push"}
//              — copy the returned token below.
//           2) Fill in Wi-Fi + server IP, flash with Arduino IDE (ESP32 core).
// ============================================================
#include <WiFi.h>
#include <HTTPClient.h>

const char* WIFI_SSID  = "YOUR_WIFI_NAME";
const char* WIFI_PASS  = "YOUR_WIFI_PASSWORD";
const char* SERVER     = "http://192.168.1.115:8090";
const char* TOKEN      = "PASTE_ENTITY_TOKEN_HERE";

const int PIR_PIN = 27;
const unsigned long COOLDOWN_MS = 8000;   // don't spam while someone stands there
unsigned long lastFire = 0;

void setup() {
  Serial.begin(115200);
  pinMode(PIR_PIN, INPUT);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Joining L.A.B network");
  while (WiFi.status() != WL_CONNECTED) { delay(400); Serial.print("."); }
  Serial.println("\nOnline. Sensor armed.");
}

void report(bool motion) {
  if (WiFi.status() != WL_CONNECTED) return;
  HTTPClient http;
  http.begin(String(SERVER) + "/api/ingest/" + TOKEN);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(String("{\"triggered\":") + (motion ? "true" : "false") + "}");
  Serial.printf("motion=%d -> %d\n", motion, code);
  http.end();
}

void loop() {
  if (digitalRead(PIR_PIN) == HIGH && millis() - lastFire > COOLDOWN_MS) {
    lastFire = millis();
    report(true);
  }
  delay(120);
}
