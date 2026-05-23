import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import LoginPage from './pages/LoginPage';
import Register from './pages/Register';
import RegisterPage from './pages/RegisterPage';
import Venues from './pages/Venues';
import VenueDetail from './pages/VenueDetail';
import Bookings from './pages/Bookings';
import Matches from './pages/Matches';
import MatchDetail from './pages/MatchDetail';
import Stats from './pages/Stats';
import Profile from './pages/Profile';
import AppMobile from './pages/AppMobile';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NavProvider } from './context/NavContext';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" />;
}

function MainLayout() {
  return (
    <div className="App">
      <Navbar />
      <main style={{ minHeight: 'calc(100vh - 80px)', paddingTop: '20px' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/venues" element={<Venues />} />
          <Route path="/venues/:id" element={<VenueDetail />} />
          <Route path="/bookings" element={<PrivateRoute><Bookings /></PrivateRoute>} />
          <Route path="/matches" element={<PrivateRoute><Matches /></PrivateRoute>} />
          <Route path="/matches/:id" element={<PrivateRoute><MatchDetail /></PrivateRoute>} />
          <Route path="/stats" element={<PrivateRoute><Stats /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
        </Routes>
      </main>
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/app" element={<AppMobile />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="*" element={<MainLayout />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <NavProvider>
          <AppRoutes />
        </NavProvider>
      </Router>
    </AuthProvider>
  );
}

export default App;
