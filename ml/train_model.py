import pandas as pd
import numpy as np
import re
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score, roc_curve
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.feature_selection import SelectKBest, f_classif
import joblib
import matplotlib.pyplot as plt
from imblearn.over_sampling import SMOTE
from imblearn.under_sampling import RandomUnderSampler
from imblearn.pipeline import Pipeline as ImbPipeline

print("Loading and preparing fraud detection dataset...")

# Load dataset
df = pd.read_csv("receipts_dataset.csv")
print(f"Loaded {len(df)} receipts")

# Check what columns are available
print(f"Available columns: {list(df.columns)}")

# ──────────────────────────────────────────────────────────────────────────────
#  Feature Engineering (based on available columns)
# ──────────────────────────────────────────────────────────────────────────────

# Convert date to datetime and extract features
df["date"] = pd.to_datetime(df["date"], errors='coerce')
now = pd.Timestamp.now()

# ──────────────────────────────────────────────────────────────────────────────
#  COMPREHENSIVE TEMPORAL FRAUD FEATURES
# ──────────────────────────────────────────────────────────────────────────────
df["is_weekend"] = df["date"].dt.dayofweek >= 5
df["is_month_end"] = df["date"].dt.day >= 25
df["is_month_start"] = df["date"].dt.day <= 5
df["month"] = df["date"].dt.month
df["day_of_week"] = df["date"].dt.dayofweek
df["hour"] = df["date"].dt.hour
df["is_late_night"] = (df["date"].dt.hour >= 22) | (df["date"].dt.hour <= 4)
df["is_business_hours"] = (df["date"].dt.hour >= 9) & (df["date"].dt.hour <= 17)
df["is_future_date"] = df["date"] > now
df["days_old"] = (now - df["date"]).dt.days
df["is_very_old"] = df["days_old"] > 365
df["is_recent"] = df["days_old"] <= 7
df["is_holiday_season"] = df["month"].isin([11, 12])  # Nov-Dec (holiday season)
df["is_quarter_end"] = df["date"].dt.month.isin([3, 6, 9, 12]) & (df["date"].dt.day >= 25)

# ──────────────────────────────────────────────────────────────────────────────
#  COMPREHENSIVE FINANCIAL FRAUD FEATURES
# ──────────────────────────────────────────────────────────────────────────────
df["tip_ratio"] = df["tip"] / (df["total_amount"] + 1e-6)
df["avg_item_price"] = df["total_amount"] / (df["item_count"] + 1e-6)
df["has_tip"] = df["tip"] > 0
df["tip_percentage"] = df["tip_ratio"] * 100

# Amount pattern analysis
df["amount_log"] = np.log(df["total_amount"] + 1)
df["is_high_amount"] = df["total_amount"] > df["total_amount"].quantile(0.9)
df["is_low_amount"] = df["total_amount"] < df["total_amount"].quantile(0.1)

# Round number detection (suspicious in receipts)
df["is_exact_round"] = (df["total_amount"] % 1 == 0) & (df["total_amount"] > 0)
df["is_round_ten"] = (df["total_amount"] % 10 == 0) & (df["total_amount"] > 0)
df["is_round_hundred"] = (df["total_amount"] % 100 == 0) & (df["total_amount"] > 0)
df["amount_decimal_places"] = df["total_amount"].apply(lambda x: len(str(x).split('.')[-1]) if '.' in str(x) else 0)

# Mathematical consistency checks (if subtotal and tax are available)
if "subtotal" in df.columns and "tax" in df.columns:
    df["calculated_total"] = df["subtotal"] + df["tax"] + df["tip"]
    df["total_mismatch"] = abs(df["calculated_total"] - df["total_amount"]) > 0.01
    df["tax_rate"] = df["tax"] / (df["subtotal"] + 1e-6)
    df["tax_rate_anomaly"] = (df["tax_rate"] < 0.05) | (df["tax_rate"] > 0.15)  # Unusual tax rates
else:
    df["calculated_total"] = df["total_amount"]
    df["total_mismatch"] = False
    df["tax_rate"] = 0
    df["tax_rate_anomaly"] = False

