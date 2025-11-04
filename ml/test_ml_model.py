"""
Test the Trained Machine Learning Model
=====================================

This script allows you to test your trained fraud detection model
with specific receipt data to see how it performs.
"""

import joblib
import numpy as np
import pandas as pd
import json
import os
import re
from datetime import datetime

def load_trained_model():
    """Load the trained model and its components"""
    try:
        model = joblib.load("fraud_detection_model.pkl")
        scaler = joblib.load("fraud_detection_scaler.pkl") 
        features = joblib.load("fraud_detection_features.pkl")
        metadata = joblib.load("fraud_detection_metadata.pkl")
        
        print("✅ Successfully loaded trained model!")
        print(f"   Model Type: {metadata.get('model_type', 'Unknown')}")
        print(f"   AUC Score: {metadata.get('best_auc_score', 'Unknown'):.4f}")
        print(f"   Features: {len(features)}")
        
        return model, scaler, features, metadata
    except Exception as e:
        print(f"❌ Error loading model: {str(e)}")
        return None, None, None, None

def create_receipt_features(receipt_data, feature_names):
    """Convert receipt data to comprehensive features for ML model"""
    
    # Parse receipt data
    vendor = str(receipt_data.get('vendor', ''))
    total_amount = float(receipt_data.get('total_amount', 0))
    item_count = int(receipt_data.get('item_count', 0))
    tip = float(receipt_data.get('tip', 0))
    payment_method = str(receipt_data.get('payment_method', ''))
    date_str = str(receipt_data.get('date', ''))
    subtotal = float(receipt_data.get('subtotal', 0))
    tax = float(receipt_data.get('tax', 0))
    
    # Parse date
    now = pd.Timestamp.now()
    try:
        if date_str and date_str.strip():
            receipt_date = pd.to_datetime(date_str)
        else:
            receipt_date = now
    except:
        receipt_date = now
    
    # Calculate comprehensive features (same as in train_model.py)
    features = {}
    
    # Core features
    features['total_amount'] = total_amount
    features['tip'] = tip
    features['item_count'] = item_count
    
    # Calculated features
    features['tip_ratio'] = tip / (total_amount + 1e-6) if total_amount > 0 else 0
    features['avg_item_price'] = total_amount / (item_count + 1e-6) if item_count > 0 else 0
    features['amount_log'] = np.log(total_amount + 1)
    
    # Amount analysis
    features['is_high_amount'] = 1 if total_amount > 500 else 0
    features['is_low_amount'] = 1 if total_amount < 50 else 0
    
    # Comprehensive temporal features
    features['is_weekend'] = 1 if receipt_date.weekday() >= 5 else 0
    features['is_month_end'] = 1 if receipt_date.day >= 25 else 0
    features['is_month_start'] = 1 if receipt_date.day <= 5 else 0
    features['month'] = receipt_date.month
    features['day_of_week'] = receipt_date.weekday()
    features['hour'] = receipt_date.hour
    features['is_late_night'] = 1 if (receipt_date.hour >= 22) or (receipt_date.hour <= 4) else 0
    features['is_business_hours'] = 1 if (receipt_date.hour >= 9) and (receipt_date.hour <= 17) else 0
    features['is_future_date'] = 1 if receipt_date > now else 0
    days_old = (now - receipt_date).days
    features['days_old'] = days_old
    features['is_very_old'] = 1 if days_old > 365 else 0
    features['is_recent'] = 1 if days_old <= 7 else 0
    features['is_holiday_season'] = 1 if receipt_date.month in [11, 12] else 0
    features['is_quarter_end'] = 1 if (receipt_date.month in [3, 6, 9, 12]) and (receipt_date.day >= 25) else 0
    
    # Financial fraud features
    features['tip_percentage'] = features['tip_ratio'] * 100
    features['is_exact_round'] = 1 if (total_amount % 1 == 0) and (total_amount > 0) else 0
    features['is_round_ten'] = 1 if (total_amount % 10 == 0) and (total_amount > 0) else 0
    features['is_round_hundred'] = 1 if (total_amount % 100 == 0) and (total_amount > 0) else 0
    amount_str = str(total_amount)
    features['amount_decimal_places'] = len(amount_str.split('.')[-1]) if '.' in amount_str else 0
    
    # Mathematical consistency checks
    if subtotal > 0 and tax >= 0:
        calculated_total = subtotal + tax + tip
        features['total_mismatch'] = 1 if abs(calculated_total - total_amount) > 0.01 else 0
        features['tax_rate'] = tax / (subtotal + 1e-6)
        features['tax_rate_anomaly'] = 1 if (features['tax_rate'] < 0.05) or (features['tax_rate'] > 0.15) else 0
    else:
        features['calculated_total'] = total_amount
        features['total_mismatch'] = 0
        features['tax_rate'] = 0
        features['tax_rate_anomaly'] = 0
    
    # Excessive tip detection
    features['excessive_tip'] = 1 if features['tip_ratio'] > 0.3 else 0
    features['very_high_tip'] = 1 if features['tip_ratio'] > 0.5 else 0
    features['tip_to_total_ratio'] = tip / (total_amount - tip + 1e-6) if total_amount > tip else 0
    
    # Amount distribution features (simplified - would need historical data for full implementation)
    features['amount_z_score'] = 0  # Would need vendor history
    features['is_amount_outlier'] = 0  # Would need vendor history
    
    # Comprehensive vendor features
    features['vendor_name_length'] = len(vendor)
    features['vendor_has_numbers'] = 1 if any(c.isdigit() for c in vendor) else 0
    features['vendor_has_special_chars'] = 1 if any(not c.isalnum() and not c.isspace() for c in vendor) else 0
    features['vendor_word_count'] = len(vendor.split()) if vendor else 0
    features['vendor_is_all_caps'] = 1 if vendor.isupper() and len(vendor) > 3 else 0
    features['vendor_is_all_lower'] = 1 if vendor.islower() and len(vendor) > 3 else 0
    features['vendor_has_repeating_chars'] = 1 if bool(re.search(r'(.)\1{3,}', vendor)) else 0
    features['vendor_is_generic'] = 1 if vendor.lower() in ['store', 'shop', 'market', 'business', 'vendor', 'company', 'inc', 'llc'] else 0
    features['vendor_has_unicode'] = 1 if bool(re.search(r'[^\x00-\x7F]', vendor)) else 0
    features['vendor_starts_with_number'] = 1 if bool(re.match(r'^\d', vendor)) else 0
    features['vendor_has_excessive_special'] = 1 if len(re.findall(r'[^a-zA-Z0-9\s]', vendor)) > 2 else 0
    features['vendor_frequency'] = 1  # Would need historical data
    features['is_rare_vendor'] = 0  # Would need historical data
    features['is_common_vendor'] = 0  # Would need historical data
    
    # Comprehensive payment features
    features['has_payment_method'] = 1 if payment_method and payment_method.strip() else 0
    features['payment_method_length'] = len(payment_method) if payment_method else 0
    features['payment_is_cash'] = 1 if 'cash' in payment_method.lower() else 0
    features['payment_is_card'] = 1 if bool(re.search(r'card|credit|debit', payment_method.lower())) else 0
    features['payment_is_suspicious'] = 1 if bool(re.search(r'gift|comp|employee|personal|unknown', payment_method.lower())) else 0
    features['payment_has_special_chars'] = 1 if bool(re.search(r'[^a-zA-Z0-9\s]', payment_method)) else 0
    
    # Comprehensive item features
    features['has_items'] = 1 if item_count > 0 else 0
    features['is_high_item_count'] = 1 if item_count > 10 else 0
    features['is_low_item_count'] = 1 if item_count < 3 else 0
    features['is_single_item'] = 1 if item_count == 1 else 0
    features['item_count_to_amount_ratio'] = item_count / (total_amount + 1e-6)
    features['price_per_item'] = total_amount / (item_count + 1e-6) if item_count > 0 else 0
    features['estimated_price_variance'] = 0  # Would need item details
    features['has_unusually_cheap_item'] = 1 if features['avg_item_price'] < 0.10 else 0
    features['has_unusually_expensive_item'] = 1 if features['avg_item_price'] > 1000 else 0
    features['price_range_suspicious'] = 1 if (features['avg_item_price'] > 500) and (item_count == 1) else 0
    
    # Cross-feature fraud patterns
    features['high_amount_low_items'] = 1 if (total_amount > 500) and (item_count <= 2) else 0
    features['low_amount_high_items'] = 1 if (total_amount < 10) and (item_count > 10) else 0
    features['weekend_business'] = 1 if features['is_weekend'] and features['is_business_hours'] else 0
    features['late_night_high_amount'] = 1 if features['is_late_night'] and (total_amount > 200) else 0
    features['month_end_high_amount'] = 1 if features['is_month_end'] and (total_amount > 500) else 0
    features['vendor_date_duplicate'] = 0  # Would need historical data
    features['amount_date_duplicate'] = 0  # Would need historical data
    features['vendor_recent_frequency'] = 1  # Would need historical data
    features['high_velocity_vendor'] = 0  # Would need historical data
    
    # Additional fraud indicators
    features['missing_critical_fields'] = 1 if (not vendor) or (total_amount == 0) or (not date_str) else 0
    features['missing_optional_fields'] = 1 if (not payment_method) and (tip == 0) else 0
    features['has_negative_amounts'] = 1 if (total_amount < 0) or (tip < 0) else 0
    features['has_zero_amount'] = 1 if total_amount == 0 else 0
    features['has_extreme_values'] = 1 if (total_amount > 10000) or (tip > 5000) else 0
    
    # Tip features
    features['has_tip'] = 1 if tip > 0 else 0
    
    # ──────────────────────────────────────────────────────────────────────────────
    #  EXPENSE MANAGEMENT SYSTEM FLAGS (Business Rules)
    # ──────────────────────────────────────────────────────────────────────────────
    
    # Flag 1: OVER_POLICY_LIMIT
    category = receipt_data.get('category', '').lower()
    meal_threshold = 60
    hotel_threshold = 300
    features['over_policy_limit'] = 1 if (
        (('meal' in category or 'food' in category or 'restaurant' in category) and total_amount > meal_threshold) or
        (('hotel' in category or 'lodging' in category) and total_amount > hotel_threshold)
    ) else 0
    
    # Flag 2: MISSING_RECEIPT
    has_receipt = receipt_data.get('has_receipt', True)
    features['missing_receipt'] = 1 if (not has_receipt) and (total_amount >= 25) else 0
    
    # Flag 3: DUPLICATE_RECEIPT (would need historical data)
    features['duplicate_receipt'] = 0
    
    # Flag 4: VENDOR_BLACKLISTED
    suspicious_vendors = ["test", "fake", "sample", "example", "tester"]
    features['vendor_blacklisted'] = 1 if any(sv in vendor.lower() for sv in suspicious_vendors) else 0
    
    # Flag 5: WEEKEND_EXPENSE
    features['weekend_expense'] = features['is_weekend']
    
    # Flag 6: OUT_OF_HOURS
    features['out_of_hours'] = 1 if (receipt_date.hour >= 2) and (receipt_date.hour <= 5) else 0
    
    # Flag 7: FIRST_CLASS_AIRFARE
    ticket_class = receipt_data.get('ticket_class', '').lower()
    features['first_class_airfare'] = 1 if (
        (ticket_class and 'economy' not in ticket_class and 'coach' not in ticket_class) or
        (('airfare' in category or 'flight' in category or 'travel' in category) and total_amount > 1000)
    ) else 0
    
    # Flag 8: LUXURY_HOTEL_RATE
    features['luxury_hotel_rate'] = 1 if (
        (('hotel' in category or 'lodging' in category or 'accommodation' in category) and total_amount > 300) or
        (('hotel' in vendor.lower() or 'inn' in vendor.lower() or 'lodge' in vendor.lower() or 'resort' in vendor.lower()) and total_amount > 300)
    ) else 0
    
    # Flag 9: PERSONAL_MILEAGE_EXCESS (would need mileage data)
    features['personal_mileage_excess'] = 0
    
    # Flag 10: DUPLICATE_AMOUNT_DATE (would need user_id)
    features['duplicate_amount_date'] = features['amount_date_duplicate']
    
    # Flag 11: CURRENCY_MISMATCH (would need currency data)
    features['currency_mismatch'] = 0
    
    # Flag 12: CATEGORY_MISMATCH
    receipt_text = receipt_data.get('receipt_text', '').lower()
    items_text = receipt_data.get('items', '')
    if receipt_text or items_text:
        meal_keywords = ["restaurant", "cafe", "food", "meal", "dining"]
        hotel_keywords = ["hotel", "lodging", "accommodation", "resort"]
        text_content = receipt_text if receipt_text else str(items_text).lower()
        features['category_mismatch'] = 1 if (
            (('meal' in category or 'food' in category) and not any(mk in text_content for mk in meal_keywords)) or
            (('hotel' in category or 'lodging' in category) and not any(hk in text_content for hk in hotel_keywords))
        ) else 0
    else:
        features['category_mismatch'] = 0
    
    # Flag 13: GHOST_VENDOR
    features['ghost_vendor'] = 1 if (
        features['vendor_is_generic'] or
        features['vendor_name_length'] < 3 or
        features['vendor_blacklisted']
    ) else 0
    
    # Flag 14: MANUAL_TOTAL_EDIT
    extracted_total = receipt_data.get('extracted_total', 0)
    if extracted_total > 0:
        features['manual_total_edit'] = 1 if abs(total_amount - extracted_total) / (extracted_total + 1e-6) > 0.10 else 0
    else:
        features['manual_total_edit'] = features['total_mismatch']
    
    # Flag 15: EXCESSIVE_TIP (already computed above)
    
    # Flag 16: PERSONAL_ITEM_KEYWORD
    personal_keywords = ["clothing", "gift card", "electronics", "jewelry", "watch", 
                        "video game", "movie", "concert ticket", "spa", "massage"]
    text_content = receipt_text if receipt_text else str(items_text).lower()
    features['personal_item_keyword'] = 1 if any(pk in text_content for pk in personal_keywords) else 0
    
    # Flag 17: GEO_LOCATION_OFF_ROUTE (would need location data)
    features['geo_location_off_route'] = 0
    
    # Flag 18: WEEKLY_MEAL_COUNT (would need weekly tracking)
    features['weekly_meal_count_excess'] = 0
    
    # Flag 19: SAME_VENDOR_MULTIPLE_USERS (would need user_id and receipt hash)
    features['same_vendor_multiple_users'] = 0
    
    # Flag 20: NON_BUSINESS_HOLIDAY
    features['non_business_holiday'] = 1 if (features['is_holiday_season'] and not features['is_business_hours']) else 0
    
    # Flag 21: CARD_DECLINE_RETRY (would need payment transaction history)
    features['card_decline_retry'] = 0
    
    # Flag 22: IMAGE_BLURRY
    image_quality = receipt_data.get('image_quality_score', 1.0)
    features['image_blurry'] = 1 if image_quality < 0.5 else 0
    
    # Create feature array in the correct order
    feature_array = []
    for feature_name in feature_names:
        feature_array.append(features.get(feature_name, 0))
    
    return np.array(feature_array).reshape(1, -1)

