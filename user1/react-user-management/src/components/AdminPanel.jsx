import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'react-toastify';

function AdminPanel({ user }) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (user?.isAdmin) fetchUsers();
  }, [user]);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) throw new Error('Failed to delete user');
      setUsers(users.filter((u) => u._id !== id));
      toast.success('User deleted');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleToggleAdmin = async (id) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/users/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) throw new Error('Failed to toggle admin status');
      const data = await res.json();
      setUsers(users.map((u) => (u._id === id ? { ...u, isAdmin: data.user.isAdmin } : u)));
      toast.success('Admin status updated');
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (!user || !user.isAdmin) return <Navigate to="/login" />;

  return (
    <div>
      <h1>Admin Panel</h1>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Username</th>
            <th>Email</th>
            <th>Admin</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u._id}>
              <td>{u._id}</td>
              <td>{u.username}</td>
              <td>{u.email}</td>
              <td>{u.isAdmin ? 'Yes' : 'No'}</td>
              <td>
                <button onClick={() => handleDelete(u._id)}>Delete</button>
                <button onClick={() => handleToggleAdmin(u._id)}>
                  {u.isAdmin ? 'Remove Admin' : 'Make Admin'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AdminPanel;