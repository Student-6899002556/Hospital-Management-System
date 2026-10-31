const express = require('express');
const router = express.Router();
const db = require('./config/db');
const asyncHandler = require('./middleware/asyncHandler');

const run = async (sql, params = []) => {
  const [rows] = await db.execute(sql, params);
  return rows;
};
const badRequest = (message) => Object.assign(new Error(message), { status: 400 });
const notFound = (message) => Object.assign(new Error(message), { status: 404 });
const patientInput = (body) => {
  const patientName = typeof body.patient_name === 'string' ? body.patient_name.trim() : '';
  const gender = typeof body.gender === 'string' ? body.gender.trim() : '';
  const dateOfBirth = typeof body.date_of_birth === 'string' ? body.date_of_birth.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const address = typeof body.address === 'string' ? body.address.trim() : '';

  if (!patientName) throw badRequest('Patient name is required.');
  if (patientName.length > 100) throw badRequest('Patient name must be 100 characters or fewer.');
  if (gender && !['Female', 'Male', 'Other'].includes(gender)) throw badRequest('Select a valid gender.');
  if (dateOfBirth) {
    const parsedDate = new Date(`${dateOfBirth}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || Number.isNaN(parsedDate.valueOf()) || parsedDate.toISOString().slice(0, 10) !== dateOfBirth) {
      throw badRequest('Enter a valid date of birth.');
    }
    if (dateOfBirth > new Date().toISOString().slice(0, 10)) throw badRequest('Date of birth cannot be in the future.');
  }
  if (phone.length > 15 || (phone && !/^[0-9+()\s-]+$/.test(phone))) throw badRequest('Enter a valid phone number (maximum 15 characters).');
  if (address.length > 255) throw badRequest('Address must be 255 characters or fewer.');

  return [patientName, gender || null, dateOfBirth || null, phone || null, address || null];
};

router.get('/health', (_req, res) => res.json({ success: true, message: 'API is running' }));

router.get('/dashboard', asyncHandler(async (_req, res) => {
  const [patients] = await run('SELECT COUNT(*) AS total FROM patients');
  const [doctors] = await run('SELECT COUNT(*) AS total FROM doctors WHERE is_active = 1');
  const [today] = await run("SELECT COUNT(*) AS total FROM appointments WHERE appointment_date = CURDATE()");
  const [completed] = await run("SELECT COUNT(*) AS total FROM appointments WHERE status = 'Completed'");
  const [scheduled] = await run("SELECT COUNT(*) AS total FROM appointments WHERE status = 'Scheduled'");
  const [outstanding] = await run(`SELECT COALESCE(SUM(b.total_amount - COALESCE(p.paid,0)),0) AS total
    FROM bills b LEFT JOIN (SELECT bill_id, SUM(amount_paid) paid FROM payments GROUP BY bill_id) p ON p.bill_id=b.bill_id`);
  const [revenue] = await run('SELECT COALESCE(SUM(amount_paid),0) AS total FROM payments');
  const recent = await run(`SELECT a.appointment_id, a.appointment_date, a.appointment_time, a.status,
    p.patient_name, d.doctor_name FROM appointments a
    JOIN patients p ON p.patient_id=a.patient_id JOIN doctors d ON d.doctor_id=a.doctor_id
    ORDER BY a.appointment_date DESC, a.appointment_time DESC LIMIT 8`);
  const monthly = await run(`SELECT DATE_FORMAT(payment_date,'%b %Y') month, SUM(amount_paid) revenue
    FROM payments WHERE payment_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
    GROUP BY YEAR(payment_date), MONTH(payment_date), DATE_FORMAT(payment_date,'%b %Y')
    ORDER BY YEAR(MIN(payment_date)), MONTH(MIN(payment_date))`);
  res.json({ success: true, stats: {
    patients: patients.total, doctors: doctors.total, todayAppointments: today.total,
    completed: completed.total, scheduled: scheduled.total,
    outstanding: Number(outstanding.total), payments: Number(revenue.total)
  }, recent, monthly });
}));

// Patients
router.get('/patients', asyncHandler(async (req, res) => {
  const q = `%${String(req.query.q || '').trim()}%`;
  const rows = await run(`SELECT * FROM patients WHERE patient_name LIKE ? OR phone LIKE ? OR CAST(patient_id AS CHAR) LIKE ?
    ORDER BY patient_id DESC`, [q, q, q]);
  res.json({ success: true, data: rows });
}));
router.get('/patients/:id', asyncHandler(async (req, res) => {
  const rows = await run('SELECT * FROM patients WHERE patient_id=?', [req.params.id]);
  if (!rows.length) throw notFound('Patient not found.');
  const appointments = await run(`SELECT a.*, d.doctor_name FROM appointments a JOIN doctors d ON d.doctor_id=a.doctor_id
    WHERE a.patient_id=? ORDER BY a.appointment_date DESC`, [req.params.id]);
  res.json({ success: true, data: { ...rows[0], appointments } });
}));
router.post('/patients', asyncHandler(async (req, res) => {
  const result = await run('CALL RegisterPatient(?,?,?,?,?)', patientInput(req.body));
  res.status(201).json({ success: true, message: 'Patient registered successfully.', result });
}));
router.put('/patients/:id', asyncHandler(async (req, res) => {
  const [patientName, gender, dateOfBirth, phone, address] = patientInput(req.body);
  const result = await run(`UPDATE patients SET patient_name=?, gender=?, date_of_birth=?, phone=?, address=? WHERE patient_id=?`,
    [patientName, gender, dateOfBirth, phone, address, req.params.id]);
  if (!result.affectedRows) throw notFound('Patient not found.');
  res.json({ success: true, message: 'Patient updated.' });
}));

// Doctors
router.get('/doctors', asyncHandler(async (req, res) => {
  const q = `%${String(req.query.q || '').trim()}%`;
  const rows = await run(`SELECT * FROM doctors WHERE doctor_name LIKE ? OR specialization LIKE ? ORDER BY is_active DESC, doctor_name`, [q, q]);
  res.json({ success: true, data: rows });
}));
router.get('/doctors/:id', asyncHandler(async (req, res) => {
  const rows = await run('SELECT * FROM doctors WHERE doctor_id=?', [req.params.id]);
  if (!rows.length) throw notFound('Doctor not found.');
  const availability = await run('SELECT * FROM doctor_availability WHERE doctor_id=? ORDER BY FIELD(available_day, "Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday")', [req.params.id]);
  res.json({ success: true, data: { ...rows[0], availability } });
}));
router.post('/doctors', asyncHandler(async (req, res) => {
  const { doctor_name, specialization, phone, consultation_fee } = req.body;
  if (!String(doctor_name || '').trim() || consultation_fee === undefined || Number(consultation_fee) < 0) throw badRequest('Doctor name and a valid consultation fee are required.');
  const result = await run('CALL AddDoctor(?,?,?,?)', [doctor_name.trim(), specialization || null, phone || null, Number(consultation_fee)]);
  res.status(201).json({ success: true, message: 'Doctor added successfully.', result });
}));
router.put('/doctors/:id', asyncHandler(async (req, res) => {
  const { doctor_name, specialization, phone, consultation_fee, is_active } = req.body;
  if (!String(doctor_name || '').trim() || Number(consultation_fee) < 0) throw badRequest('Provide a doctor name and valid fee.');
  const result = await run('UPDATE doctors SET doctor_name=?, specialization=?, phone=?, consultation_fee=?, is_active=? WHERE doctor_id=?',
    [doctor_name.trim(), specialization || null, phone || null, Number(consultation_fee), is_active ? 1 : 0, req.params.id]);
  if (!result.affectedRows) throw notFound('Doctor not found.');
  res.json({ success: true, message: 'Doctor updated.' });
}));
router.get('/availability', asyncHandler(async (_req, res) => res.json({ success: true, data: await run(`SELECT da.*, d.doctor_name FROM doctor_availability da JOIN doctors d ON d.doctor_id=da.doctor_id ORDER BY d.doctor_name, da.available_day`) })));
router.post('/availability', asyncHandler(async (req, res) => {
  const { doctor_id, available_day, start_time, end_time } = req.body;
  if (!doctor_id || !available_day || !start_time || !end_time || start_time >= end_time) throw badRequest('Provide a doctor, day, and valid working hours.');
  await run('INSERT INTO doctor_availability (doctor_id,available_day,start_time,end_time) VALUES (?,?,?,?)', [doctor_id, available_day, start_time, end_time]);
  res.status(201).json({ success: true, message: 'Availability saved.' });
}));

// Appointments
router.get('/appointments', asyncHandler(async (req, res) => {
  const params = [];
  let where = ' WHERE 1=1 ';
  if (req.query.date) { where += ' AND a.appointment_date=?'; params.push(req.query.date); }
  if (req.query.status) { where += ' AND a.status=?'; params.push(req.query.status); }
  if (req.query.doctor_id) { where += ' AND a.doctor_id=?'; params.push(req.query.doctor_id); }
  if (req.query.patient_id) { where += ' AND a.patient_id=?'; params.push(req.query.patient_id); }
  const rows = await run(`SELECT a.*, p.patient_name, d.doctor_name, d.specialization FROM appointments a
    JOIN patients p ON p.patient_id=a.patient_id JOIN doctors d ON d.doctor_id=a.doctor_id
    ${where} ORDER BY a.appointment_date DESC,a.appointment_time DESC`, params);
  res.json({ success: true, data: rows });
}));
router.get('/appointments/:id', asyncHandler(async (req, res) => {
  const rows = await run(`SELECT a.*, p.patient_name, d.doctor_name FROM appointments a
    JOIN patients p ON p.patient_id=a.patient_id JOIN doctors d ON d.doctor_id=a.doctor_id WHERE a.appointment_id=?`, [req.params.id]);
  if (!rows.length) throw notFound('Appointment not found.');
  res.json({ success: true, data: rows[0] });
}));
router.post('/appointments', asyncHandler(async (req, res) => {
  const { patient_id, doctor_id, appointment_date, appointment_time, duration_minutes, reason } = req.body;
  if (!patient_id || !doctor_id || !appointment_date || !appointment_time) throw badRequest('Patient, doctor, date, and time are required.');
  const result = await run('CALL BookAppointment(?,?,?,?,?,?)', [
    Number(patient_id), Number(doctor_id), appointment_date, appointment_time, Number(duration_minutes || 30), reason || null
  ]);
  res.status(201).json({ success: true, message: 'Appointment booked successfully.', result });
}));
router.patch('/appointments/:id/cancel', asyncHandler(async (req, res) => {
  const result = await run('CALL CancelAppointment(?)', [req.params.id]);
  res.json({ success: true, message: 'Appointment cancelled.', result });
}));
router.patch('/appointments/:id/complete', asyncHandler(async (req, res) => {
  const result = await run('CALL CompleteAppointment(?)', [req.params.id]);
  res.json({ success: true, message: 'Appointment marked completed.', result });
}));

// Prescriptions: one row per medicine item
router.get('/prescriptions', asyncHandler(async (req, res) => {
  const q = `%${String(req.query.q || '').trim()}%`;
  const rows = await run(`SELECT pr.*, a.patient_id, p.patient_name, a.doctor_id, d.doctor_name, a.appointment_date
    FROM prescriptions pr JOIN appointments a ON a.appointment_id=pr.appointment_id
    JOIN patients p ON p.patient_id=a.patient_id JOIN doctors d ON d.doctor_id=a.doctor_id
    WHERE p.patient_name LIKE ? OR d.doctor_name LIKE ? OR pr.medicine_name LIKE ?
    ORDER BY pr.created_at DESC`, [q, q, q]);
  res.json({ success: true, data: rows });
}));
router.post('/prescriptions', asyncHandler(async (req, res) => {
  const { appointment_id, medicine_name, dosage, frequency, duration, notes } = req.body;
  if (!appointment_id || !String(medicine_name || '').trim()) throw badRequest('Appointment and medicine name are required.');
  const appt = await run("SELECT appointment_id FROM appointments WHERE appointment_id=? AND status='Completed'", [appointment_id]);
  if (!appt.length) throw badRequest('Prescriptions can only be added to completed appointments.');
  const result = await run('INSERT INTO prescriptions (appointment_id,medicine_name,dosage,frequency,duration,notes) VALUES (?,?,?,?,?,?)',
    [appointment_id, medicine_name.trim(), dosage || null, frequency || null, duration || null, notes || null]);
  res.status(201).json({ success: true, message: 'Prescription saved.', id: result.insertId });
}));

// Billing and payments
router.get('/bills', asyncHandler(async (_req, res) => {
  const rows = await run(`SELECT b.*, a.appointment_date, p.patient_name, d.doctor_name,
    COALESCE(x.paid,0) amount_paid, b.total_amount-COALESCE(x.paid,0) outstanding,
    CASE WHEN COALESCE(x.paid,0)=0 THEN 'Unpaid' WHEN COALESCE(x.paid,0)<b.total_amount THEN 'Partially Paid' ELSE 'Paid' END payment_status
    FROM bills b JOIN appointments a ON a.appointment_id=b.appointment_id
    JOIN patients p ON p.patient_id=a.patient_id JOIN doctors d ON d.doctor_id=a.doctor_id
    LEFT JOIN (SELECT bill_id,SUM(amount_paid) paid FROM payments GROUP BY bill_id) x ON x.bill_id=b.bill_id
    ORDER BY b.bill_date DESC`);
  res.json({ success: true, data: rows });
}));
router.get('/bills/:id', asyncHandler(async (req, res) => {
  const rows = await run(`SELECT b.*, a.appointment_date, p.patient_name, d.doctor_name,
    COALESCE(x.paid,0) amount_paid, b.total_amount-COALESCE(x.paid,0) outstanding
    FROM bills b JOIN appointments a ON a.appointment_id=b.appointment_id
    JOIN patients p ON p.patient_id=a.patient_id JOIN doctors d ON d.doctor_id=a.doctor_id
    LEFT JOIN (SELECT bill_id,SUM(amount_paid) paid FROM payments GROUP BY bill_id) x ON x.bill_id=b.bill_id WHERE b.bill_id=?`, [req.params.id]);
  if (!rows.length) throw notFound('Bill not found.');
  const payments = await run('SELECT * FROM payments WHERE bill_id=? ORDER BY payment_date DESC', [req.params.id]);
  res.json({ success: true, data: { ...rows[0], payments } });
}));
router.post('/bills', asyncHandler(async (req, res) => {
  const { appointment_id, additional_charges = 0 } = req.body;
  if (!appointment_id || Number(additional_charges) < 0) throw badRequest('Appointment and non-negative additional charges are required.');
  const result = await run('CALL GenerateBill(?,?)', [Number(appointment_id), Number(additional_charges)]);
  res.status(201).json({ success: true, message: 'Bill generated.', result });
}));
router.get('/payments', asyncHandler(async (_req, res) => {
  const rows = await run(`SELECT py.*, b.total_amount, p.patient_name FROM payments py
    JOIN bills b ON b.bill_id=py.bill_id JOIN appointments a ON a.appointment_id=b.appointment_id
    JOIN patients p ON p.patient_id=a.patient_id ORDER BY py.payment_date DESC`);
  res.json({ success: true, data: rows });
}));
router.post('/payments', asyncHandler(async (req, res) => {
  const { bill_id, amount_paid, payment_method } = req.body;
  if (!bill_id || !Number.isFinite(Number(amount_paid)) || Number(amount_paid) <= 0 || !['Cash','Card','UPI'].includes(payment_method)) {
    throw badRequest('Provide a bill, positive payment amount, and Cash, Card, or UPI method.');
  }
  const result = await run('CALL RecordPayment(?,?,?)', [Number(bill_id), Number(amount_paid), payment_method]);
  res.status(201).json({ success: true, message: 'Payment recorded.', result });
}));

// Reports
router.get('/reports/appointments', asyncHandler(async (req, res) => {
  const from = req.query.from || '2000-01-01';
  const to = req.query.to || '2099-12-31';
  const rows = await run(`SELECT a.appointment_date,a.status,COUNT(*) total FROM appointments a
    WHERE a.appointment_date BETWEEN ? AND ? GROUP BY a.appointment_date,a.status ORDER BY a.appointment_date DESC`, [from, to]);
  res.json({ success: true, data: rows });
}));
router.get('/reports/revenue', asyncHandler(async (req, res) => {
  const from = req.query.from || '2000-01-01';
  const to = req.query.to || '2099-12-31';
  const rows = await run(`SELECT DATE_FORMAT(payment_date,'%Y-%m') month,SUM(amount_paid) revenue
    FROM payments WHERE payment_date BETWEEN ? AND ? GROUP BY DATE_FORMAT(payment_date,'%Y-%m') ORDER BY month`, [from, to]);
  res.json({ success: true, data: rows });
}));
router.get('/reports/outstanding-bills', asyncHandler(async (_req, res) => {
  const rows = await run(`SELECT b.bill_id,p.patient_name,b.total_amount,COALESCE(x.paid,0) paid,
    b.total_amount-COALESCE(x.paid,0) outstanding FROM bills b
    JOIN appointments a ON a.appointment_id=b.appointment_id JOIN patients p ON p.patient_id=a.patient_id
    LEFT JOIN (SELECT bill_id,SUM(amount_paid) paid FROM payments GROUP BY bill_id) x ON x.bill_id=b.bill_id
    WHERE b.total_amount>COALESCE(x.paid,0) ORDER BY outstanding DESC`);
  res.json({ success: true, data: rows });
}));
router.get('/reports/doctor-appointments', asyncHandler(async (req, res) => {
  const doctorId = req.query.doctor_id;
  if (!doctorId) throw badRequest('doctor_id query parameter is required.');
  const date = req.query.date || new Date().toISOString().slice(0,10);
  const [rows] = await db.query('CALL DoctorAppointmentReport(?,?)', [Number(doctorId), date]);
  res.json({ success: true, data: rows[0] || [] });
}));

// Audit history
router.get('/audit', asyncHandler(async (_req, res) => res.json({ success: true, data: await run('SELECT * FROM audit_log ORDER BY action_time DESC LIMIT 100') })));

module.exports = router;
