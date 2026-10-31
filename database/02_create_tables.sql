USE hospital_management;

CREATE TABLE IF NOT EXISTS patients (
  patient_id INT AUTO_INCREMENT PRIMARY KEY,
  patient_name VARCHAR(100) NOT NULL,
  gender VARCHAR(20),
  date_of_birth DATE,
  phone VARCHAR(15),
  address VARCHAR(255),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_patient_name (patient_name),
  INDEX idx_patient_phone (phone)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS doctors (
  doctor_id INT AUTO_INCREMENT PRIMARY KEY,
  doctor_name VARCHAR(100) NOT NULL,
  specialization VARCHAR(100),
  phone VARCHAR(15),
  consultation_fee DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_doctor_name (doctor_name),
  INDEX idx_doctor_specialization (specialization)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS doctor_availability (
  availability_id INT AUTO_INCREMENT PRIMARY KEY,
  doctor_id INT NOT NULL,
  available_day VARCHAR(15) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  CONSTRAINT fk_availability_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id),
  CONSTRAINT chk_availability_time CHECK (start_time < end_time),
  INDEX idx_availability_doctor_day (doctor_id, available_day)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS appointments (
  appointment_id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  doctor_id INT NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  status ENUM('Scheduled','Completed','Cancelled') NOT NULL DEFAULT 'Scheduled',
  reason VARCHAR(255),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_appointment_patient FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
  CONSTRAINT fk_appointment_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id),
  CONSTRAINT chk_appointment_duration CHECK (duration_minutes BETWEEN 5 AND 240),
  INDEX idx_appointment_date_doctor (appointment_date, doctor_id),
  INDEX idx_appointment_patient (patient_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS prescriptions (
  prescription_id INT AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT NOT NULL,
  medicine_name VARCHAR(100) NOT NULL,
  dosage VARCHAR(100),
  frequency VARCHAR(100),
  duration VARCHAR(100),
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_prescription_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id),
  INDEX idx_prescription_appointment (appointment_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bills (
  bill_id INT AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT NOT NULL UNIQUE,
  consultation_charge DECIMAL(10,2) NOT NULL,
  additional_charges DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  bill_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bill_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id),
  CONSTRAINT chk_bill_amounts CHECK (consultation_charge >= 0 AND additional_charges >= 0 AND total_amount >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS payments (
  payment_id INT AUTO_INCREMENT PRIMARY KEY,
  bill_id INT NOT NULL,
  amount_paid DECIMAL(10,2) NOT NULL,
  payment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payment_method ENUM('Cash','Card','UPI') NOT NULL,
  CONSTRAINT fk_payment_bill FOREIGN KEY (bill_id) REFERENCES bills(bill_id),
  CONSTRAINT chk_payment_positive CHECK (amount_paid > 0),
  INDEX idx_payment_bill (bill_id),
  INDEX idx_payment_date (payment_date)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_log (
  audit_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  entity_type VARCHAR(40) NOT NULL,
  entity_id BIGINT NOT NULL,
  action_type VARCHAR(40) NOT NULL,
  action_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  description VARCHAR(500),
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_time (action_time)
) ENGINE=InnoDB;