# Excessive tip detection (Flag 15 uses 25% threshold, so we'll use that as standard)
df["excessive_tip"] = df["tip_ratio"] > 0.25  # Tip > 25% is suspicious (per expense policy)
df["very_high_tip"] = df["tip_ratio"] > 0.5  # Tip > 50% is very suspicious
df["tip_to_total_ratio"] = df["tip"] / (df["total_amount"] - df["tip"] + 1e-6)

# Amount distribution features
df["amount_std"] = df.groupby("vendor")["total_amount"].transform("std").fillna(0)
df["amount_mean"] = df.groupby("vendor")["total_amount"].transform("mean").fillna(0)
df["amount_z_score"] = (df["total_amount"] - df["amount_mean"]) / (df["amount_std"] + 1e-6)
df["is_amount_outlier"] = abs(df["amount_z_score"]) > 2

# ──────────────────────────────────────────────────────────────────────────────
#  COMPREHENSIVE VENDOR FRAUD FEATURES
# ──────────────────────────────────────────────────────────────────────────────
df["vendor_name_length"] = df["vendor"].str.len()
df["vendor_has_numbers"] = df["vendor"].str.contains(r'\d', regex=True)
df["vendor_has_special_chars"] = df["vendor"].str.contains(r'[^a-zA-Z0-9\s]', regex=True)
df["vendor_word_count"] = df["vendor"].str.split().str.len()
df["vendor_is_all_caps"] = df["vendor"].str.isupper() & (df["vendor_name_length"] > 3)
df["vendor_is_all_lower"] = df["vendor"].str.islower() & (df["vendor_name_length"] > 3)
df["vendor_has_repeating_chars"] = df["vendor"].apply(lambda x: bool(re.search(r'(.)\1{3,}', str(x))) if pd.notna(x) else False)
df["vendor_is_generic"] = df["vendor"].str.lower().isin(['store', 'shop', 'market', 'business', 'vendor', 'company', 'inc', 'llc'])

# Suspicious vendor patterns
df["vendor_has_unicode"] = df["vendor"].apply(lambda x: bool(re.search(r'[^\x00-\x7F]', str(x))) if pd.notna(x) else False)
df["vendor_starts_with_number"] = df["vendor"].str.match(r'^\d', na=False)
df["vendor_has_excessive_special"] = df["vendor"].str.count(r'[^a-zA-Z0-9\s]') > 2

# Vendor frequency patterns (vendors that appear too often might be fake)
vendor_counts = df["vendor"].value_counts()
df["vendor_frequency"] = df["vendor"].map(vendor_counts)
df["is_rare_vendor"] = df["vendor_frequency"] == 1
df["is_common_vendor"] = df["vendor_frequency"] > df["vendor_frequency"].quantile(0.9)

# ──────────────────────────────────────────────────────────────────────────────
#  COMPREHENSIVE PAYMENT METHOD FRAUD FEATURES
# ──────────────────────────────────────────────────────────────────────────────
df["has_payment_method"] = df["payment_method"].notna() & (df["payment_method"] != "")
df["payment_method_length"] = df["payment_method"].str.len().fillna(0)
df["payment_is_cash"] = df["payment_method"].str.lower().str.contains("cash", na=False)
df["payment_is_card"] = df["payment_method"].str.lower().str.contains("card|credit|debit", na=False, regex=True)
df["payment_is_suspicious"] = df["payment_method"].str.lower().str.contains("gift|comp|employee|personal|unknown", na=False, regex=True)
df["payment_has_special_chars"] = df["payment_method"].str.contains(r'[^a-zA-Z0-9\s]', regex=True, na=False)

# ──────────────────────────────────────────────────────────────────────────────
#  COMPREHENSIVE ITEM-LEVEL FRAUD FEATURES
# ──────────────────────────────────────────────────────────────────────────────
df["has_items"] = df["item_count"] > 0
df["is_high_item_count"] = df["item_count"] > df["item_count"].quantile(0.9)
df["is_low_item_count"] = df["item_count"] < df["item_count"].quantile(0.1)
df["is_single_item"] = df["item_count"] == 1
df["item_count_to_amount_ratio"] = df["item_count"] / (df["total_amount"] + 1e-6)
df["price_per_item"] = df["total_amount"] / (df["item_count"] + 1e-6)

# Price variance features (if item details available, otherwise use estimates)
df["estimated_price_variance"] = df.apply(lambda row: 
    abs(row["avg_item_price"] - row["price_per_item"]) if row["item_count"] > 1 else 0, axis=1)

