# Break & Brews Billiards Café — Admin Dashboard

A premium administrative dashboard for managing real-time billiard table rentals, café point-of-sale catalog orders, active kitchen preparation queues, customer loyalty members, and staff profiles.

---

## How to Run the Project

Follow these steps to run both the backend API server and the frontend interface.

### Prerequisites
1. **PostgreSQL**: Ensure PostgreSQL is running locally. The backend is configured to connect to:
   `postgresql://postgres:password@localhost:5432/break_and_brews`

---

### 1. Running the Backend (Flask API)

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

### 2. Running the Frontends (Admin, Staff, Customer)

There are three distinct portal interfaces depending on the user role. To launch any of them:

1. Navigate to the portal's directory.
2. Start the Vite development server:
   ```bash
   npm run dev
   ```

- **Admin Portal** (Port 5173): **[http://localhost:5173](http://localhost:5173)**
- **Staff Portal** (Port 5174): **[http://localhost:5174](http://localhost:5174)**
- **Customer Portal** (Port 5176): **[http://localhost:5176](http://localhost:5176)**

---

## Seeded Test Accounts

You can log into the Admin and Staff interfaces using the following pre-seeded database accounts:

| Role | Name | Email | Password |
| :--- | :--- | :--- | :--- |
| **Admin** | Admin User | `admin@breakandbrews.com` | `password123` |
| **Admin** | Marcus Aurelius | `marcus@breakandbrews.com` | `password123` |
| **Staff** | Staff User | `staff@breakandbrews.com` | `password123` |
| **Staff** | John Doe | `john@breakandbrews.com` | `password123` |
| **Staff** | Jane Smith | `jane@breakandbrews.com` | `password123` |

---

## Project Structure
- **/backend**: Flask REST controllers (`app.py`), SQLAlchemy database models (`models.py`), and seeder script (`seed.py`).
- **/admin**: Vite + React + TS administration dashboard portal.
- **/staffs**: Vite + React + TS kitchen order queue and inventory requests portal.
- **/customer**: Vite + React + TS mobile-responsive coffee ordering and live tracker portal.