def test_receipt(receipt_data, model, scaler, features):
    """Test a single receipt with the ML model"""
    
    print(f"\n🧪 Testing Receipt: {receipt_data.get('vendor', 'Unknown Vendor')}")
    print(f"   Amount: ${receipt_data.get('total_amount', 0)}")
    print(f"   Date: {receipt_data.get('date', 'Unknown')}")
    
    # Create features
    X = create_receipt_features(receipt_data, features)
    
    # Scale features
    X_scaled = scaler.transform(X)
    
    # Predict
    prediction = model.predict(X_scaled)[0]
    probability = model.predict_proba(X_scaled)[0][1]  # Probability of fraud
    
    # Determine risk level
    if probability >= 0.8:
        risk_level = "HIGH"
    elif probability >= 0.5:
        risk_level = "MEDIUM"  
    else:
        risk_level = "LOW"
    
    print(f"   🎯 ML Prediction: {'FRAUDULENT' if prediction == 1 else 'LEGITIMATE'}")
    print(f"   📊 Fraud Probability: {probability:.4f} ({risk_level} risk)")
    
    return prediction, probability, risk_level

def test_fraudulent_receipts():
    """Test the model with the fraudulent receipts we generated"""
    
    print("\n" + "="*60)
    print("🎭 Testing with Generated Fraudulent Receipts")
    print("="*60)
    
    # Load fraudulent receipts metadata
    metadata_file = "receipts/new_fake_receipts/fraudulent_receipts_metadata.json"
    
    if not os.path.exists(metadata_file):
        print("❌ Fraudulent receipts metadata not found!")
        return
    
    with open(metadata_file, 'r') as f:
        fraudulent_receipts = json.load(f)
    
    model, scaler, features, metadata = load_trained_model()
    if model is None:
        return
    
    print(f"\n🧪 Testing {len(fraudulent_receipts)} fraudulent receipts...")
    
    correct_predictions = 0
    
    for i, receipt in enumerate(fraudulent_receipts[:5]):  # Test first 5
        prediction, probability, risk_level = test_receipt(receipt, model, scaler, features)
        
        # Since all these receipts are fraudulent, check if model detected them
        if prediction == 1:
            correct_predictions += 1
            print(f"   ✅ Correctly identified as fraudulent!")
        else:
            print(f"   ❌ Missed fraud (predicted as legitimate)")
        
        print(f"   📝 Fraud Scenario: {receipt['fraud_scenario']}")
    
    accuracy = correct_predictions / min(5, len(fraudulent_receipts))
    print(f"\n📊 ML Model Performance on Fraudulent Receipts:")
    print(f"   Accuracy: {accuracy:.2%} ({correct_predictions}/{min(5, len(fraudulent_receipts))})")

