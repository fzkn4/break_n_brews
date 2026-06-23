# Break & Brews Billiards Café — Admin Dashboard

A premium administrative dashboard for managing real-time billiard table rentals, café point-of-sale catalog orders, active kitchen preparation queues, customer loyalty members, and staff profiles.

---

## 🚀 How to Run the Project

Follow these steps to run both the backend API server and the frontend interface.

### 📋 Prerequisites
1. **PostgreSQL**: Ensure PostgreSQL is running locally. The backend is configured to connect to:
   `postgresql://postgres:password@localhost:5432/break_and_brews`

---

### 🐍 1. Running the Backend (Flask API)

The backend runs a REST API on port `5000` to serve table status updates, process cafe orders, and generate billing summaries.

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Activate the pre-configured virtual environment:
   ```bash
   source .venv/bin/activate
   ```
3. *(Optional)* Seed the database with sample tables, cafe menu items, and mock customer accounts:
   ```bash
   python seed.py
   ```
4. Start the Flask server:
   ```bash
   flask run --port=5000
   ```
   *The API will be available at `http://localhost:5000/api`*

---

### ⚛️ 2. Running the Frontend (Vite + React)

The frontend dev server hosts the user interface and communicates with the Flask API at regular intervals to keep stats, play timers, and order cards synchronized.

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. *(Optional)* Install node packages if updating dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to:
   👉 **[http://localhost:5173](http://localhost:5173)**

---

## 🛠️ Project Structure
- **/backend**: Database models (`models.py`), database seeder (`seed.py`), and REST controllers (`app.py`).
- **/frontend**: React dashboard SPA. Main dashboard and module pages are located under `/src/components/`. Types are defined in `/src/types.ts`.
