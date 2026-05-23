import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import './VenueDetail.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const VenueDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [venue, setVenue] = useState(null);
  const [bookingData, setBookingData] = useState({
    sport: '',
    bookingDate: '',
    startTime: '',
    endTime: ''
  });
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVenue();
  }, [id]);

  const fetchVenue = async () => {
    try {
      const response = await axios.get(`${API_URL}/venues/${id}`);
      setVenue(response.data);
      const v = response.data;
      const firstSport = (v.sports && v.sports[0]) || (v.sportRates && v.sportRates[0]?.sport);
      if (firstSport) setBookingData(prev => ({ ...prev, sport: firstSport }));
    } catch (error) {
      toast.error('Error loading venue');
    } finally {
      setLoading(false);
    }
  };

  const sportsForVenue = () => {
    if (!venue) return [];
    if (venue.sports && venue.sports.length > 0) return venue.sports;
    if (venue.sportRates && venue.sportRates.length > 0) return venue.sportRates.map(sr => sr.sport);
    return [];
  };

  const fetchEstimate = async () => {
    if (!bookingData.sport || !bookingData.startTime || !bookingData.endTime) {
      setEstimate(null);
      return;
    }
    try {
      const res = await axios.post(`${API_URL}/bookings/estimate`, {
        venue: id,
        sport: bookingData.sport,
        startTime: bookingData.startTime,
        endTime: bookingData.endTime,
        bookingDate: bookingData.bookingDate || new Date().toISOString().split('T')[0]
      });
      setEstimate(res.data);
    } catch {
      setEstimate(null);
    }
  };

  useEffect(() => {
    fetchEstimate();
  }, [bookingData.sport, bookingData.startTime, bookingData.endTime, bookingData.bookingDate, id]);

  const handleBooking = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please login to book');
      navigate('/login');
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/bookings`, {
        venue: id,
        sport: bookingData.sport,
        bookingDate: bookingData.bookingDate,
        startTime: bookingData.startTime,
        endTime: bookingData.endTime
      });
      toast.success('Booking created! Redirecting to payment...');
      navigate(`/bookings/${response.data._id}/payment`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Booking failed');
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (!venue) return <div>Venue not found</div>;

  const sportsList = sportsForVenue();

  return (
    <div className="venue-detail-container">
      <div className="venue-detail">
        <div className="venue-detail-header">
          <img src="/logo.png" alt="Sportza" className="page-logo venue-detail-logo" />
          <div>
            <h1>{venue.name}</h1>
          <span className="venue-sport-badge">{sportsList.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')}</span>
          </div>
        </div>
        <div className="venue-detail-content">
          <div className="venue-info-section">
            <h3>Details</h3>
            <p><strong>Location:</strong> {venue.location?.address}, {venue.location?.city}</p>
            <p><strong>Capacity:</strong> {venue.capacity} players</p>
            {venue.sportRates && venue.sportRates.length > 0 ? (
              <div className="pricing-table-wrap">
                <strong>Rates (₹/hour) by sport and time</strong>
                <table className="pricing-table">
                  <thead>
                    <tr>
                      <th>Sport</th>
                      <th>Morning (6–12)</th>
                      <th>Afternoon (12–6)</th>
                      <th>Evening (6–10)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {venue.sportRates.map((sr, idx) => (
                      <tr key={idx}>
                        <td>{sr.sport.charAt(0).toUpperCase() + sr.sport.slice(1)}</td>
                        <td>₹{sr.rates?.morning ?? '—'}</td>
                        <td>₹{sr.rates?.afternoon ?? '—'}</td>
                        <td>₹{sr.rates?.evening ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p><strong>Price:</strong> ₹{venue.pricePerHour} per hour</p>
            )}
            {venue.facilities && venue.facilities.length > 0 && (
              <div>
                <strong>Facilities:</strong>
                <ul>
                  {venue.facilities.map((facility, idx) => (
                    <li key={idx}>{facility}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {user && (
            <div className="booking-section">
              <h3>Book This Venue</h3>
              <form onSubmit={handleBooking}>
                {sportsList.length > 1 && (
                  <div className="form-group">
                    <label>Sport</label>
                    <select
                      value={bookingData.sport}
                      onChange={(e) => setBookingData({ ...bookingData, sport: e.target.value })}
                      required
                    >
                      {sportsList.map(s => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label>Date</label>
                  <input
                    type="date"
                    value={bookingData.bookingDate}
                    onChange={(e) => setBookingData({ ...bookingData, bookingDate: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Start Time</label>
                  <input
                    type="time"
                    value={bookingData.startTime}
                    onChange={(e) => setBookingData({ ...bookingData, startTime: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>End Time</label>
                  <input
                    type="time"
                    value={bookingData.endTime}
                    onChange={(e) => setBookingData({ ...bookingData, endTime: e.target.value })}
                    required
                  />
                </div>
                {estimate != null && (
                  <div className="estimate-line">
                    <p><strong>Subtotal:</strong> ₹{estimate.subtotal} ({estimate.totalHours} hrs)</p>
                    {estimate.gstAmount != null && estimate.gstAmount > 0 && (
                      <p><strong>GST ({estimate.gstRate}%):</strong> ₹{estimate.gstAmount}</p>
                    )}
                    <p><strong>Total:</strong> ₹{estimate.totalAmount}</p>
                    {estimate.minBookingHours > 0 && (
                      <p className="estimate-min">Min. booking: {estimate.minBookingHours} hr(s)</p>
                    )}
                  </div>
                )}
                <button type="submit" className="btn-book">Book Now</button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VenueDetail;
