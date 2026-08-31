# Timelines Costume Designers — Admin Panel

A full-stack Admin Panel for managing customers, employees, garment design orders, salaries, and a 2D canvas-based design tool. Built with React + Vite + Tailwind CSS (frontend) and Node.js + Express + MongoDB (backend).

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v18+ 
- **MongoDB** running locally on port 27017 (or update `MONGODB_URI` in `.env`)

---

### 1. Backend Setup

```bash
cd backend

# Install dependencies (already done)
npm install

# Copy env and configure
copy .env.example .env
# Edit .env if needed (default MONGODB_URI = mongodb://localhost:27017/timelines_costume)

# Seed the database (creates sample data + admin user)
npm run seed

# Start dev server
npm run dev
# → Running on http://localhost:5000
```

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies (already done)
npm install

# Start dev server
npm run dev
# → Running on http://localhost:5173
```

---

## 🔐 Default Login Credentials

| Role  | Email                    | Password   |
|-------|--------------------------|------------|
| Admin | admin@timelines.in       | admin123   |
| Staff | ravi@timelines.in        | staff123   |

---

## 📁 Project Structure

```
Timelines/
├── backend/
│   ├── src/
│   │   ├── models/          # Mongoose schemas
│   │   ├── routes/          # Express route handlers
│   │   ├── middleware/      # Auth (JWT), error handler
│   │   ├── utils/           # Audit logger utility
│   │   └── seed.js          # Database seeder
│   ├── uploads/             # Sketch image uploads (auto-created)
│   ├── server.js            # Express entry point
│   └── .env                 # Environment variables
│
└── frontend/
    ├── src/
    │   ├── api/             # Axios API modules
    │   ├── components/      # Layout, UI components
    │   ├── context/         # AuthContext
    │   ├── pages/           # All page components
    │   │   ├── Auth/        # Login
    │   │   ├── Dashboard/
    │   │   ├── Customers/
    │   │   ├── Employees/
    │   │   ├── DesignOrders/
    │   │   ├── DesignCanvas/  ← Fabric.js drawing tool
    │   │   ├── Salary/
    │   │   ├── Print/         ← PII-free printout
    │   │   ├── AuditLog/
    │   │   └── GarmentTemplates/
    │   ├── App.jsx
    │   └── main.jsx
    └── tailwind.config.js
```

---

## 🧩 Modules

| Module | Description |
|---|---|
| **Customers** | CRUD with auto-generated ID (TC-YYYY-XXXX), search, pagination, audit history |
| **Employees** | CRUD with role filter, status toggle, audit history |
| **Design Orders** | Full order management with dynamic measurement forms per garment type, tailor assignment, status workflow |
| **Design Canvas** | Fabric.js 2D canvas with garment SVG silhouettes, pen/shapes/text tools, save PNG to order |
| **Salary** | Monthly salary tracking, advances/deductions/bonus, mark-paid, payment history |
| **Print** | PII-free design sheet: Customer ID only, measurements, sketch, fabric/special notes |
| **Audit Log** | Every create/update/delete logged with field-level diff, filterable globally |
| **Garment Templates** | Admin-configurable measurement fields per garment type |

---

## ⚙️ Environment Variables (backend/.env)

| Variable | Default | Description |
|---|---|---|
| `PORT` | 5000 | Server port |
| `MONGODB_URI` | mongodb://localhost:27017/timelines_costume | MongoDB connection |
| `JWT_SECRET` | *(change this!)* | JWT signing secret |
| `JWT_EXPIRES_IN` | 7d | Token expiry |
| `NODE_ENV` | development | Environment |

---

## 🔑 Role-Based Access

| Feature | Admin | Staff |
|---|---|---|
| View all orders | ✅ | ❌ (own assigned only) |
| Create/Edit/Delete records | ✅ | ❌ |
| Salary module | ✅ | ❌ |
| Audit Log | ✅ | ❌ |
| Garment Templates | ✅ | ❌ |
| View Design Canvas | ✅ | ✅ |
| Update order status | ✅ | ✅ |

---

## 🖨️ Print Sheet

Navigate to **Print** → select an order → click **Print**.  
The printout contains:
- Customer **ID** only (no name, phone, address)
- Order ID, garment type, delivery date
- All measurements in a grid
- Design sketch image (if saved from canvas)
- Fabric notes & special instructions
- Assigned tailor name

---

## 📡 API Endpoints (base: `/api`)

| Method | Path | Description |
|---|---|---|
| POST | /auth/login | Login |
| GET | /auth/me | Current user |
| GET/POST | /customers | List / Create |
| GET/PUT/DELETE | /customers/:id | Get / Update / Delete |
| GET | /customers/:id/audit | Audit history |
| GET/POST | /employees | List / Create |
| GET | /employees/tailors | Active tailors only |
| GET/POST | /garment-templates | List / Create |
| GET | /garment-templates/type/:name | By garment type |
| GET/POST | /design-orders | List / Create |
| PATCH | /design-orders/:id/assign | Assign tailor |
| PATCH | /design-orders/:id/status | Update status |
| POST | /design-orders/:id/sketch | Upload PNG sketch |
| PATCH | /design-orders/:id/sketch-json | Save JSON |
| GET/POST | /salary | List / Create |
| PATCH | /salary/:id/mark-paid | Mark as paid |
| GET | /audit-logs | Global audit log |