# Unusual price patterns
df["has_unusually_cheap_item"] = df["avg_item_price"] < 0.10  # Items under 10 cents
df["has_unusually_expensive_item"] = df["avg_item_price"] > 1000  # Items over $1000
df["price_range_suspicious"] = (df["avg_item_price"] > 500) & (df["item_count"] == 1)

# ──────────────────────────────────────────────────────────────────────────────
#  CROSS-FEATURE FRAUD PATTERNS
# ──────────────────────────────────────────────────────────────────────────────
# Inconsistent patterns
df["high_amount_low_items"] = (df["total_amount"] > 500) & (df["item_count"] <= 2)
df["low_amount_high_items"] = (df["total_amount"] < 10) & (df["item_count"] > 10)
df["weekend_business"] = df["is_weekend"] & df["is_business_hours"]
df["late_night_high_amount"] = df["is_late_night"] & (df["total_amount"] > 200)
df["month_end_high_amount"] = df["is_month_end"] & (df["total_amount"] > df["total_amount"].quantile(0.75))

# Duplicate detection patterns
df["vendor_date_duplicate"] = df.duplicated(subset=["vendor", "date"], keep=False)
df["amount_date_duplicate"] = df.duplicated(subset=["total_amount", "date"], keep=False)

# Velocity features (rapid submissions)
df["vendor_recent_frequency"] = df.groupby("vendor")["date"].transform(lambda x: (x >= x.max() - pd.Timedelta(days=7)).sum())
df["high_velocity_vendor"] = df["vendor_recent_frequency"] > 5

# ──────────────────────────────────────────────────────────────────────────────
#  ADDITIONAL FRAUD INDICATORS
# ──────────────────────────────────────────────────────────────────────────────
# Missing data patterns (often indicative of fraud)
df["missing_critical_fields"] = (
    df["vendor"].isna() | 
    df["total_amount"].isna() | 
    df["date"].isna()
).astype(int)

df["missing_optional_fields"] = (
    df["payment_method"].isna() & 
    df["tip"].fillna(0).eq(0)
).astype(int)

# Data quality indicators
df["has_negative_amounts"] = (df["total_amount"] < 0) | (df["tip"] < 0)
df["has_zero_amount"] = df["total_amount"] == 0
df["has_extreme_values"] = (df["total_amount"] > 10000) | (df["tip"] > 5000)

# ──────────────────────────────────────────────────────────────────────────────
#  EXPENSE MANAGEMENT SYSTEM FLAGS (Business Rules)
# ──────────────────────────────────────────────────────────────────────────────

# Flag 1: OVER_POLICY_LIMIT - Amount exceeds per-category cap
# Default thresholds (would be configurable in production)
df["over_policy_limit"] = False  # Would need category + policy limits
if "category" in df.columns and "category_limit" in df.columns:
    df["over_policy_limit"] = df["total_amount"] > df["category_limit"]
elif "category" in df.columns:
    # Default thresholds by category
    meal_threshold = 60  # $60 per meal
    hotel_threshold = 300  # $300 per night
    df["over_policy_limit"] = (
        ((df["category"].str.lower().str.contains("meal|food|restaurant", na=False)) & (df["total_amount"] > meal_threshold)) |
        ((df["category"].str.lower().str.contains("hotel|lodging", na=False)) & (df["total_amount"] > hotel_threshold))
    )

# Flag 2: MISSING_RECEIPT - No receipt for expense >= $25
df["missing_receipt"] = False  # Would need receipt attachment status
if "has_receipt" in df.columns:
    df["missing_receipt"] = (~df["has_receipt"]) & (df["total_amount"] >= 25)
else:
    # Infer from missing critical fields
    df["missing_receipt"] = df["missing_critical_fields"] & (df["total_amount"] >= 25)

# Flag 3: DUPLICATE_RECEIPT - Same receipt hash already used
df["duplicate_receipt"] = False  # Would need receipt hash
if "receipt_hash" in df.columns:
    df["duplicate_receipt"] = df.duplicated(subset=["receipt_hash"], keep=False)
else:
    # Use vendor + amount + date as proxy
    df["duplicate_receipt"] = df.duplicated(subset=["vendor", "total_amount", "date"], keep=False)

