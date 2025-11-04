#!/usr/bin/env python3
"""
Standalone ML Prediction Script
===============================

This script loads the trained ML model and makes a single prediction.
Designed to be called from Next.js API routes via child process.
"""

import sys
import json
import joblib
import numpy as np
import pandas as pd
import re
from datetime import datetime
import os

def load_model():
    """Load the trained ML model and its components"""
    try:
        model = joblib.load("fraud_detection_model.pkl")
        scaler = joblib.load("fraud_detection_scaler.pkl") 
        features = joblib.load("fraud_detection_features.pkl")
        metadata = joblib.load("fraud_detection_metadata.pkl")
        return model, scaler, features, metadata
    except Exception as e:
        print(json.dumps({"error": f"Failed to load model: {str(e)}"}), file=sys.stderr)
        return None, None, None, None

def create_receipt_features(receipt_data, feature_names):
    """Convert receipt data to comprehensive features for ML model"""
    
    # Parse receipt data with safe defaults
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
    features_dict = {}
    
    # Core features
    features_dict['total_amount'] = total_amount
    features_dict['tip'] = tip
    features_dict['item_count'] = item_count
    
    # Calculated features
    features_dict['tip_ratio'] = tip / (total_amount + 1e-6) if total_amount > 0 else 0
    features_dict['avg_item_price'] = total_amount / (item_count + 1e-6) if item_count > 0 else 0
    features_dict['amount_log'] = np.log(total_amount + 1)
    
    # Amount analysis
    features_dict['is_high_amount'] = 1 if total_amount > 500 else 0
    features_dict['is_low_amount'] = 1 if total_amount < 50 else 0
    
    # Comprehensive temporal features
    features_dict['is_weekend'] = 1 if receipt_date.weekday() >= 5 else 0
    features_dict['is_month_end'] = 1 if receipt_date.day >= 25 else 0
    features_dict['is_month_start'] = 1 if receipt_date.day <= 5 else 0
    features_dict['month'] = receipt_date.month
    features_dict['day_of_week'] = receipt_date.weekday()
    features_dict['hour'] = receipt_date.hour
    features_dict['is_late_night'] = 1 if (receipt_date.hour >= 22) or (receipt_date.hour <= 4) else 0
    features_dict['is_business_hours'] = 1 if (receipt_date.hour >= 9) and (receipt_date.hour <= 17) else 0
    features_dict['is_future_date'] = 1 if receipt_date > now else 0
    days_old = (now - receipt_date).days
    features_dict['days_old'] = days_old
    features_dict['is_very_old'] = 1 if days_old > 365 else 0
    features_dict['is_recent'] = 1 if days_old <= 7 else 0
    features_dict['is_holiday_season'] = 1 if receipt_date.month in [11, 12] else 0
    features_dict['is_quarter_end'] = 1 if (receipt_date.month in [3, 6, 9, 12]) and (receipt_date.day >= 25) else 0
    
    # Financial fraud features
    features_dict['tip_percentage'] = features_dict['tip_ratio'] * 100
    features_dict['is_exact_round'] = 1 if (total_amount % 1 == 0) and (total_amount > 0) else 0
    features_dict['is_round_ten'] = 1 if (total_amount % 10 == 0) and (total_amount > 0) else 0
    features_dict['is_round_hundred'] = 1 if (total_amount % 100 == 0) and (total_amount > 0) else 0
    amount_str = str(total_amount)
    features_dict['amount_decimal_places'] = len(amount_str.split('.')[-1]) if '.' in amount_str else 0
    
    # Mathematical consistency checks
    if subtotal > 0 and tax >= 0:
        calculated_total = subtotal + tax + tip
        features_dict['total_mismatch'] = 1 if abs(calculated_total - total_amount) > 0.01 else 0
        features_dict['tax_rate'] = tax / (subtotal + 1e-6)
        features_dict['tax_rate_anomaly'] = 1 if (features_dict['tax_rate'] < 0.05) or (features_dict['tax_rate'] > 0.15) else 0
    else:
        features_dict['calculated_total'] = total_amount
        features_dict['total_mismatch'] = 0
        features_dict['tax_rate'] = 0
        features_dict['tax_rate_anomaly'] = 0
    
    # Excessive tip detection
    features_dict['excessive_tip'] = 1 if features_dict['tip_ratio'] > 0.3 else 0
    features_dict['very_high_tip'] = 1 if features_dict['tip_ratio'] > 0.5 else 0
    features_dict['tip_to_total_ratio'] = tip / (total_amount - tip + 1e-6) if total_amount > tip else 0
    
    # Amount distribution features (simplified - would need historical data for full implementation)
    features_dict['amount_z_score'] = 0  # Would need vendor history
    features_dict['is_amount_outlier'] = 0  # Would need vendor history
    
    # Comprehensive vendor features
    features_dict['vendor_name_length'] = len(vendor)
    features_dict['vendor_has_numbers'] = 1 if any(c.isdigit() for c in vendor) else 0
    features_dict['vendor_has_special_chars'] = 1 if any(not c.isalnum() and not c.isspace() for c in vendor) else 0
    features_dict['vendor_word_count'] = len(vendor.split()) if vendor else 0
    features_dict['vendor_is_all_caps'] = 1 if vendor.isupper() and len(vendor) > 3 else 0
    features_dict['vendor_is_all_lower'] = 1 if vendor.islower() and len(vendor) > 3 else 0
    features_dict['vendor_has_repeating_chars'] = 1 if bool(re.search(r'(.)\1{3,}', vendor)) else 0
    features_dict['vendor_is_generic'] = 1 if vendor.lower() in ['store', 'shop', 'market', 'business', 'vendor', 'company', 'inc', 'llc'] else 0
    features_dict['vendor_has_unicode'] = 1 if bool(re.search(r'[^\x00-\x7F]', vendor)) else 0
    features_dict['vendor_starts_with_number'] = 1 if bool(re.match(r'^\d', vendor)) else 0
    features_dict['vendor_has_excessive_special'] = 1 if len(re.findall(r'[^a-zA-Z0-9\s]', vendor)) > 2 else 0
    features_dict['vendor_frequency'] = 1  # Would need historical data
    features_dict['is_rare_vendor'] = 0  # Would need historical data
    features_dict['is_common_vendor'] = 0  # Would need historical data
    
    # Comprehensive payment features
    features_dict['has_payment_method'] = 1 if payment_method and payment_method.strip() else 0
    features_dict['payment_method_length'] = len(payment_method) if payment_method else 0
    features_dict['payment_is_cash'] = 1 if 'cash' in payment_method.lower() else 0
    features_dict['payment_is_card'] = 1 if bool(re.search(r'card|credit|debit', payment_method.lower())) else 0
    features_dict['payment_is_suspicious'] = 1 if bool(re.search(r'gift|comp|employee|personal|unknown', payment_method.lower())) else 0
    features_dict['payment_has_special_chars'] = 1 if bool(re.search(r'[^a-zA-Z0-9\s]', payment_method)) else 0
    
    # Comprehensive item features
    features_dict['has_items'] = 1 if item_count > 0 else 0
    features_dict['is_high_item_count'] = 1 if item_count > 10 else 0
    features_dict['is_low_item_count'] = 1 if item_count < 3 else 0
    features_dict['is_single_item'] = 1 if item_count == 1 else 0
    features_dict['item_count_to_amount_ratio'] = item_count / (total_amount + 1e-6)
    features_dict['price_per_item'] = total_amount / (item_count + 1e-6) if item_count > 0 else 0
    features_dict['estimated_price_variance'] = 0  # Would need item details
    features_dict['has_unusually_cheap_item'] = 1 if features_dict['avg_item_price'] < 0.10 else 0
    features_dict['has_unusually_expensive_item'] = 1 if features_dict['avg_item_price'] > 1000 else 0
    features_dict['price_range_suspicious'] = 1 if (features_dict['avg_item_price'] > 500) and (item_count == 1) else 0
    
    # Cross-feature fraud patterns
    features_dict['high_amount_low_items'] = 1 if (total_amount > 500) and (item_count <= 2) else 0
    features_dict['low_amount_high_items'] = 1 if (total_amount < 10) and (item_count > 10) else 0
    features_dict['weekend_business'] = 1 if features_dict['is_weekend'] and features_dict['is_business_hours'] else 0
    features_dict['late_night_high_amount'] = 1 if features_dict['is_late_night'] and (total_amount > 200) else 0
    features_dict['month_end_high_amount'] = 1 if features_dict['is_month_end'] and (total_amount > 500) else 0
    features_dict['vendor_date_duplicate'] = 0  # Would need historical data
    features_dict['amount_date_duplicate'] = 0  # Would need historical data
    features_dict['vendor_recent_frequency'] = 1  # Would need historical data
    features_dict['high_velocity_vendor'] = 0  # Would need historical data
    
    # Additional fraud indicators
    features_dict['missing_critical_fields'] = 1 if (not vendor) or (total_amount == 0) or (not date_str) else 0
    features_dict['missing_optional_fields'] = 1 if (not payment_method) and (tip == 0) else 0
    features_dict['has_negative_amounts'] = 1 if (total_amount < 0) or (tip < 0) else 0
    features_dict['has_zero_amount'] = 1 if total_amount == 0 else 0
    features_dict['has_extreme_values'] = 1 if (total_amount > 10000) or (tip > 5000) else 0
    
    # Tip features
    features_dict['has_tip'] = 1 if tip > 0 else 0
    
    # ──────────────────────────────────────────────────────────────────────────────
    #  EXPENSE MANAGEMENT SYSTEM FLAGS (Business Rules)
    # ──────────────────────────────────────────────────────────────────────────────
    
    # Flag 1: OVER_POLICY_LIMIT
    category = receipt_data.get('category', '').lower()
    meal_threshold = 60
    hotel_threshold = 300
    features_dict['over_policy_limit'] = 1 if (
        (('meal' in category or 'food' in category or 'restaurant' in category) and total_amount > meal_threshold) or
        (('hotel' in category or 'lodging' in category) and total_amount > hotel_threshold)
    ) else 0
    
    # Flag 2: MISSING_RECEIPT
    has_receipt = receipt_data.get('has_receipt', True)  # Assume receipt exists if not specified
    features_dict['missing_receipt'] = 1 if (not has_receipt) and (total_amount >= 25) else 0
    
    # Flag 3: DUPLICATE_RECEIPT (would need historical data)
    features_dict['duplicate_receipt'] = 0  # Would need receipt hash comparison
    
    # Flag 4: VENDOR_BLACKLISTED
    suspicious_vendors = ["test", "fake", "sample", "example", "tester"]
    features_dict['vendor_blacklisted'] = 1 if any(sv in vendor.lower() for sv in suspicious_vendors) else 0
    
    # Flag 5: WEEKEND_EXPENSE
    features_dict['weekend_expense'] = features_dict['is_weekend']
    
    # Flag 6: OUT_OF_HOURS
    features_dict['out_of_hours'] = 1 if (receipt_date.hour >= 2) and (receipt_date.hour <= 5) else 0
    
    # Flag 7: FIRST_CLASS_AIRFARE
    ticket_class = receipt_data.get('ticket_class', '').lower()
    features_dict['first_class_airfare'] = 1 if (
        (ticket_class and 'economy' not in ticket_class and 'coach' not in ticket_class) or
        (('airfare' in category or 'flight' in category or 'travel' in category) and total_amount > 1000)
    ) else 0
    
    # Flag 8: LUXURY_HOTEL_RATE
    features_dict['luxury_hotel_rate'] = 1 if (
        (('hotel' in category or 'lodging' in category or 'accommodation' in category) and total_amount > 300) or
        (('hotel' in vendor.lower() or 'inn' in vendor.lower() or 'lodge' in vendor.lower() or 'resort' in vendor.lower()) and total_amount > 300)
    ) else 0
    
    # Flag 9: PERSONAL_MILEAGE_EXCESS (would need mileage data)
    features_dict['personal_mileage_excess'] = 0
    
    # Flag 10: DUPLICATE_AMOUNT_DATE (would need user_id)
    features_dict['duplicate_amount_date'] = features_dict['amount_date_duplicate']
    
    # Flag 11: CURRENCY_MISMATCH (would need currency data)
    features_dict['currency_mismatch'] = 0
    
    # Flag 12: CATEGORY_MISMATCH
    receipt_text = receipt_data.get('receipt_text', '').lower()
    items_text = receipt_data.get('items', '')
    if receipt_text or items_text:
        meal_keywords = ["restaurant", "cafe", "food", "meal", "dining"]
        hotel_keywords = ["hotel", "lodging", "accommodation", "resort"]
        text_content = receipt_text if receipt_text else str(items_text).lower()
        features_dict['category_mismatch'] = 1 if (
            (('meal' in category or 'food' in category) and not any(mk in text_content for mk in meal_keywords)) or
            (('hotel' in category or 'lodging' in category) and not any(hk in text_content for hk in hotel_keywords))
        ) else 0
    else:
        features_dict['category_mismatch'] = 0
    
    # Flag 13: GHOST_VENDOR
    features_dict['ghost_vendor'] = 1 if (
        features_dict['vendor_is_generic'] or
        features_dict['vendor_name_length'] < 3 or
        features_dict['vendor_blacklisted']
    ) else 0
    
    # Flag 14: MANUAL_TOTAL_EDIT
    extracted_total = receipt_data.get('extracted_total', 0)
    if extracted_total > 0:
        features_dict['manual_total_edit'] = 1 if abs(total_amount - extracted_total) / (extracted_total + 1e-6) > 0.10 else 0
    else:
        features_dict['manual_total_edit'] = features_dict['total_mismatch']
    
    # Flag 15: EXCESSIVE_TIP (already computed above)
    # Flag handled by excessive_tip feature
    
    # Flag 16: PERSONAL_ITEM_KEYWORD
    personal_keywords = ["clothing", "gift card", "electronics", "jewelry", "watch", 
                        "video game", "movie", "concert ticket", "spa", "massage"]
    text_content = receipt_text if receipt_text else str(items_text).lower()
    features_dict['personal_item_keyword'] = 1 if any(pk in text_content for pk in personal_keywords) else 0
    
    # Flag 17: GEO_LOCATION_OFF_ROUTE (would need location data)
    features_dict['geo_location_off_route'] = 0
    
    # Flag 18: WEEKLY_MEAL_COUNT (would need weekly tracking)
    features_dict['weekly_meal_count_excess'] = 0
    
    # Flag 19: SAME_VENDOR_MULTIPLE_USERS (would need user_id and receipt hash)
    features_dict['same_vendor_multiple_users'] = 0
    
    # Flag 20: NON_BUSINESS_HOLIDAY
    features_dict['non_business_holiday'] = 1 if (features_dict['is_holiday_season'] and not features_dict['is_business_hours']) else 0
    
    # Flag 21: CARD_DECLINE_RETRY (would need payment transaction history)
    features_dict['card_decline_retry'] = 0
    
    # Flag 22: IMAGE_BLURRY
    image_quality = receipt_data.get('image_quality_score', 1.0)
    features_dict['image_blurry'] = 1 if image_quality < 0.5 else 0
    
    # Create feature array in the correct order
    feature_array = []
    for feature_name in feature_names:
        feature_array.append(features_dict.get(feature_name, 0))
    
    return np.array(feature_array).reshape(1, -1)

