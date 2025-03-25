from flask import Flask, request, jsonify
import joblib
import re
import pandas as pd
from flask_cors import CORS
import logging
import sys
import io

# Fix encoding issues for Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# --- Flask Setup ---
app = Flask(__name__)
CORS(app)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Paths ---
PREDICTOR_PATH = r"D:\Documents\IIT\FYP\CSS-code-smell-Others\API\test\css_model.pkl"
SCALER_PATH    = r"D:\Documents\IIT\FYP\CSS-code-smell-Others\API\test\css_scaler.pkl"
KMEANS_PATH    = r"D:\Documents\IIT\FYP\CSS-code-smell-Others\API\test\css_kmeans.pkl"

try:
    clf = joblib.load(PREDICTOR_PATH)     # 👈 Correct: RandomForestRegressor
    scaler = joblib.load(SCALER_PATH)     # 👈 Correct: StandardScaler
    kmeans = joblib.load(KMEANS_PATH)     # 👈 Correct: KMeans
    print("✅ All models loaded successfully")
except Exception as e:
    print(f"❌ Model loading failed: {e}")


# --- Load Models ---
try:
    clf = joblib.load(PREDICTOR_PATH)
    logger.info("✅ Predictor model loaded.")
except Exception as e:
    logger.error(f"❌ Failed to load predictor model: {e}")
    clf = None

try:
    kmeans = joblib.load(KMEANS_PATH)
    logger.info("✅ KMeans model loaded.")
except Exception as e:
    logger.error(f"❌ Failed to load KMeans model: {e}")
    kmeans = None

try:
    scaler = joblib.load(SCALER_PATH)
    logger.info("✅ Scaler loaded.")
except Exception as e:
    logger.error(f"❌ Failed to load scaler: {e}")
    scaler = None

# --- Cluster → Severity Mapping ---
cluster_to_severity = {
    0: "Clean",
    1: "Low",
    2: "Medium",
    3: "High"
}

# --- Feature Extraction ---
def extract_features_from_css(css_code):
    if not css_code.strip():
        return [], {}

    features = {
        "nesting_depth": css_code.count('{') - css_code.count('}'),
        "num_ids": css_code.count('#'),
        "num_classes": css_code.count('.'),
        "num_important": css_code.count('!important'),
        "duplicate_selectors": len(re.findall(r'([^\{\}]+)\s*\{', css_code)) - len(set(re.findall(r'([^\{\}]+)\s*\{', css_code))),
        "total_rules": css_code.count('}'),
        "deep_nesting": max([line.count('{') for line in css_code.split('\n') if '{' in line] + [0]),
        "long_selectors": sum(1 for selector in re.findall(r'([^\{\}]+)\s*\{', css_code) if len(selector) > 50),
        "overqualified_selectors": sum(1 for selector in re.findall(r'([^\{\}]+)\s*\{', css_code) if 'html' in selector or 'body' in selector),
        "browser_specific_properties": sum(1 for prop in re.findall(r'-(moz|webkit|ms|o)-', css_code)),
        "total_properties": css_code.count(';'),
        "avg_properties_per_rule": css_code.count(';') / (css_code.count('}') + 1) if css_code.count('}') > 0 else 0,
        "inline_styles": css_code.count('style='),
        "unused_selectors": sum(1 for selector in re.findall(r'([^\{\}]+)\s*\{', css_code) if len(selector.split()) > 3),
        "universal_selectors": css_code.count('*'),
        "excessive_specificity": sum(1 for selector in re.findall(r'([^\{\}]+)\s*\{', css_code) if selector.count(' ') > 3),
        "vendor_prefixes": sum(1 for _ in re.findall(r'-(webkit|moz|ms|o)-', css_code)),
        "animation_usage": css_code.count('@keyframes'),
        "excessive_zindex": sum(1 for prop in re.findall(r'z-index\s*:\s*(\d+)', css_code) if int(prop) > 10),
        "unused_media_queries": sum(1 for mq in re.findall(r'@media\s*\((.*?)\)', css_code) if 'print' in mq or 'speech' in mq),
        "color_hex_usage": css_code.count('#'),
        "excessive_font_sizes": sum(1 for prop in re.findall(r'font-size\s*:\s*(\d+)', css_code) if int(prop) > 40)
    }

    return list(features.values()), features

# --- Prediction Endpoint ---
# @app.route('/predict', methods=['POST'])
print("SCALER TYPE:", type(scaler))

@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.json
        css_code = data.get("css_code", "")

        if not css_code.strip():
            return jsonify({"error": "No CSS code provided", "features": {}, "smells": {}}), 400

        # 1. Extract features
        feature_list, feature_dict = extract_features_from_css(css_code)
        if not feature_list or not feature_dict:
            return jsonify({"error": "Feature extraction failed", "features": {}, "smells": {}}), 500

        # 2. Prepare DataFrame
        feature_names = [
            "nesting_depth", "num_ids", "num_classes", "num_important", 
            "duplicate_selectors", "total_rules", "deep_nesting", "long_selectors", 
            "overqualified_selectors", "browser_specific_properties", "total_properties", 
            "avg_properties_per_rule", "inline_styles", "unused_selectors", "universal_selectors", 
            "excessive_specificity", "vendor_prefixes", "animation_usage", "excessive_zindex", 
            "unused_media_queries", "color_hex_usage", "excessive_font_sizes"
        ]
        feature_df = pd.DataFrame([feature_list], columns=feature_names)

        # ✅✅ 3. SCALE with the SCALER (not the model!)
        if scaler is not None:
            print("SCALER TYPE:", type(scaler))
            # scaled_features = scaler.transform(feature_df)
            scaled_features = pd.DataFrame(scaler.transform(feature_df), columns=feature_df.columns)
            prediction = clf.predict(scaled_features)[0]
            cluster = kmeans.predict(scaled_features)[0]

        else:
            scaled_features = feature_df.values

        # ✅ 4. Predict smell count
        predicted_smells = clf.predict(scaled_features)[0]

        # ✅ 5. Cluster prediction
        if kmeans is not None:
            cluster = kmeans.predict(scaled_features)[0]
            severity_label = cluster_to_severity.get(cluster, "Unknown")
        else:
            cluster = -1
            severity_label = "Unknown"

        smells = {k: v for k, v in feature_dict.items() if v > 0}

        response = {
            "prediction": round(predicted_smells, 2),
            "cluster": int(cluster),
            "severity_level": severity_label,
            "features": feature_dict,
            "smells": smells
        }

        return jsonify(response)

    except Exception as e:
        logger.error(f"❌ Error in prediction: {e}")
        return jsonify({
            "error": "Internal Server Error",
            "details": str(e),
            "features": {},
            "smells": {}
        }), 500

# --- Health Check ---
@app.route('/')
def health_check():
    return "🔥 CSS Smell Detection API is up and running!"

# --- Run the Server ---
if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000, debug=True)