# Flag 4: VENDOR_BLACKLISTED - Vendor on fraud list
df["vendor_blacklisted"] = False  # Would need blacklist database
# Check for suspicious vendor patterns instead
suspicious_vendors = ["test", "fake", "sample", "example", "tester"]
df["vendor_blacklisted"] = df["vendor"].str.lower().str.contains("|".join(suspicious_vendors), na=False, regex=True)

# Flag 5: WEEKEND_EXPENSE - Expense on weekend without trip justification
df["weekend_expense"] = df["is_weekend"]
# Would need trip_id or justification field to fully implement

# Flag 6: OUT_OF_HOURS - Expense between 2 AM-5 AM
df["out_of_hours"] = (df["hour"] >= 2) & (df["hour"] <= 5)

# Flag 7: FIRST_CLASS_AIRFARE - Ticket class != economy/coach
df["first_class_airfare"] = False  # Would need ticket class field
if "ticket_class" in df.columns:
    df["first_class_airfare"] = ~df["ticket_class"].str.lower().str.contains("economy|coach", na=False)
elif "category" in df.columns:
    # Check if travel expense with suspiciously high amount
    df["first_class_airfare"] = (
        df["category"].str.lower().str.contains("airfare|flight|travel", na=False) &
        (df["total_amount"] > 1000)  # High threshold for airfare
    )

# Flag 8: LUXURY_HOTEL_RATE - Hotel rate > $300/night
df["luxury_hotel_rate"] = False
if "category" in df.columns:
    df["luxury_hotel_rate"] = (
        df["category"].str.lower().str.contains("hotel|lodging|accommodation", na=False) &
        (df["total_amount"] > 300)
    )
else:
    # Check if high amount on lodging-related vendor
    df["luxury_hotel_rate"] = (
        df["vendor"].str.lower().str.contains("hotel|inn|lodge|resort", na=False) &
        (df["total_amount"] > 300)
    )

# Flag 9: PERSONAL_MILEAGE_EXCESS - Mileage > mapped distance by >10%
df["personal_mileage_excess"] = False  # Would need mileage and mapped distance fields

# Flag 10: DUPLICATE_AMOUNT_DATE - Same amount + date from same user
df["duplicate_amount_date"] = False  # Would need user_id
if "user_id" in df.columns:
    df["duplicate_amount_date"] = df.duplicated(subset=["user_id", "total_amount", "date"], keep=False)
else:
    # Use existing duplicate detection
    df["duplicate_amount_date"] = df["amount_date_duplicate"]

# Flag 11: CURRENCY_MISMATCH - Receipt currency differs from trip country
df["currency_mismatch"] = False  # Would need currency and trip country fields

# Flag 12: CATEGORY_MISMATCH - Receipt text suggests different category
df["category_mismatch"] = False  # Would need receipt text analysis
if "category" in df.columns and "receipt_text" in df.columns:
    # Simple keyword matching (would use NLP in production)
    meal_keywords = ["restaurant", "cafe", "food", "meal", "dining"]
    hotel_keywords = ["hotel", "lodging", "accommodation", "resort"]
    travel_keywords = ["airline", "flight", "taxi", "uber", "car rental"]
    
    df["category_mismatch"] = (
        (df["category"].str.lower().str.contains("meal|food", na=False) & 
         ~df["receipt_text"].str.lower().str.contains("|".join(meal_keywords), na=False)) |
        (df["category"].str.lower().str.contains("hotel|lodging", na=False) & 
         ~df["receipt_text"].str.lower().str.contains("|".join(hotel_keywords), na=False))
    )

# Flag 13: GHOST_VENDOR - Vendor address not found in public database
df["ghost_vendor"] = False  # Would need address validation
# Use suspicious vendor patterns as proxy
df["ghost_vendor"] = (
    df["vendor_is_generic"] |
    (df["vendor_name_length"] < 3) |
    df["vendor_blacklisted"]
)

# Flag 14: MANUAL_TOTAL_EDIT - User overrode auto-extracted total by >10%
df["manual_total_edit"] = False  # Would need original extracted total
if "extracted_total" in df.columns:
    df["manual_total_edit"] = abs(df["total_amount"] - df["extracted_total"]) / (df["extracted_total"] + 1e-6) > 0.10
else:
    # Use total mismatch as proxy
    df["manual_total_edit"] = df["total_mismatch"]