def extract_receipt_data_from_items(items):
    """Extract receipt data from the items format"""
    receipt_data = {}
    
    # Map from the receipt items format to what the ML model expects
    for item in items:
        label = item.get('label', '').lower()
        value = item.get('value', '')
        
        if 'vendor' in label:
            receipt_data['vendor'] = value
        elif 'total' in label and 'amount' in label:
            # Clean numeric value
            clean_value = ''.join(c for c in str(value) if c.isdigit() or c == '.')
            receipt_data['total_amount'] = float(clean_value) if clean_value else 0
        elif 'subtotal' in label:
            clean_value = ''.join(c for c in str(value) if c.isdigit() or c == '.')
            receipt_data['subtotal'] = float(clean_value) if clean_value else 0
        elif 'tax' in label and 'rate' not in label:
            clean_value = ''.join(c for c in str(value) if c.isdigit() or c == '.')
            receipt_data['tax'] = float(clean_value) if clean_value else 0
        elif 'date' in label:
            receipt_data['date'] = value
        elif 'tip' in label:
            clean_value = ''.join(c for c in str(value) if c.isdigit() or c == '.')
            receipt_data['tip'] = float(clean_value) if clean_value else 0
        elif 'payment' in label or 'method' in label:
            receipt_data['payment_method'] = value
        elif 'category' in label:
            receipt_data['category'] = value
        elif 'receipt_text' in label or 'text' in label:
            receipt_data['receipt_text'] = value
        elif 'ticket_class' in label or 'class' in label:
            receipt_data['ticket_class'] = value
        elif 'has_receipt' in label:
            receipt_data['has_receipt'] = value.lower() in ['true', 'yes', '1'] if isinstance(value, str) else bool(value)
        elif 'extracted_total' in label:
            clean_value = ''.join(c for c in str(value) if c.isdigit() or c == '.')
            receipt_data['extracted_total'] = float(clean_value) if clean_value else 0
        elif 'image_quality' in label or 'quality_score' in label:
            clean_value = ''.join(c for c in str(value) if c.isdigit() or c == '.')
            receipt_data['image_quality_score'] = float(clean_value) if clean_value else 1.0
    
    # Set defaults for missing values
    receipt_data.setdefault('vendor', '')
    receipt_data.setdefault('total_amount', 0)
    receipt_data.setdefault('subtotal', 0)
    receipt_data.setdefault('tax', 0)
    receipt_data.setdefault('date', '')
    receipt_data.setdefault('tip', 0)
    receipt_data.setdefault('payment_method', '')
    receipt_data.setdefault('category', '')
    receipt_data.setdefault('receipt_text', '')
    receipt_data.setdefault('ticket_class', '')
    receipt_data.setdefault('has_receipt', True)
    receipt_data.setdefault('extracted_total', 0)
    receipt_data.setdefault('image_quality_score', 1.0)
    receipt_data.setdefault('item_count', len(items))
    
    return receipt_data

