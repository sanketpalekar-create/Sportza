import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import './Bookings.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const Bookings = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const response = await axios.get(`${API_URL}/bookings`);
      setBookings(response.data);
    } catch (error) {
      toast.error('Error loading bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;

    try {
      await axios.put(`${API_URL}/bookings/${bookingId}/cancel`);
      toast.success('Booking cancelled');
      fetchBookings();
    } catch (error) {
      toast.error('Error cancelling booking');
    }
  };

  if (loading) return <div className="loading">Loading bookings...</div>;

  return (
    <div className="bookings-container">
      <div className="page-title-with-logo">
        <img src="/logo.png" alt="Sportza" className="page-logo" />
        <h1>My Bookings</h1>
      </div>
      {bookings.length === 0 ? (
        <div className="no-bookings">
          <p>No bookings found</p>
          <Link to="/venues" className="btn-primary">Browse Venues</Link>
        </div>
      ) : (
        <div className="bookings-list">
          {bookings.map(booking => (
            <div key={booking._id} className="booking-card">
              <div className="booking-header">
                <h3>{booking.venue.name}</h3>
                <span className={`status-badge ${booking.status}`}>
                  {booking.status}
                </span>
              </div>
              <div className="booking-details">
                <p><strong>Sport:</strong> {booking.sport}</p>
                <p><strong>Date:</strong> {new Date(booking.bookingDate).toLocaleDateString()}</p>
                <p><strong>Time:</strong> {booking.startTime} - {booking.endTime}</p>
                <p><strong>Duration:</strong> {booking.totalHours} hours</p>
                <p><strong>Amount:</strong> ₹{booking.totalAmount}</p>
                <p><strong>Payment:</strong> 
                  <span className={`payment-status ${booking.paymentStatus}`}>
                    {booking.paymentStatus}
                  </span>
                </p>
                <p><strong>Location:</strong> {booking.venue.location.address}</p>
              </div>
              <div className="booking-actions">
                {booking.paymentStatus === 'pending' && (
                  <Link 
                    to={`/bookings/${booking._id}/payment`}
                    className="btn-pay"
                  >
                    Pay Now
                  </Link>
                )}
                {booking.status === 'confirmed' && booking.paymentStatus === 'completed' && (
                  <Link 
                    to={`/matches/new?booking=${booking._id}`}
                    className="btn-create-match"
                  >
                    Create Match
                  </Link>
                )}
                {booking.status !== 'cancelled' && (
                  <button 
                    onClick={() => handleCancel(booking._id)}
                    className="btn-cancel"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Bookings;
