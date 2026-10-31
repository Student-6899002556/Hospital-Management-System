USE hospital_management;

INSERT INTO patients (patient_name,gender,date_of_birth,phone,address) VALUES
('Aarav Sharma','Male','1998-04-12','9876501001','Patiala, Punjab'),
('Meera Singh','Female','1995-09-20','9876501002','Chandigarh'),
('Kabir Verma','Male','2001-01-05','9876501003','Rajpura, Punjab'),
('Ananya Gupta','Female','1989-12-14','9876501004','Mohali, Punjab'),
('Ishaan Kapoor','Male','1978-07-03','9876501005','Patiala, Punjab'),
('Sara Khan','Female','2003-03-21','9876501006','Ambala, Haryana'),
('Dev Malhotra','Male','1992-11-11','9876501007','Zirakpur, Punjab'),
('Priya Das','Female','1985-06-30','9876501008','Patiala, Punjab'),
('Rohan Joshi','Male','1999-08-16','9876501009','Chandigarh'),
('Simran Kaur','Female','1972-02-25','9876501010','Ludhiana, Punjab');

INSERT INTO doctors (doctor_name,specialization,phone,consultation_fee,is_active) VALUES
('Dr. Neha Mehta','Cardiology','9811102001',800,1),
('Dr. Arjun Bedi','Dermatology','9811102002',600,1),
('Dr. Kavita Rao','Pediatrics','9811102003',500,1),
('Dr. Sameer Gill','Orthopedics','9811102004',700,1),
('Dr. Ritu Sethi','General Medicine','9811102005',400,1);

INSERT INTO doctor_availability (doctor_id,available_day,start_time,end_time) VALUES
(1,'Monday','09:00:00','13:00:00'),(1,'Wednesday','09:00:00','13:00:00'),(1,'Friday','09:00:00','13:00:00'),
(2,'Monday','10:00:00','16:00:00'),(2,'Tuesday','10:00:00','16:00:00'),(2,'Thursday','10:00:00','16:00:00'),
(3,'Tuesday','09:00:00','14:00:00'),(3,'Wednesday','09:00:00','14:00:00'),(3,'Friday','09:00:00','14:00:00'),
(4,'Monday','12:00:00','17:00:00'),(4,'Thursday','12:00:00','17:00:00'),(4,'Saturday','09:00:00','13:00:00'),
(5,'Monday','09:00:00','17:00:00'),(5,'Tuesday','09:00:00','17:00:00'),(5,'Wednesday','09:00:00','17:00:00'),
(5,'Thursday','09:00:00','17:00:00'),(5,'Friday','09:00:00','17:00:00');

-- Seed appointments use future dates relative to a fixed sample date; edit dates when testing if they are now in the past.
INSERT INTO appointments (patient_id,doctor_id,appointment_date,appointment_time,duration_minutes,status,reason) VALUES
(1,5,DATE_ADD(CURDATE(),INTERVAL 1 DAY),'09:00:00',30,'Scheduled','General checkup'),
(2,1,DATE_ADD(CURDATE(),INTERVAL 1 DAY),'09:30:00',30,'Scheduled','Chest discomfort'),
(3,3,DATE_ADD(CURDATE(),INTERVAL 2 DAY),'10:00:00',30,'Scheduled','Child health check'),
(4,2,DATE_SUB(CURDATE(),INTERVAL 2 DAY),'11:00:00',30,'Completed','Skin irritation'),
(5,4,DATE_SUB(CURDATE(),INTERVAL 1 DAY),'12:00:00',30,'Completed','Knee pain'),
(6,5,CURDATE(),'10:00:00',30,'Cancelled','Routine checkup'),
(7,5,CURDATE(),'11:00:00',30,'Completed','Fever'),
(8,3,DATE_ADD(CURDATE(),INTERVAL 3 DAY),'09:30:00',30,'Scheduled','Follow-up'),
(9,2,DATE_SUB(CURDATE(),INTERVAL 3 DAY),'13:00:00',30,'Completed','Rash'),
(10,1,DATE_ADD(CURDATE(),INTERVAL 4 DAY),'10:00:00',30,'Scheduled','Blood pressure review');

INSERT INTO prescriptions (appointment_id,medicine_name,dosage,frequency,duration,notes) VALUES
(4,'Cetirizine','10 mg','Once daily','5 days','Use as prescribed.'),
(5,'Paracetamol','500 mg','As needed','3 days','Avoid exceeding prescribed dose.'),
(7,'Paracetamol','500 mg','Twice daily','3 days','Fictional sample record.'),
(9,'Topical cream','Apply thin layer','Twice daily','7 days','Fictional sample record.');

INSERT INTO bills (appointment_id,consultation_charge,additional_charges,total_amount) VALUES
(4,600,100,700),(5,700,0,700),(7,400,50,450),(9,600,0,600);

INSERT INTO payments (bill_id,amount_paid,payment_method) VALUES
(1,700,'UPI'),(2,300,'Cash'),(3,450,'Card');