# Flag 15: EXCESSIVE_TIP - Tip > 25% of pre-tax total
# Already defined above with 25% threshold, so this is just for documentation

# Flag 16: PERSONAL_ITEM_KEYWORD - Receipt includes personal item keywords
df["personal_item_keyword"] = False
if "receipt_text" in df.columns:
    personal_keywords = ["clothing", "gift card", "electronics", "jewelry", "watch", 
                        "video game", "movie", "concert ticket", "spa", "massage"]
    df["personal_item_keyword"] = df["receipt_text"].str.lower().str.contains("|".join(personal_keywords), na=False, regex=True)
elif "items" in df.columns:
    # Check item descriptions
    personal_keywords = ["clothing", "gift card", "electronics", "jewelry", "watch"]
    df["personal_item_keyword"] = df["items"].astype(str).str.lower().str.contains("|".join(personal_keywords), na=False, regex=True)

# Flag 17: GEO_LOCATION_OFF_ROUTE - Vendor city not on trip itinerary
df["geo_location_off_route"] = False  # Would need location and trip itinerary

# Flag 18: WEEKLY_MEAL_COUNT - User exceeds allowed per-diem meals in a week
df["weekly_meal_count_excess"] = False  # Would need weekly meal count tracking

# Flag 19: SAME_VENDOR_MULTIPLE_USERS - Same receipt hash by different users
df["same_vendor_multiple_users"] = False  # Would need user_id and receipt hash
if "user_id" in df.columns and "receipt_hash" in df.columns:
    df["same_vendor_multiple_users"] = df.groupby("receipt_hash")["user_id"].transform("nunique") > 1

# Flag 20: NON_BUSINESS_HOLIDAY - Expense on national holiday with no trip
df["non_business_holiday"] = False  # Would need holiday calendar and trip schedule
# Use holiday season as proxy
df["non_business_holiday"] = df["is_holiday_season"] & ~df["is_business_hours"]

# Flag 21: CARD_DECLINE_RETRY - Multiple card declines followed by approval
df["card_decline_retry"] = False  # Would need payment transaction history

# Flag 22: IMAGE_BLURRY - Receipt image marked as low quality
df["image_blurry"] = False  # Would need image quality score
if "image_quality_score" in df.columns:
    df["image_blurry"] = df["image_quality_score"] < 0.5  # Threshold
else:
    # Use poor_quality visual fraud indicator as proxy
    df["image_blurry"] = False  # Would be set from visual analysis

# ──────────────────────────────────────────────────────────────────────────────
#  Feature Selection (based on available columns)
# ──────────────────────────────────────────────────────────────────────────────

# Select features for the model based on what's available
available_feature_columns = [
    # Core receipt data
    'total_amount', 'tip', 'item_count', 'tip_ratio', 'avg_item_price',
    'amount_log', 'is_high_amount', 'is_low_amount',
    
    # Comprehensive temporal features
    'is_weekend', 'is_month_end', 'is_month_start', 'month', 'day_of_week', 'hour',
    'is_late_night', 'is_business_hours', 'is_future_date', 'days_old',
    'is_very_old', 'is_recent', 'is_holiday_season', 'is_quarter_end',
    
    # Financial fraud features
    'tip_percentage', 'is_exact_round', 'is_round_ten', 'is_round_hundred',
    'amount_decimal_places', 'total_mismatch', 'tax_rate', 'tax_rate_anomaly',
    'excessive_tip', 'very_high_tip', 'tip_to_total_ratio',
    'amount_z_score', 'is_amount_outlier',
    
    # Comprehensive vendor features
    'vendor_name_length', 'vendor_has_numbers', 'vendor_has_special_chars', 'vendor_word_count',
    'vendor_is_all_caps', 'vendor_is_all_lower', 'vendor_has_repeating_chars',
    'vendor_is_generic', 'vendor_has_unicode', 'vendor_starts_with_number',
    'vendor_has_excessive_special', 'vendor_frequency', 'is_rare_vendor', 'is_common_vendor',
    
    # Comprehensive payment features
    'has_payment_method', 'payment_method_length', 'payment_is_cash', 'payment_is_card',
    'payment_is_suspicious', 'payment_has_special_chars',
    
    # Comprehensive item features
    'has_items', 'is_high_item_count', 'is_low_item_count', 'is_single_item',
    'item_count_to_amount_ratio', 'price_per_item', 'estimated_price_variance',
    'has_unusually_cheap_item', 'has_unusually_expensive_item', 'price_range_suspicious',
    
    # Cross-feature fraud patterns
    'high_amount_low_items', 'low_amount_high_items', 'weekend_business',
    'late_night_high_amount', 'month_end_high_amount',
    'vendor_date_duplicate', 'amount_date_duplicate',
    'vendor_recent_frequency', 'high_velocity_vendor',
    
    # Additional fraud indicators
    'missing_critical_fields', 'missing_optional_fields',
    'has_negative_amounts', 'has_zero_amount', 'has_extreme_values',
    
    # Tip features
    'has_tip',
    
    # Expense Management System Flags (Business Rules)
    'over_policy_limit', 'missing_receipt', 'duplicate_receipt', 'vendor_blacklisted',
    'weekend_expense', 'out_of_hours', 'first_class_airfare', 'luxury_hotel_rate',
    'personal_mileage_excess', 'duplicate_amount_date', 'currency_mismatch',
    'category_mismatch', 'ghost_vendor', 'manual_total_edit',
    'personal_item_keyword', 'geo_location_off_route', 'weekly_meal_count_excess',
    'same_vendor_multiple_users', 'non_business_holiday', 'card_decline_retry',
    'image_blurry'
]

