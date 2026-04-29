import pandas as pd
import numpy as np
import pickle
import os
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split

print("Starting training process...")

np.random.seed(42)

n_samples = 1000
data = {
    'text_length': np.random.randint(100, 5000, n_samples),
    'has_critical_keywords': np.random.randint(0, 2, n_samples),
    'has_fraud_keywords': np.random.randint(0, 2, n_samples),
    'amount_mentioned': np.random.randint(500, 100000, n_samples),
    'has_doctor_name': np.random.randint(0, 2, n_samples),
    'has_patient_name': np.random.randint(0, 2, n_samples),
    'diagnosis_keyword_count': np.random.randint(0, 10, n_samples),
    'has_date': np.random.randint(0, 2, n_samples)
}

df = pd.DataFrame(data)

# FIX: Short text alone should not be fraud unless other suspicious factors exist
fraud_condition = (
    (df['has_fraud_keywords'] == 1) |
    ((df['text_length'] < 300) & (df['amount_mentioned'] > 20000) & (df['has_critical_keywords'] == 0)) |
    ((df['amount_mentioned'] > 80000) & (df['has_critical_keywords'] == 0)) |
    ((df['has_doctor_name'] == 0) & (df['amount_mentioned'] > 50000)) |
    ((df['has_patient_name'] == 0) & (df['amount_mentioned'] > 50000)) |
    ((df['has_date'] == 0) & (df['amount_mentioned'] > 30000)) |
    ((df['diagnosis_keyword_count'] == 0) & (df['amount_mentioned'] > 40000))
)
df['fraud'] = np.where(fraud_condition, 1, 0)
df['fraud'] = np.where(np.random.rand(n_samples) > 0.9, 1 - df['fraud'], df['fraud'])

print(f"Dataset summary:\n{df['fraud'].value_counts()}")

X = df.drop('fraud', axis=1)
y = df['fraud']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)

rf_model = RandomForestClassifier(n_estimators=100, random_state=42)
rf_model.fit(X_train_scaled, y_train)

X_test_scaled = scaler.transform(X_test)
accuracy = rf_model.score(X_test_scaled, y_test)
print(f"Model trained with Test Accuracy: {accuracy*100:.2f}%")

script_dir = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(script_dir, 'model.pkl')
scaler_path = os.path.join(script_dir, 'scaler.pkl')

with open(model_path, 'wb') as f:
    pickle.dump(rf_model, f)

with open(scaler_path, 'wb') as f:
    pickle.dump(scaler, f)

print(f"Model and scaler saved to:\n- {model_path}\n- {scaler_path}")