def main():
    """Main function"""
    try:
        # Read input from stdin
        input_data = sys.stdin.read()
        
        if not input_data.strip():
            print(json.dumps({"error": "No input data provided"}), file=sys.stderr)
            sys.exit(1)
        
        # Parse JSON input
        try:
            data = json.loads(input_data)
            items = data.get('items', [])
        except json.JSONDecodeError as e:
            print(json.dumps({"error": f"Invalid JSON: {str(e)}"}), file=sys.stderr)
            sys.exit(1)
        
        # Load model
        model, scaler, features, metadata = load_model()
        if model is None:
            sys.exit(1)
        
        # Extract receipt data
        receipt_data = extract_receipt_data_from_items(items)
        
        # Create features
        X = create_receipt_features(receipt_data, features)
        
        # Scale features
        X_scaled = scaler.transform(X)
        
        # Make prediction
        prediction = model.predict(X_scaled)[0]
        probability = model.predict_proba(X_scaled)[0][1]  # Probability of fraud
        
        # Determine risk level
        if probability >= 0.8:
            risk_level = "HIGH"
        elif probability >= 0.5:
            risk_level = "MEDIUM"  
        else:
            risk_level = "LOW"
        
        # Return results as JSON
        result = {
            "is_fraudulent": bool(prediction == 1),
            "fraud_probability": float(probability),
            "risk_level": risk_level,
            "confidence": float(max(probability, 1 - probability))
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({"error": f"Prediction failed: {str(e)}"}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main() 