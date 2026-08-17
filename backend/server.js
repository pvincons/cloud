require('dotenv').config();
const express = require('express');
const cors = require('cors');

const cdeRoutes = require('./routes/cde');
const sopRoutes = require('./routes/sop');
const reportRoutes = require('./routes/report');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Dang ky cac cong API
app.use('/api/cde', cdeRoutes);
app.use('/api/sop', sopRoutes);
app.use('/api/report', reportRoutes);

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', system: 'PV INCONS CDE AI Service Online' });
});

app.listen(PORT, () => {
    console.log(`[PV INCONS] Backend Server đang chạy tại http://localhost:${PORT}`);
});