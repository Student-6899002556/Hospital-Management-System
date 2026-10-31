USE hospital_management;
DROP PROCEDURE IF EXISTS RegisterPatient;
DROP PROCEDURE IF EXISTS AddDoctor;
DROP PROCEDURE IF EXISTS BookAppointment;
DROP PROCEDURE IF EXISTS CancelAppointment;
DROP PROCEDURE IF EXISTS CompleteAppointment;
DROP PROCEDURE IF EXISTS GenerateBill;
DROP PROCEDURE IF EXISTS RecordPayment;
DROP PROCEDURE IF EXISTS DoctorAppointmentReport;

DELIMITER $$

CREATE PROCEDURE RegisterPatient(
  IN p_name VARCHAR(100), IN p_gender VARCHAR(20), IN p_dob DATE,
  IN p_phone VARCHAR(15), IN p_address VARCHAR(255)
)
BEGIN
  IF p_name IS NULL OR TRIM(p_name) = '' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Patient name is required';
  END IF;
  INSERT INTO patients(patient_name,gender,date_of_birth,phone,address)
  VALUES(TRIM(p_name),p_gender,p_dob,p_phone,p_address);
  SELECT LAST_INSERT_ID() AS patient_id;
END$$

CREATE PROCEDURE AddDoctor(
  IN p_name VARCHAR(100), IN p_specialization VARCHAR(100),
  IN p_phone VARCHAR(15), IN p_fee DECIMAL(10,2)
)
BEGIN
  IF p_name IS NULL OR TRIM(p_name)='' OR p_fee < 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Doctor name and non-negative fee are required';
  END IF;
  INSERT INTO doctors(doctor_name,specialization,phone,consultation_fee)
  VALUES(TRIM(p_name),p_specialization,p_phone,p_fee);
  SELECT LAST_INSERT_ID() AS doctor_id;
END$$

CREATE PROCEDURE BookAppointment(
  IN p_patient_id INT, IN p_doctor_id INT, IN p_date DATE,
  IN p_time TIME, IN p_duration INT, IN p_reason VARCHAR(255)
)
BEGIN
  DECLARE v_patient INT DEFAULT 0;
  DECLARE v_doctor INT DEFAULT 0;
  DECLARE v_availability INT DEFAULT 0;
  DECLARE v_conflicts INT DEFAULT 0;
  DECLARE v_start DATETIME;
  DECLARE v_end DATETIME;
  DECLARE v_lock INT DEFAULT 0;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  IF p_duration IS NULL OR p_duration < 5 OR p_duration > 240 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Duration must be between 5 and 240 minutes';
  END IF;
  IF TIMESTAMP(p_date,p_time) < NOW() THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Appointments cannot be booked in the past';
  END IF;

  START TRANSACTION;
  -- Lock the doctor row to serialize bookings for this doctor.
  SELECT COUNT(*) INTO v_doctor FROM doctors WHERE doctor_id=p_doctor_id AND is_active=1 FOR UPDATE;
  IF v_doctor=0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Doctor does not exist or is inactive'; END IF;
  SELECT COUNT(*) INTO v_patient FROM patients WHERE patient_id=p_patient_id;
  IF v_patient=0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Patient does not exist'; END IF;

  SELECT COUNT(*) INTO v_availability FROM doctor_availability
  WHERE doctor_id=p_doctor_id
    AND available_day=DAYNAME(p_date)
    AND p_time >= start_time
    AND ADDTIME(p_time, SEC_TO_TIME(p_duration*60)) <= end_time;
  IF v_availability=0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Appointment is outside doctor working hours'; END IF;

  SET v_start=TIMESTAMP(p_date,p_time);
  SET v_end=DATE_ADD(v_start, INTERVAL p_duration MINUTE);
  SELECT COUNT(*) INTO v_conflicts FROM appointments
  WHERE doctor_id=p_doctor_id AND appointment_date=p_date AND status <> 'Cancelled'
    AND v_start < DATE_ADD(TIMESTAMP(appointment_date,appointment_time), INTERVAL duration_minutes MINUTE)
    AND v_end > TIMESTAMP(appointment_date,appointment_time);
  IF v_conflicts>0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Appointment time overlaps another appointment'; END IF;

  INSERT INTO appointments(patient_id,doctor_id,appointment_date,appointment_time,duration_minutes,reason)
  VALUES(p_patient_id,p_doctor_id,p_date,p_time,p_duration,p_reason);
  COMMIT;
  SELECT LAST_INSERT_ID() AS appointment_id;
END$$

CREATE PROCEDURE CancelAppointment(IN p_id INT)
BEGIN
  DECLARE v_status VARCHAR(20);
  SELECT status INTO v_status FROM appointments WHERE appointment_id=p_id FOR UPDATE;
  IF v_status IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Appointment not found'; END IF;
  IF v_status='Completed' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Completed appointments cannot be cancelled'; END IF;
  UPDATE appointments SET status='Cancelled' WHERE appointment_id=p_id;
  SELECT p_id AS appointment_id, 'Cancelled' AS status;
