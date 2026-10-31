USE hospital_management;
DROP FUNCTION IF EXISTS CalculateBill;
DROP FUNCTION IF EXISTS GetOutstandingBalance;
DROP FUNCTION IF EXISTS GetPaymentStatus;

DELIMITER $$
CREATE FUNCTION CalculateBill(p_consultation DECIMAL(10,2), p_additional DECIMAL(10,2))
RETURNS DECIMAL(10,2)
DETERMINISTIC
NO SQL
BEGIN
  RETURN COALESCE(p_consultation,0) + COALESCE(p_additional,0);
END$$

CREATE FUNCTION GetOutstandingBalance(p_bill_id INT)
RETURNS DECIMAL(10,2)
READS SQL DATA
BEGIN
  DECLARE v_total DECIMAL(10,2) DEFAULT 0;
  DECLARE v_paid DECIMAL(10,2) DEFAULT 0;
  SELECT total_amount INTO v_total FROM bills WHERE bill_id=p_bill_id;
  SELECT COALESCE(SUM(amount_paid),0) INTO v_paid FROM payments WHERE bill_id=p_bill_id;
  RETURN GREATEST(v_total-v_paid,0);
END$$

CREATE FUNCTION GetPaymentStatus(p_bill_id INT)
RETURNS VARCHAR(20)
READS SQL DATA
BEGIN
  DECLARE v_total DECIMAL(10,2) DEFAULT 0;
  DECLARE v_paid DECIMAL(10,2) DEFAULT 0;
  SELECT total_amount INTO v_total FROM bills WHERE bill_id=p_bill_id;
  SELECT COALESCE(SUM(amount_paid),0) INTO v_paid FROM payments WHERE bill_id=p_bill_id;
  IF v_paid=0 THEN RETURN 'Unpaid';
  ELSEIF v_paid<v_total THEN RETURN 'Partially Paid';
  ELSE RETURN 'Paid';
  END IF;
END$$
DELIMITER ;
