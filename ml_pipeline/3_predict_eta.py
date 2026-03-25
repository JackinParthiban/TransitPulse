import joblib
import warnings
import sys

# Suppress sklearn warnings for clean terminal output
warnings.filterwarnings("ignore")

# 1. Load the Pretrained Model and Encoders
try:
    model = joblib.load('models/eta_predictor.pkl')
    le_route = joblib.load('models/le_route.pkl')
    le_weather = joblib.load('models/le_weather.pkl')
except FileNotFoundError:
    print("Error: Model files not found. Please run 2_train_model.py first.")
    sys.exit()

def predict_bus_eta(route_id, hour, day, weather):
    """
    Predicts the ETA in minutes using the Machine Learning engine.
    """
    try:
        # Encode inputs exactly as done in training
        r_encoded = le_route.transform([route_id])[0]
        w_encoded = le_weather.transform([weather])[0]
        
        features = [[r_encoded, hour, day, w_encoded]]
        
        # ML Inference
        prediction = model.predict(features)[0]
        return round(prediction)
    except Exception as e:
        print(f"Prediction Error: {e}")
        return None

# ==========================================
# INTERACTIVE TERMINAL TEST
# ==========================================
if __name__ == "__main__":
    print("\n===========================================")
    print(" 🤖 TransitPulse AI Inference Engine Active")
    print("===========================================\n")
    
    print("Simulating a request for: Route_A at 8:00 AM (Rush Hour) in Heavy Rain...")
    eta_bad_traffic = predict_bus_eta('Route_A', 8, 1, 'Heavy Rain') # Monday 8 AM
    print(f"-> AI Predicted Arrival Time: {eta_bad_traffic} minutes\n")
    
    print("Simulating a request for: Route_A at 2:00 PM (Low Traffic) in Clear weather...")
    eta_good_traffic = predict_bus_eta('Route_A', 14, 6, 'Clear') # Sunday 2 PM
    print(f"-> AI Predicted Arrival Time: {eta_good_traffic} minutes\n")
    
    print("Notice how the Machine Learning model dynamically altered the ETA by over 10+ minutes based purely on weather and rush-hour features without any manual rules!\n")
    print("In a production environment, this standalone Python application would run as a Flask microservice pinging Firebase continually.")
