const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { PORT } = require('./config');
const { DEMO_VULN } = require('./config');

const authRoutes = require('./routes/auth');
const itemsRoutes = require('./routes/items');
const dashboardRoutes = require('./routes/dashboard');
const settingsRoutes = require('./routes/settings');
const variantsRoutes = require('./routes/variants');
const inventoryRoutes = require('./routes/inventory');
const logsRoutes = require('./routes/logs');
const adminRoutes = require('./routes/admin');
const systemRoutes = require('./routes/system');
const movementsRoutes = require('./routes/movements');



const errorHandler = require('./middleware/errorHandler');

const app = express();

// middleware

app.use(helmet());
app.use(cors());
app.use(express.json());

// health
app.get('/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// routes

app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/variants', variantsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/inventory-movements', movementsRoutes);
app.use('/api/logs', logsRoutes);

// demo vulnerable route
if (DEMO_VULN) {
  const demoRoutes = require('./routes/demo');
  app.use('/api/demo', demoRoutes);
}

// error handling;

// default 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
