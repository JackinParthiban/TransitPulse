import pandas as pd
import numpy as np
import random
import os

print("Generating Historical Transit Data...")

# Config
NUM_RECORDS = 5000
ROUTES = ["Route_A", "Route_B", "Route_ESP"]
WEATHER = ["Clear", "Rain", "Heavy Rain"]

data = []

for _ in range(NUM_RECORDS):
    route = random.choice(ROUTES)
    hour = random.randint(6, 22) # Operating hours 6 AM to 10 PM
    day_of_week = random.randint(0, 6) # 0=Monday, 6=Sunday
    weather = random.choice(WEATHER)
    
    # Base ETA logic
    base_eta = 15 if route == "Route_A" else (25 if route == "Route_B" else 10)
    
    # Introduce delays for Rush Hour (8-10 AM, 5-7 PM)
    if hour in [8, 9, 17, 18]:
        base_eta += random.randint(5, 15)
        
    # Introduce delays for Weather
    if weather == "Rain":
        base_eta += random.randint(2, 5)
    elif weather == "Heavy Rain":
        base_eta += random.randint(10, 20)
        
    # Weekend traffic is generally lighter
    if day_of_week in [5, 6]:
        base_eta -= random.randint(0, 5)
        
    # Add minor noise
    actual_eta = max(1, base_eta + random.randint(-2, 3))
    
    data.append({
        "route_id": route,
        "hour_of_day": hour,
        "day_of_week": day_of_week,
        "weather": weather,
        "actual_eta_minutes": actual_eta
    })

df = pd.DataFrame(data)

# Save to CSV
os.makedirs('data', exist_ok=True)
df.to_csv('data/historical_transit_data.csv', index=False)

print(f"Successfully generated {NUM_RECORDS} rows of transit data at 'data/historical_transit_data.csv'")
print(df.head())
