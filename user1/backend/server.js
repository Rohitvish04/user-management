const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use(cookieParser());
app.set('view engine', 'ejs');

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('MongoDB connected');
    await createAdminUser(); // Call admin creation function
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
      const hashedPassword = await bcrypt.hash('admin123', 10); // Default password
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
  if (!token) return res.render('login', { error: 'Please log in' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    if (!req.user) throw new Error();
    next();
  } catch (err) {
    res.render('login', { error: 'Invalid token, please log in again' });
  }
};

const adminMiddleware = (req, res, next) => {
  if (!req.user.isAdmin) return res.render('profile', { user: req.user, error: 'Admin access required' });
  next();
};

// Routes
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

// Start Server
app.listen(process.env.PORT, () => console.log(`Server running on port ${process.env.PORT}`));