END$$

CREATE PROCEDURE CompleteAppointment(IN p_id INT)
BEGIN
  DECLARE v_status VARCHAR(20);
  SELECT status INTO v_status FROM appointments WHERE appointment_id=p_id FOR UPDATE;
  IF v_status IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Appointment not found'; END IF;
  IF v_status='Cancelled' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cancelled appointments cannot be completed'; END IF;
  UPDATE appointments SET status='Completed' WHERE appointment_id=p_id;
  SELECT p_id AS appointment_id, 'Completed' AS status;
END$$

CREATE PROCEDURE GenerateBill(IN p_appointment_id INT, IN p_additional DECIMAL(10,2))
BEGIN
  DECLARE v_fee DECIMAL(10,2);
  DECLARE v_status VARCHAR(20);
  DECLARE v_bill_id INT;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN ROLLBACK; RESIGNAL; END;
  IF p_additional IS NULL OR p_additional < 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Additional charges cannot be negative';
  END IF;
  START TRANSACTION;
  SELECT a.status,d.consultation_fee INTO v_status,v_fee
  FROM appointments a JOIN doctors d ON d.doctor_id=a.doctor_id
  WHERE a.appointment_id=p_appointment_id FOR UPDATE;
  IF v_status IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Appointment not found'; END IF;
  IF v_status <> 'Completed' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only completed appointments can be billed'; END IF;
  IF EXISTS(SELECT 1 FROM bills WHERE appointment_id=p_appointment_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A bill already exists for this appointment';
  END IF;
  INSERT INTO bills(appointment_id,consultation_charge,additional_charges,total_amount)
  VALUES(p_appointment_id,v_fee,p_additional,CalculateBill(v_fee,p_additional));
  SET v_bill_id=LAST_INSERT_ID();
  COMMIT;
  SELECT v_bill_id AS bill_id, CalculateBill(v_fee,p_additional) AS total_amount;
END$$

CREATE PROCEDURE RecordPayment(IN p_bill_id INT, IN p_amount DECIMAL(10,2), IN p_method VARCHAR(30))
BEGIN
  DECLARE v_total DECIMAL(10,2);
  DECLARE v_paid DECIMAL(10,2);
  DECLARE v_balance DECIMAL(10,2);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN ROLLBACK; RESIGNAL; END;
  IF p_amount IS NULL OR p_amount <= 0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payment must be greater than zero'; END IF;
  IF p_method NOT IN ('Cash','Card','UPI') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Unsupported payment method'; END IF;
  START TRANSACTION;
  SELECT total_amount INTO v_total FROM bills WHERE bill_id=p_bill_id FOR UPDATE;
  IF v_total IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bill not found'; END IF;
  SELECT COALESCE(SUM(amount_paid),0) INTO v_paid FROM payments WHERE bill_id=p_bill_id;
  SET v_balance=v_total-v_paid;
  IF p_amount > v_balance THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payment exceeds outstanding balance'; END IF;
  INSERT INTO payments(bill_id,amount_paid,payment_method) VALUES(p_bill_id,p_amount,p_method);
  SET v_balance=v_balance-p_amount;
  COMMIT;
  SELECT p_bill_id AS bill_id, v_balance AS outstanding_balance,
    CASE WHEN v_balance=0 THEN 'Paid' WHEN v_balance<v_total THEN 'Partially Paid' ELSE 'Unpaid' END AS payment_status;
END$$

CREATE PROCEDURE DoctorAppointmentReport(IN p_doctor_id INT, IN p_date DATE)
BEGIN
  DECLARE finished INT DEFAULT 0;
  DECLARE v_patient VARCHAR(100);
  DECLARE v_time TIME;
  DECLARE v_status VARCHAR(20);
  DECLARE cur CURSOR FOR
    SELECT p.patient_name,a.appointment_time,a.status
    FROM appointments a JOIN patients p ON p.patient_id=a.patient_id
    WHERE a.doctor_id=p_doctor_id AND a.appointment_date=p_date
    ORDER BY a.appointment_time;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET finished=1;
  DROP TEMPORARY TABLE IF EXISTS tmp_doctor_appointment_report;
  CREATE TEMPORARY TABLE tmp_doctor_appointment_report(
    patient_name VARCHAR(100), appointment_time TIME, status VARCHAR(20)
  );
  OPEN cur;
  report_loop: LOOP
    FETCH cur INTO v_patient,v_time,v_status;
    IF finished=1 THEN LEAVE report_loop; END IF;
    INSERT INTO tmp_doctor_appointment_report VALUES(v_patient,v_time,v_status);
  END LOOP;
  CLOSE cur;
  SELECT * FROM tmp_doctor_appointment_report ORDER BY appointment_time;
END$$
DELIMITER ;
