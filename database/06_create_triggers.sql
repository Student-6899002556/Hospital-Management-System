USE hospital_management;
DROP TRIGGER IF EXISTS trg_appointment_audit_update;
DROP TRIGGER IF EXISTS trg_payment_audit_insert;
DROP TRIGGER IF EXISTS trg_appointment_validate_insert;

DELIMITER $$
CREATE TRIGGER trg_appointment_validate_insert
BEFORE INSERT ON appointments
FOR EACH ROW
BEGIN
  IF NEW.duration_minutes < 5 OR NEW.duration_minutes > 240 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Appointment duration must be between 5 and 240 minutes';
  END IF;
  IF NEW.appointment_date < CURDATE() THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Appointment date cannot be in the past';
  END IF;
END$$

CREATE TRIGGER trg_appointment_audit_update
AFTER UPDATE ON appointments
FOR EACH ROW
BEGIN
  IF OLD.status <> NEW.status THEN
    INSERT INTO audit_log(entity_type,entity_id,action_type,description)
    VALUES('Appointment',NEW.appointment_id,'STATUS_CHANGED',
      CONCAT('Status changed from ',OLD.status,' to ',NEW.status));
  END IF;
END$$

CREATE TRIGGER trg_payment_audit_insert
AFTER INSERT ON payments
FOR EACH ROW
BEGIN
  INSERT INTO audit_log(entity_type,entity_id,action_type,description)
  VALUES('Payment',NEW.payment_id,'PAYMENT_RECORDED',
    CONCAT('Payment of ',NEW.amount_paid,' recorded for bill ',NEW.bill_id,' using ',NEW.payment_method));
END$$
DELIMITER ;
