import { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Register from './components/Register';
import Login from './components/Login';
import Profile from './components/Profile';
import AdminPanel from './components/AdminPanel';

function App() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchProfile(token);
    }
  }, []);

  const fetchProfile = async (token) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch profile');
      const data = await res.json();
      setUser(data);
    } catch (err) {
      localStorage.removeItem('token');
      setUser(null);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL}/api/logout`, { method: 'POST' });
      localStorage.removeItem('token');
      setUser(null);
      navigate('/login');
      toast.success('Logged out successfully');
    } catch (err) {
      toast.error('Logout failed');
    }
  };

  return (
    <div>
      <nav>
        {!user && <Link to="/login">Login</Link>}
        {!user && <Link to="/register">Register</Link>}
        {user && <Link to="/profile">Profile</Link>}
        {user?.isAdmin && <Link to="/admin">Admin Panel</Link>}
        {user && <button onClick={handleLogout}>Logout</button>}
      </nav>
      <Routes>
        <Route path="/register" element={<Register setUser={setUser} />} />
        <Route path="/login" element={<Login setUser={setUser} />} />
        <Route path="/profile" element={<Profile user={user} />} />
        <Route path="/admin" element={<AdminPanel user={user} />} />
        <Route path="/" element={<h1>Welcome to User Management</h1>} />
      </Routes>
    </div>
  );
}

export default App;