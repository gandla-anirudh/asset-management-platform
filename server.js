const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
const morgan = require('morgan');
app.use(morgan('dev')); // Now every incoming request shows up in your Render logs automatically

// ================= MIDDLEWARE LAYERS =================
app.use(express.json());
app.use(cors());

// ================= DATABASE CONNECTION =================
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://admin:Mypassword123@cluster0.xxxmaws.mongodb.net/?appName=Cluster0/asset_management';
mongoose.connect(MONGO_URI)
  .then(() => console.log('📁 MongoDB data tier successfully connected...'))
  .catch((err) => {
    console.log('⚠️ Local MongoDB Service not detected. Check connection string!');
  });

// ================= SCHEMAS =================
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['Consumer', 'Admin'], default: 'Consumer' }
});
const User = mongoose.model('User', userSchema);

const assetSchema = new mongoose.Schema({
  name: { type: String, required: true },
  // Inside your assetSchema definition, add this chunk:
  healthStatus: { 
    type: String, 
    enum: ['Perfect', 'Good', 'Needs Repair', 'Damaged'],
    default: 'Perfect' 
  },
  category: { type: String, required: true },
  description: { type: String, required: true },
  quantityAvailable: { type: Number, required: true, min: 0 },
  status: { type: String, default: 'Available' }
});
const Asset = mongoose.model('Asset', assetSchema);

// 🆕 UPDATED: Booking Schema now tracks requested quantity
const bookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
  quantity: { type: Number, required: true, min: 1 }, 
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected', 'Returned'], default: 'Pending' }
});
const Booking = mongoose.model('Booking', bookingSchema);

const auditLogSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  username: { type: String, required: true },
  role: { type: String, required: true },
  action: { type: String, required: true },
  entity: { type: String, required: true },
  details: { type: String, required: true }
});
const AuditLog = mongoose.model('AuditLog', auditLogSchema);

