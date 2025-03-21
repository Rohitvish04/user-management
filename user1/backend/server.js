const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cors = require('cors'); // Add this
const path = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  }));
  app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(cookieParser());
app.set('view engine', 'ejs');

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('MongoDB connected');
    await createAdminUser();
  })
  .catch(err => console.log('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profilePicture: { type: String, default: 'default.jpg' },
  isAdmin: { type: Boolean, default: false }
});

const User = mongoose.model('User', userSchema);

// Function to Create Admin User
async function createAdminUser() {
  try {
    const adminExists = await User.findOne({ username: 'admin' });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const adminUser = new User({
        username: 'admin',
        email: 'admin@example.com',
        password: hashedPassword,
        profilePicture: 'default.jpg',
        isAdmin: true
      });
      await adminUser.save();
      console.log('Admin user created: admin / admin123');
    } else {
      console.log('Admin user already exists');
    }
  } catch (err) {
    console.error('Error creating admin user:', err);
  }
}

// Multer Setup for File Uploads
const storage = multer.diskStorage({
  destination: './public/uploads/',
  filename: (req, file, cb) => {
    cb(null, `${req.body.username}_${Date.now()}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage });

// Authentication Middleware
const authMiddleware = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '') || req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' }); // Updated for API
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    if (!req.user) throw new Error();
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' }); // Updated for API
  }
};

const adminMiddleware = (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' }); // Updated for API
  }
  next();
};

// Existing Routes (EJS-based)
app.get('/', (req, res) => res.redirect('/login'));

app.get('/register', (req, res) => res.render('register', { error: null }));
app.post('/register', upload.single('profilePicture'), async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) return res.render('register', { error: 'Username or email already exists' });

    const profilePicture = req.file ? req.file.filename : 'default.jpg';
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword, profilePicture });
    await user.save();
    res.redirect('/login');
  } catch (err) {
    res.render('register', { error: 'Registration failed' });
  }
});

app.get('/login', (req, res) => res.render('login', { error: null }));
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.render('login', { error: 'Invalid email or password' });
    }
    const token = jwt.sign({ id: user._id, isAdmin: user.isAdmin }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.cookie('token', token, { httpOnly: true });
    res.redirect('/profile');
  } catch (err) {
    res.render('login', { error: 'Login failed' });
  }
});

app.get('/profile', authMiddleware, (req, res) => {
  res.render('profile', { user: req.user, error: null });
});

app.get('/admin', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = await User.find();
    res.render('admin', { users, error: null });
  } catch (err) {
    res.render('admin', { users: [], error: 'Failed to load users' });
  }
});
app.post('/admin', authMiddleware, adminMiddleware, async (req, res) => {
  const { userId, action } = req.body;
  try {
    if (action === 'delete') {
      await User.findByIdAndDelete(userId);
    } else if (action === 'toggleAdmin') {
      const user = await User.findById(userId);
      user.isAdmin = !user.isAdmin;
      await user.save();
    }
    const users = await User.find();
    res.render('admin', { users, error: null });
  } catch (err) {
    const users = await User.find();
    res.render('admin', { users, error: 'Action failed' });
  }
});

app.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
});

// API Endpoints for SPA
app.post('/api/register', upload.single('profilePicture'), async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    const profilePicture = req.file ? `/uploads/${req.file.filename}` : '/uploads/default.jpg';
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword, profilePicture });
    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = jwt.sign({ id: user._id, isAdmin: user.isAdmin }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.cookie('token', token, { httpOnly: true }); // Optional: keep cookie for EJS compatibility
    res.json({ token, user: { id: user._id, username: user.username, email: user.email, isAdmin: user.isAdmin } });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/profile', authMiddleware, (req, res) => {
  res.json({
    id: req.user._id,
    username: req.user.username,
    email: req.user.email,
    profilePicture: req.user.profilePicture,
    isAdmin: req.user.isAdmin
  });
});

app.get('/api/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = await User.find().select('-password'); // Exclude password field
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.delete('/api/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

app.patch('/api/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.isAdmin = !user.isAdmin;
    await user.save();
    res.json({ message: 'Admin status toggled', user: { id: user._id, isAdmin: user.isAdmin } });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

// Start Server
app.listen(process.env.PORT, () => console.log(`Server running on port ${process.env.PORT}`));