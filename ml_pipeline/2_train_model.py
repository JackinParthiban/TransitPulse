import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import mean_absolute_error
import joblib
import os

print("--- TransitPulse ML Training Pipeline ---")

# 1. Load Data
data_path = 'data/historical_transit_data.csv'
if not os.path.exists(data_path):
    print(f"Error: {data_path} not found. Please run 1_generate_dataset.py first.")
    exit()

df = pd.read_csv(data_path)

# 2. Preprocess Data (Encode strings into numbers for the AI)
print("Preprocessing features...")
le_route = LabelEncoder()
df['route_encoded'] = le_route.fit_transform(df['route_id'])

le_weather = LabelEncoder()
df['weather_encoded'] = le_weather.fit_transform(df['weather'])

# Define Inputs (X) and Target (y)
X = df[['route_encoded', 'hour_of_day', 'day_of_week', 'weather_encoded']]
y = df['actual_eta_minutes']

# Split into Training (80%) and Testing (20%)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# 3. Train Model
print("Training Random Forest Regressor Model...")
model = RandomForestRegressor(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

# 4. Evaluate Model
predictions = model.predict(X_test)
error = mean_absolute_error(y_test, predictions)
print(f"Model Mean Absolute Error: {error:.2f} minutes")
print(f"Algorithm successfully learned traffic patterns with ~ {error:.2f} min accuracy margin.")

# 5. Save Model for Real-Time Inference
os.makedirs('models', exist_ok=True)
joblib.dump(model, 'models/eta_predictor.pkl')
joblib.dump(le_route, 'models/le_route.pkl')
joblib.dump(le_weather, 'models/le_weather.pkl')

print("Model and Encoders successfully saved to /models directory!")
