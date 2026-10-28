# LifeFlow Blood Bank Management System

A modern blood bank management starter built with React, Node.js, Express, and MySQL.

## Core Features

- Login and registration flow for admins and staff
- Dashboard with donor, customer, stock, and request highlights
- Donor management with blood group, contact, and medical notes
- Blood donation tracking with stock auto-update
- Blood inventory management by blood group and storage location
- Customer and hospital request management
- Staff information management
- Report section with stock health, donation trends, request breakdown, and top donors

## Project Structure

```text
.
|-- backend
|-- database
|-- frontend
`-- README.md
```

## Setup

1. Create the database and seed data:

```sql
SOURCE database/schema.sql;
```

Or from the command line:

```bash
mysql -u root -p < database/schema.sql
```

2. Configure the backend:

```bash
copy backend\\.env.example backend\\.env
```

3. Configure the frontend if needed:

```bash
copy frontend\\.env.example frontend\\.env.local
```

4. Install dependencies:

```bash
cd backend && npm install
cd ../frontend && npm install
```

If PowerShell blocks `npm`, use `npm.cmd install` instead.

5. Start the backend and frontend in two terminals:

```bash
cd backend && npm run dev
cd frontend && npm run dev
```

## Demo Login

- Email: `admin@lifeflow.com`
- Password: `admin123`

## Default Ports

- Backend: `http://localhost:5000`
- Frontend: `http://localhost:5173`

