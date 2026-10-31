USE hospital_management;

-- Daily appointment report
SELECT appointment_date, status, COUNT(*) AS appointment_count
FROM appointments GROUP BY appointment_date, status ORDER BY appointment_date DESC;

-- Doctor-wise appointment counts
SELECT d.doctor_name, COUNT(a.appointment_id) AS appointment_count
FROM doctors d LEFT JOIN appointments a ON a.doctor_id=d.doctor_id
GROUP BY d.doctor_id,d.doctor_name ORDER BY appointment_count DESC;

-- Patient visit history
SELECT p.patient_name,a.appointment_date,a.appointment_time,d.doctor_name,a.status
FROM appointments a JOIN patients p ON p.patient_id=a.patient_id
JOIN doctors d ON d.doctor_id=a.doctor_id ORDER BY p.patient_name,a.appointment_date DESC;

-- Unpaid and partially paid bills
SELECT b.bill_id,p.patient_name,b.total_amount,COALESCE(SUM(py.amount_paid),0) AS paid,
       b.total_amount-COALESCE(SUM(py.amount_paid),0) AS outstanding
FROM bills b JOIN appointments a ON a.appointment_id=b.appointment_id
JOIN patients p ON p.patient_id=a.patient_id LEFT JOIN payments py ON py.bill_id=b.bill_id
GROUP BY b.bill_id,p.patient_name,b.total_amount
HAVING outstanding > 0 ORDER BY outstanding DESC;

-- Monthly payment revenue
SELECT DATE_FORMAT(payment_date,'%Y-%m') AS month,SUM(amount_paid) AS revenue
FROM payments GROUP BY DATE_FORMAT(payment_date,'%Y-%m') ORDER BY month;

-- Doctor-wise consultation revenue
SELECT d.doctor_name,SUM(b.consultation_charge) AS consultation_revenue
FROM bills b JOIN appointments a ON a.appointment_id=b.appointment_id
JOIN doctors d ON d.doctor_id=a.doctor_id GROUP BY d.doctor_id,d.doctor_name
ORDER BY consultation_revenue DESC;