# Remove any columns that don't exist
available_features = [col for col in available_feature_columns if col in df.columns]
print(f"Using {len(available_features)} features for training: {available_features}")

# Prepare features and target
X = df[available_features].fillna(0)
y = df["is_fraud"]

print(f"Feature matrix shape: {X.shape}")
print(f"Target distribution: {y.value_counts().to_dict()}")

# ──────────────────────────────────────────────────────────────────────────────
#  Handle Class Imbalance
# ──────────────────────────────────────────────────────────────────────────────

print("Handling class imbalance...")

# Use SMOTE to balance the dataset
smote = SMOTE(random_state=42, k_neighbors=3)
smote_result = smote.fit_resample(X, y)
X_balanced, y_balanced = smote_result[0], smote_result[1]

print(f"After balancing: {y_balanced.value_counts().to_dict()}")

# ──────────────────────────────────────────────────────────────────────────────
#  Feature Scaling
# ──────────────────────────────────────────────────────────────────────────────

scaler = StandardScaler()
X_scaled = scaler.fit_transform(X_balanced)

# ──────────────────────────────────────────────────────────────────────────────
#  Model Training
# ──────────────────────────────────────────────────────────────────────────────

print("Training fraud detection model...")

# Split the data
X_train, X_test, y_train, y_test = train_test_split(
    X_scaled, y_balanced, test_size=0.2, random_state=42, stratify=y_balanced
)

# Train multiple models
models = {
    'Random Forest': RandomForestClassifier(
        n_estimators=200, 
        max_depth=10, 
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42,
        class_weight='balanced'
    ),
    'Gradient Boosting': GradientBoostingClassifier(
        n_estimators=100,
        learning_rate=0.1,
        max_depth=6,
        random_state=42
    )
}

best_model = None
best_score = 0
results = {}

for name, model in models.items():
    print(f"Training {name}...")
    
    # Train the model
    model.fit(X_train, y_train)
    
    # Predictions
    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)[:, 1]
    
    # Metrics
    accuracy = model.score(X_test, y_test)
    auc_score = roc_auc_score(y_test, y_pred_proba)
    
    results[name] = {
        'model': model,
        'accuracy': accuracy,
        'auc': auc_score,
        'predictions': y_pred,
        'probabilities': y_pred_proba
    }
    
    print(f"DONE {name} - Accuracy: {accuracy:.4f}, AUC: {auc_score:.4f}")
    
    if auc_score > best_score:
        best_score = auc_score
        best_model = model

# ──────────────────────────────────────────────────────────────────────────────
#  Model Evaluation
# ──────────────────────────────────────────────────────────────────────────────

print("\n Model Evaluation Results:")
print("=" * 50)

for name, result in results.items():
    print(f"\n {name}:")
    print(f"   Accuracy: {result['accuracy']:.4f}")
    print(f"   AUC Score: {result['auc']:.4f}")
    print("\n   Classification Report:")
    print(classification_report(y_test, result['predictions']))

