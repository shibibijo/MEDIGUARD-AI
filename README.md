# MediGuard AI - Medical Insurance Fraud Detection System

MediGuard AI is a full-stack web application designed to automatically process and validate medical insurance claims. It uses Optical Character Recognition (OCR), Natural Language Processing (NLP), and Machine Learning (ML) to extract relevant details from claim documents (PDF/Images) and predict the likelihood of fraud, speeding up the approval process and reducing manual review overhead.

## Features
- **OCR Engine**: Extracts text from medical claims and bills using Tesseract.js.
- **NLP Pipeline**: Extracts key entities like Patient Name, Doctor Name, Date of Treatment, and Diagnosis Keywords using Python NLTK.
- **ML Fraud Detection**: A Random Forest model evaluates extracted features against learned patterns to flag suspicious claims.
- **Role-Based Access Control (RBAC)**: Secure access using JWT authentication for hospitals and insurers.
- **Rate Limiting**: Protects authentication and upload routes from brute force and DoS attacks.

## Prerequisites
Ensure you have the following installed on your system:
- **Node.js** (v18+)
- **Python 3.8+**
- **MongoDB** (Local instance or Atlas URI)
- **Tesseract OCR** (Must be installed on the host system if required by the OS, though tesseract.js uses a WebAssembly port)
- **Ghostscript and GraphicsMagick** (Required by `pdf2pic` for PDF to Image conversion)

## Installation Steps

1. **Clone the repository and install Node dependencies**
   ```bash
   git clone <repository-url>
   cd MEDIGUARD-AI
   npm install
   ```

2. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```
   *(Make sure to use a virtual environment if preferred)*

## Important: Train the ML Model First
Before starting the server, you must train the ML model:
pip install -r requirements.txt
python train.py
This generates model.pkl and scaler.pkl required for fraud detection.

4. **Environment Variables**
   Copy the example environment file and configure your settings:
   ```bash
   cp .env.example .env
   ```
   **`.env` Explanations:**
   - `PORT`: Port on which the Node server runs (default: 5000)
   - `MONGO_URI`: Your MongoDB connection string (default: mongodb://127.0.0.1:27017/mediguard)
   - `JWT_SECRET`: Secret key for signing JWT tokens (use a strong random string)

5. **Start the Application**
   For development (uses nodemon):
   ```bash
   npm run dev
   ```
   For production:
   ```bash
   npm start
   ```

## API Endpoints List

### Authentication
- `POST /api/auth/login`
  - Body: `{ "username": "...", "password": "..." }`
  - Returns JWT token and user info. Rate limited (10 per 15 min).

### Claims Upload
- `POST /api/upload`
  - Headers: `Authorization: Bearer <token>`
  - Body: `multipart/form-data` with `claimDocument` (PDF/JPEG/PNG, max 10MB)
  - Returns extracted NLP entities and fraud probability/decision. Rate limited (20 per hour).
  - *Allowed Roles: `hospital`, `insurer`*

- `GET /api/claims`
  - Headers: `Authorization: Bearer <token>`
  - Returns all submitted claims.
  - *Allowed Roles: `insurer`*

## System Architecture
1. **Frontend**: Vanilla HTML/CSS/JS, fully responsive.
2. **Backend**: Express.js server, handles routing, authentication, and file processing via Multer.
3. **ML Pipeline**: The backend passes document text and extracted metadata to Python scripts (`nlp_extract.py`, `predict.py`) via `stdin` to ensure secure, command-injection-free processing.
4. **Database**: MongoDB via Mongoose, storing user accounts and claim records.