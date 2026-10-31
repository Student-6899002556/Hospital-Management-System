require('dotenv').config();
const express = require('express');
const path = require('path');
const apiRoutes = require('./routes');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', apiRoutes);

app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use((err, req, res, next) => {
  console.error(err.message);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: status === 500 ? 'An unexpected server error occurred.' : err.message
  });
});

const port = Number(process.env.PORT) || 5000;
app.listen(port, () => console.log(`Hospital Management System running at http://localhost:${port}`));