# ──────────────────────────────────────────────────────────────────────────────
#  Feature Importance Analysis
# ──────────────────────────────────────────────────────────────────────────────

if best_model is not None and hasattr(best_model, 'feature_importances_'):
    print("\n Feature Importance Analysis:")
    print("=" * 50)
    
    feature_importance = pd.DataFrame({
        'feature': available_features,
        'importance': best_model.feature_importances_
    }).sort_values('importance', ascending=False)
    
    print("\nTop 10 Most Important Features:")
    print(feature_importance.head(10).to_string(index=False))
    
    # Plot feature importance
    plt.figure(figsize=(10, 6))
    top_features = feature_importance.head(10)
    plt.barh(range(len(top_features)), top_features['importance'])
    plt.yticks(range(len(top_features)), top_features['feature'].tolist())
    plt.xlabel('Feature Importance')
    plt.title('Top 10 Most Important Features for Fraud Detection')
    plt.gca().invert_yaxis()
    plt.tight_layout()
    plt.savefig('feature_importance.png', dpi=300, bbox_inches='tight')
    plt.close()

# ──────────────────────────────────────────────────────────────────────────────
#  Save Models and Artifacts
# ──────────────────────────────────────────────────────────────────────────────

print("\n Saving models and artifacts...")

# Save the best model
if best_model is not None:
    joblib.dump(best_model, "fraud_detection_model.pkl")
    
    # Save the scaler
    joblib.dump(scaler, "fraud_detection_scaler.pkl")
    
    # Save feature names
    joblib.dump(available_features, "fraud_detection_features.pkl")
    
    # Save model metadata
    model_metadata = {
        'model_type': type(best_model).__name__,
        'features_used': available_features,
        'training_samples': len(X_balanced),
        'test_samples': len(X_test),
        'best_auc_score': best_score,
        'dataset_columns': list(df.columns),
        'note': 'Model trained on basic features. Run extract_dataset.ts first for enhanced fraud detection.'
    }
    
    joblib.dump(model_metadata, "fraud_detection_metadata.pkl")
    
    print("Models saved successfully!")
    print(f"Best model: {type(best_model).__name__} with AUC: {best_score:.4f}")
    
    # ──────────────────────────────────────────────────────────────────────────────
    #  Create Prediction Function
    # ──────────────────────────────────────────────────────────────────────────────
    
    print("\n Creating prediction function...")
    
    def predict_fraud_probability(receipt_data):
        """
        Predict fraud probability for a single receipt.
        
        Args:
            receipt_data (dict): Dictionary containing receipt features
            
        Returns:
            dict: Prediction results with probability and risk level
        """
        if best_model is None:
            return {
                'fraud_probability': 0.5,
                'risk_level': "UNKNOWN",
                'is_fraudulent': False,
                'error': 'Model not available'
            }
        
        # Ensure all required features are present
        features = {}
        for feature in available_features:
            features[feature] = receipt_data.get(feature, 0)
        
        # Convert to array and scale
        X_input = np.array([list(features.values())]).reshape(1, -1)
        X_scaled_input = scaler.transform(X_input)
        
        # Predict
        probability = best_model.predict_proba(X_scaled_input)[0][1]
        
        # Determine risk level
        if probability >= 0.8:
            risk_level = "HIGH"
        elif probability >= 0.5:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"
        
        return {
            'fraud_probability': probability,
            'risk_level': risk_level,
            'is_fraudulent': probability >= 0.5
        }
    
    # Save the prediction function
    joblib.dump(predict_fraud_probability, "fraud_prediction_function.pkl")
    
    print("Prediction function created and saved!")
    
    print("\n Fraud detection model training completed!")
    print("Saved files:")
    print("   - fraud_detection_model.pkl (trained model)")
    print("   - fraud_detection_scaler.pkl (feature scaler)")
    print("   - fraud_detection_features.pkl (feature names)")
    print("   - fraud_detection_metadata.pkl (model metadata)")
    print("   - fraud_prediction_function.pkl (prediction function)")
    print("   - feature_importance.png (feature importance plot)")
    
    print("\n Next Steps:")
    print("   1. Run 'npm run extract-dataset' to generate enhanced dataset with fraud flags")
    print("   2. Re-run this script to train a more sophisticated model")
else:
    print("No model was successfully trained!")
