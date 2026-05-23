import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = {
  // ==================== DASHBOARD ====================
  getDashboard: () => axios.get(`${API_URL}/trainers/me/dashboard`),

  // ==================== PROFILE ====================
  getProfile: () => axios.get(`${API_URL}/trainers/me/profile`),
  updateProfile: (data) => axios.patch(`${API_URL}/trainers/me/profile`, data),
  getSettlement: (month, year) => axios.get(`${API_URL}/trainers/me/settlement`, { params: { month, year } }),

  // ==================== BATCHES ====================
  getBatches: () => axios.get(`${API_URL}/batches`),
  getBatch: (id) => axios.get(`${API_URL}/batches/${id}`),
  createBatch: (data) => axios.post(`${API_URL}/batches`, data),
  updateBatch: (id, data) => axios.put(`${API_URL}/batches/${id}`, data),
  deleteBatch: (id) => axios.delete(`${API_URL}/batches/${id}`),

  // ==================== PLAYERS ====================
  addPlayer: (batchId, playerId) => axios.post(`${API_URL}/batches/${batchId}/players`, { player: playerId }),
  removePlayer: (batchId, playerId) => axios.delete(`${API_URL}/batches/${batchId}/players/${playerId}`),

  // ==================== SESSIONS ====================
  getSessions: (batchId, status) => axios.get(`${API_URL}/batches/${batchId}/sessions`, { params: { status } }),
  generateSessions: (batchId, weeks, fromDate) => axios.post(`${API_URL}/batches/${batchId}/sessions/generate`, { weeks, fromDate }),
  updateSession: (sessionId, data) => axios.patch(`${API_URL}/batches/sessions/${sessionId}`, data),

  // ==================== ATTENDANCE ====================
  getAttendance: (sessionId) => axios.get(`${API_URL}/batches/sessions/${sessionId}/attendance`),
  markAttendance: (sessionId, attendance) => axios.post(`${API_URL}/batches/sessions/${sessionId}/attendance`, { attendance }),

  // ==================== PAYMENTS ====================
  getPayments: (batchId) => axios.get(`${API_URL}/batches/${batchId}/payments`),
  recordPayment: (batchId, data) => axios.post(`${API_URL}/batches/${batchId}/payments`, data),

  // ==================== ANNOUNCEMENTS ====================
  getAnnouncements: (batchId) => axios.get(`${API_URL}/batches/${batchId}/announcements`),
  postAnnouncement: (batchId, message) => axios.post(`${API_URL}/batches/${batchId}/announcements`, { message }),

  // ==================== VENUES ====================
  getMyVenues: () => axios.get(`${API_URL}/trainers/me/venues`),

  // ==================== EXPLORE (for players) ====================
  exploreTrainings: (params) => axios.get(`${API_URL}/trainings/explore`, { params }),
  getTrainerDetail: (trainerId) => axios.get(`${API_URL}/trainings/trainer/${trainerId}`),
};

export default api;
