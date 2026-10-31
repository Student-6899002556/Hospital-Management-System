# CarePoint Hospital Management System

Intermediate-level academic project using **HTML5, CSS3, vanilla JavaScript, Node.js, Express.js, and MySQL**. It is designed for a local Windows development environment and demonstrates relational database design and MySQL stored programming.

## Features

- Dashboard KPIs and recent appointments loaded from MySQL
- Patient registration, search, update, and visit history
- Doctor directory, fee management, active/inactive status, and working hours
- Appointment booking with working-hour validation, overlapping-time checks, cancellation, and completion
- Prescriptions associated with completed appointments
- Bill generation and partial/full payments
- Outstanding balance and payment status calculations
- Daily appointment, monthly revenue, outstanding-bill, and doctor appointment reports
- MySQL stored procedures, stored functions, triggers, cursor, handlers, transactions, and audit records
- Parameterized database queries, environment-based configuration, and centralized error handling

## Requirements

- Node.js 18 or later
- MySQL 8.0 or compatible MySQL server
- MySQL Workbench (recommended)
- Visual Studio Code (recommended)

## Installation on Windows

1. Create a folder named `hospital-management-system` and copy the project files into it.
2. Open MySQL Workbench and execute these SQL files in order:
   1. `database/01_create_database.sql`
   2. `database/02_create_tables.sql`
   3. `database/05_create_functions.sql`
   4. `database/04_create_procedures.sql`
   5. `database/03_insert_sample_data.sql`
   6. `database/06_create_triggers.sql`
3. Optionally execute `database/07_create_reports.sql` and `database/08_test_cases.sql` to review reports and test functions/procedures.
4. In VS Code, open the project folder and open a terminal.
5. Install dependencies:

   ```powershell
   npm install
   ```

6. Copy `.env.example` to `.env` and update the MySQL user/password:

   ```powershell
   Copy-Item .env.example .env
   ```

   Example `.env`:

   ```env
   PORT=5000
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=hospital_management
   ```

7. Start the application:

   ```powershell
   npm start
   ```

   For development auto-restart:

   ```powershell
   npm run dev
   ```

8. Open `http://localhost:5000`.

## SQL concepts demonstrated

- **Stored procedure:** a named set of SQL statements that can receive parameters and perform a task, such as registering a patient or booking an appointment.
- **Stored function:** returns a value, for example `CalculateBill` or `GetOutstandingBalance`.
- **Trigger:** runs automatically after/before a database event. The project audits appointment status updates and payment inserts.
- **Cursor:** processes a result one row at a time. `DoctorAppointmentReport` loops through a doctor's appointments for a chosen date and returns the rows from a temporary table.
- **Handler:** reacts to a condition. The cursor procedure uses a `NOT FOUND` handler to stop its loop; transaction procedures use exception handlers and `RESIGNAL`.
- **Transaction:** groups database operations. `START TRANSACTION`, `COMMIT`, and `ROLLBACK` are used for appointment, bill, and payment operations.
- **Parameterized query:** sends user data separately from SQL text, reducing SQL injection risk.

## API routes

- `GET /api/health`
- `GET /api/dashboard`
- Patients: `GET/POST /api/patients`, `GET/PUT /api/patients/:id`
- Doctors: `GET/POST /api/doctors`, `GET/PUT /api/doctors/:id`
- Availability: `GET/POST /api/availability`
- Appointments: `GET/POST /api/appointments`, `GET /api/appointments/:id`, `PATCH /api/appointments/:id/cancel`, `PATCH /api/appointments/:id/complete`
- Prescriptions: `GET/POST /api/prescriptions`
- Bills: `GET /api/bills`, `GET /api/bills/:id`, `POST /api/bills`
- Payments: `GET/POST /api/payments`
- Reports: `GET /api/reports/appointments`, `/api/reports/revenue`, `/api/reports/outstanding-bills`, `/api/reports/doctor-appointments`
- Audit: `GET /api/audit`

## Important notes

- This is an academic demonstration, not a production clinical system. Do not enter real patient data.
- Authentication and role-based access control are not implemented in this starter version. Add them before exposing the system to a network.
- Booking requires a matching row in `doctor_availability`; sample availability is provided. Only schedule appointments within a doctor's listed hours.
- MySQL `CHECK` constraint enforcement depends on server version. Use MySQL 8.0.16+ for enforced checks.
- The sample appointments and bills are fictional. Seeded completed appointments are available for testing prescriptions and billing.
- Stored procedure SQL errors are returned as user-facing messages by the API error middleware; stack traces and credentials are not sent to the browser.
- The report page is a simple table-based report view; it can be extended with Chart.js or export-to-CSV features.

## Suggested viva flow

1. Explain primary keys, foreign keys, and one-to-many relationships.
2. Demonstrate patient registration through the GUI and show the row in MySQL.
3. Show the `BookAppointment` procedure and its overlap validation.
4. Attempt to book a conflicting appointment and observe the error.
5. Complete an appointment, add a prescription, and generate a bill.
6. Record a partial payment and show the outstanding balance.
7. Demonstrate the `DoctorAppointmentReport` cursor and the audit trigger.
