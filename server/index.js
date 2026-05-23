const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN;

const app = express();
const server = http.createServer(app);

const corsOptions = CLIENT_ORIGIN && isProduction
  ? { origin: CLIENT_ORIGIN.split(',').map(o => o.trim()), credentials: true }
  : {};
app.use(cors(corsOptions));

app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const prisma = require('./lib/prisma');

(async () => {
  try {
    await prisma.$connect();
    console.log('MySQL connected successfully via Prisma');
    if (!isProduction) {
      try {
        const { seedSports } = require('./seed/sports');
        await seedSports();
      } catch (e) {
        console.warn('Seed sports:', e.message);
      }
    }
  } catch (err) {
    console.error('Database connection error:', err);
  }
})();

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/sports', require('./routes/sports'));
app.use('/api/venues', require('./routes/venues'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/batches', require('./routes/batches'));
app.use('/api/trainers', require('./routes/trainers'));
app.use('/api/open-plays', require('./routes/openPlays'));
app.use('/api/tournaments', require('./routes/tournaments'));
app.use('/api/slots', require('./routes/slots'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/trainings', require('./routes/trainings'));

const { processOpenPlayConfirmations } = require('./services/openPlayConfirmations');
const CONFIRMATION_INTERVAL_MS = 10 * 60 * 1000;
setInterval(async () => {
  try {
    const results = await processOpenPlayConfirmations();
    if (results.confirmed.length || results.cancelled.length) {
      console.log('Open play confirmations:', results.confirmed.length, 'confirmed,', results.cancelled.length, 'cancelled');
    }
  } catch (e) {
    console.error('Open play confirmation job error:', e);
  }
}, CONFIRMATION_INTERVAL_MS);

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Sportza API is running', env: isProduction ? 'production' : 'development' });
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ message: 'Not found' });
  }
  next();
});

if (isProduction) {
  const buildPath = path.join(__dirname, '..', 'client', 'build');
  app.use(express.static(buildPath));
  app.get('*', (req, res, next) => {
    res.sendFile(path.join(buildPath, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
}

app.use((err, req, res, next) => {
  console.error(err.stack || err);
  const status = err.status || 500;
  res.status(status).json({
    message: err.message || 'Server error',
    ...(isProduction ? {} : { stack: err.stack })
  });
});

const PORT = process.env.PORT || 5000;

try {
  const { Server } = require('socket.io');
  const socketCors = CLIENT_ORIGIN && isProduction
    ? { origin: CLIENT_ORIGIN.split(',').map(o => o.trim()), methods: ['GET', 'POST'] }
    : { origin: '*', methods: ['GET', 'POST'] };
  const io = new Server(server, { cors: socketCors });
  require('./socket').setIO(io);
} catch (e) {
  console.warn('Socket.io not installed; real-time scoring will work via REST only. Run: npm install socket.io');
}

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

server.listen(PORT, () => {
  console.log(`Sportza server running on port ${PORT} (${isProduction ? 'production' : 'development'})`);
});
