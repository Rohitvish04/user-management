import { Navigate } from 'react-router-dom';

function Profile({ user }) {
  if (!user) return <Navigate to="/login" />;

  return (
    <div>
      <h1>Welcome, {user.username}</h1>
      <p>Email: {user.email}</p>
      <p>Admin: {user.isAdmin ? 'Yes' : 'No'}</p>
      <img src={`${import.meta.env.VITE_API_URL}${user.profilePicture}`} alt="Profile" width="100" />
    </div>
  );
}

export default Profile;