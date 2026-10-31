USE hospital_management;

-- Inspect seeded data
SELECT * FROM patients;
SELECT * FROM doctors;
SELECT * FROM doctor_availability;
SELECT * FROM appointments;
SELECT * FROM bills;
SELECT * FROM payments;

-- Test functions
SELECT CalculateBill(500.00,125.00) AS expected_625;
SELECT GetOutstandingBalance(2) AS outstanding_for_bill_2;
SELECT GetPaymentStatus(2) AS status_for_bill_2;

-- Test cursor report using a doctor and a date that has appointments
CALL DoctorAppointmentReport(5,CURDATE());

-- Test stored procedures manually with valid IDs and dates that fit the doctor's availability.
-- Example patient registration:
-- CALL RegisterPatient('Test Patient','Other','2000-01-01','9000000000','Test address');
-- Example doctor insertion:
-- CALL AddDoctor('Dr. Test','General Medicine','9000000001',350.00);
-- Example appointment:
-- CALL BookAppointment(1,5,DATE_ADD(CURDATE(),INTERVAL 7 DAY),'09:00:00',30,'Testing');
-- Test bill after completing a test appointment:
-- CALL CompleteAppointment(<appointment_id>);
-- CALL GenerateBill(<appointment_id>,100.00);
-- CALL RecordPayment(<bill_id>,50.00,'UPI');

-- For conflict tests, call BookAppointment twice with overlapping times on the same
-- doctor and date. The second call should raise a meaningful SQL error.