// ================= AUTHENTICATION =================
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role, adminSecret } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: "Email already registered" });

    if (role === 'Admin' && adminSecret !== '12345') {
      return res.status(403).json({ error: "Invalid Admin Code!" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({ name, email, password: hashedPassword, role: role || 'Consumer' });
    await newUser.save();

    const logEntry = new AuditLog({
      username: name, role: role || 'Consumer', action: 'USER REGISTERED',
      entity: `User #${newUser._id.toString().substring(0,8)}`, details: JSON.stringify({ email })
    });
    await logEntry.save();

    res.status(201).json({ message: "User created safely!" });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "Invalid account match" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Password mismatch" });

    const logEntry = new AuditLog({
      username: user.name, role: user.role, action: 'USER LOGGED IN',
      entity: `User #${user._id.toString().substring(0,8)}`, details: JSON.stringify({ email })
    });
    await logEntry.save();

    res.status(200).json({ user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ================= ASSETS =================
app.get('/api/assets', async (req, res) => {
  try { res.status(200).json(await Asset.find()); } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/assets', async (req, res) => {
  try {
    const newAsset = new Asset(req.body);
    await newAsset.save();
    res.status(201).json(newAsset);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/assets/:id', async (req, res) => {
  try {
    const updatedAsset = await Asset.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.status(200).json(updatedAsset);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/assets/:id', async (req, res) => {
  try {
    await Asset.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Asset purged" });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ================= BOOKINGS =================
app.post('/api/bookings', async (req, res) => {
  try {
    // 🆕 UPDATED: Now receives "quantity" from frontend
    const { userId, assetId, quantity, startDate, endDate } = req.body;

    const asset = await Asset.findById(assetId);
    // 🆕 UPDATED: Checks if there is enough stock for the specific amount requested
    if (!asset || asset.quantityAvailable < quantity) {
      return res.status(400).json({ error: `Request denied: Only ${asset ? asset.quantityAvailable : 0} units available.` });
    }

    const newBooking = new Booking({ user: userId, asset: assetId, quantity, startDate, endDate });
    await newBooking.save();

    const userDoc = await User.findById(userId);
    const logEntry = new AuditLog({
      username: userDoc ? userDoc.name : 'Unknown User', role: userDoc ? userDoc.role : 'Consumer', action: 'ASSET BOOKED',
      entity: `Asset #${assetId.toString().substring(0,8)}`, details: JSON.stringify({ quantity, startDate })
    });
    await logEntry.save();

    res.status(201).json(newBooking);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find().populate('user', 'name').populate('asset', 'name');
    res.status(200).json(bookings);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/bookings/history/:userId', async (req, res) => {
  try {
    const userHistory = await Booking.find({ user: req.params.userId }).populate('asset', 'name');
    res.status(200).json(userHistory);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/bookings/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    const asset = await Asset.findById(booking.asset);

    // 🆕 UPDATED: Subtracts the specific booking.quantity from storage
    if (status === 'Approved' && booking.status !== 'Approved') {
      if (asset.quantityAvailable < booking.quantity) return res.status(400).json({ error: "Not enough stock remaining" });
      asset.quantityAvailable -= booking.quantity;
      if (asset.quantityAvailable === 0) asset.status = 'Out of Stock';
      await asset.save();
    }

    // 🆕 UPDATED: Replenishes the specific booking.quantity to storage
    if (status === 'Returned' && booking.status === 'Approved') {
      asset.quantityAvailable += booking.quantity;
      asset.status = 'Available';
      await asset.save();
    }

    booking.status = status;
    await booking.save();
    res.status(200).json(booking);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ================= ANALYTICS =================
app.get('/api/analytics/dashboard', async (req, res) => {
  try {
    const totalAssetsCount = await Asset.countDocuments();
    const activeAllocationsCount = await Booking.countDocuments({ status: 'Approved' });
    const pendingRequestsCount = await Booking.countDocuments({ status: 'Pending' });
    const overdueReturnsCount = await Booking.countDocuments({ status: 'Approved', endDate: { $lt: new Date() } });

    const topUtilized = await Booking.aggregate([
      { $match: { status: { $in: ['Approved', 'Returned'] } } },
      { $group: { _id: '$asset', totalRequests: { $sum: 1 } } },
      { $sort: { totalRequests: -1 } },
      { $limit: 3 },
      { $lookup: { from: 'assets', localField: '_id', foreignField: '_id', as: 'assetInfo' } },
      { $unwind: '$assetInfo' },
      { $project: { name: '$assetInfo.name', totalRequests: 1, category: '$assetInfo.category' } }
    ]);

    const lowStockAlerts = await Asset.find({ quantityAvailable: { $lte: 2 } }).select('name quantityAvailable category').limit(4);

    res.status(200).json({
      summary: { totalAssets: totalAssetsCount, activeAllocations: activeAllocationsCount, pendingRequests: pendingRequestsCount, overdueReturns: overdueReturnsCount, utilizationRate: totalAssetsCount > 0 ? Math.round((activeAllocationsCount / totalAssetsCount) * 100) : 0 },
      topUtilized, lowStockAlerts
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/audit-logs', async (req, res) => {
  try {
    const { timeframe } = req.query;
    let query = {}; // Default: get all logs

    const now = new Date();
    
    // Check what the frontend is asking for
    if (timeframe === 'today') {
      const startOfDay = new Date(now.setHours(0, 0, 0, 0));
      query.createdAt = { $gte: startOfDay };
    } else if (timeframe === 'week') {
      const lastWeek = new Date(now.setDate(now.getDate() - 7));
      query.createdAt = { $gte: lastWeek };
    } else if (timeframe === 'month') {
      const lastMonth = new Date(now.setMonth(now.getMonth() - 1));
      query.createdAt = { $gte: lastMonth };
    }

    // Fetch from MongoDB using the time filter
    const logs = await AuditLog.find(query).sort({ createdAt: -1 });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: "Error fetching logs" });
  }
});


const path = require('path');

// 1. Serve static files from the frontend build folder
app.use(express.static(path.join(__dirname, 'frontend/build')));

// 2. IMPORTANT: Catch-all route for any other request
// This tells the server to always send back 'index.html' for any URL
// 1. Serve static files (React build)
app.use(express.static(path.join(__dirname, 'frontend/build')));

// 2. Middleware Fallback (The "Safe" way)
app.use((req, res, next) => {
  // If the request is for an API route, let it continue to your API logic
  if (req.url.startsWith('/api')) {
    return next();
  }
  // Otherwise, serve the React index.html
  res.sendFile(path.join(__dirname, 'frontend/build', 'index.html'));
});

// 3. Your existing app.listen code
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`System engine listening on Port ${PORT}...`));