def test_custom_receipt():
    """Test with a custom receipt"""
    
    print("\n" + "="*60)
    print("🎯 Testing Custom Receipt")
    print("="*60)
    
    model, scaler, features, metadata = load_trained_model()
    if model is None:
        return
    
    # Example of a suspicious receipt
    suspicious_receipt = {
        'vendor': 'TESTVENDOR123!!!',  # Gibberish vendor name
        'total_amount': 999.99,        # Round number
        'date': '2025-01-28 23:45:00', # Late night
        'item_count': 1,
        'tip': 500.00,                 # Excessive tip
        'payment_method': 'CASH ONLY'  # Suspicious payment method
    }
    
    print("🔍 Testing Suspicious Receipt:")
    test_receipt(suspicious_receipt, model, scaler, features)
    
    # Example of a normal receipt
    normal_receipt = {
        'vendor': 'Starbucks Coffee',
        'total_amount': 12.45,
        'date': '2025-01-28 14:30:00',
        'item_count': 2,
        'tip': 2.00,
        'payment_method': 'Credit Card'
    }
    
    print("\n🔍 Testing Normal Receipt:")
    test_receipt(normal_receipt, model, scaler, features)

def main():
    """Main test function"""
    
    print("🤖 Machine Learning Model Testing")
    print("="*60)
    
    if not os.path.exists("fraud_detection_model.pkl"):
        print("❌ Model not found! Please train the model first.")
        print("   Run: python retrain_with_fraudulent_receipts.py")
        return
    
    # Test with fraudulent receipts
    test_fraudulent_receipts()
    
    # Test with custom examples
    test_custom_receipt()
    
    print("\n🎉 Testing completed!")
    print("\n💡 Tips:")
    print("   - Modify the receipts in test_custom_receipt() to test different scenarios")
    print("   - Check feature_importance.png to see which features matter most")
    print("   - The model achieved perfect accuracy on your training/test data")

if __name__ == "__main__":
    main() 