import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { setAuthToken } from "@sportza/api-client";
import MainLayout from "./layouts/MainLayout";
import AuthLayout from "./layouts/AuthLayout";
import AuthGuard from "./components/AuthGuard";
import RoleGuard from "./components/RoleGuard";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import ProfileEdit from "./pages/ProfileEdit";
import Settings from "./pages/Settings";
import Privacy from "./pages/Privacy";
import Notifications from "./pages/Notifications";
import VenueList from "./pages/venues/VenueList";
import VenueDetail from "./pages/venues/VenueDetail";
import InstantBook from "./pages/booking/InstantBook";
import BookingDetail from "./pages/booking/BookingDetail";
import BookingHistory from "./pages/booking/BookingHistory";
import MatchList from "./pages/matches/MatchList";
import LiveMatch from "./pages/matches/LiveMatch";
import CreateMatch from "./pages/matches/CreateMatch";
import ScoreMatch from "./pages/matches/ScoreMatch";
import OpenPlayList from "./pages/open-play/OpenPlayList";
import OpenPlayDetail from "./pages/open-play/OpenPlayDetail";
import CreateOpenPlay from "./pages/open-play/CreateOpenPlay";
import StatsOverview from "./pages/stats/StatsOverview";
import SportAnalyticsHub from "./pages/stats/SportAnalyticsHub";
import SportDashboard from "./pages/stats/SportDashboard";
import MatchAnalytics from "./pages/stats/MatchAnalytics";
import Leaderboard from "./pages/stats/Leaderboard";
import ManageSession from "./pages/open-play/ManageSession";
import TrainerList from "./pages/trainer/TrainerList";
import TrainerProfile from "./pages/trainer/TrainerProfile";
import TrainerReviews from "./pages/trainer/TrainerReviews";
import TrainerDashboard from "./pages/trainer/TrainerDashboard";
import TrainerBatches from "./pages/trainer/TrainerBatches";
import TrainerSessions from "./pages/trainer/TrainerSessions";
import TrainerPayments from "./pages/trainer/TrainerPayments";
import BatchDetail from "./pages/trainer/BatchDetail";
import CreateBatch from "./pages/trainer/CreateBatch";
import PlayerProgressCard from "./pages/trainer/PlayerProgressCard";
import TrainerBatchCalendar from "./pages/trainer/TrainerBatchCalendar";
import PublicPlayerProgress from "./pages/share/PublicPlayerProgress";
import TournamentList from "./pages/tournaments/TournamentList";
import TournamentDetail from "./pages/tournaments/TournamentDetail";
import CreateTournament from "./pages/tournaments/CreateTournament";
import TournamentRegister from "./pages/tournaments/TournamentRegister";
import MatchSumula from "./pages/tournaments/MatchSumula";
import TournamentSpectator from "./pages/tournaments/TournamentSpectator";
import EditTournament from "./pages/tournaments/EditTournament";
import VenueDashboard from "./pages/venue-owner/VenueDashboard";
import VenueBookings from "./pages/venue-owner/VenueBookings";
import VenueCalendar from "./pages/venue-owner/VenueCalendar";
import VenueSchedule from "./pages/venue-owner/VenueSchedule";
import VenueFacilities from "./pages/venue-owner/VenueFacilities";
import VenuePayments from "./pages/venue-owner/VenuePayments";
import MyVenues from "./pages/venue-owner/MyVenues";
import VenueDetailOwner from "./pages/venue-owner/VenueDetailOwner";
import CreateVenue from "./pages/venue-owner/CreateVenue";
import VenueBookingDetail from "./pages/venue-owner/VenueBookingDetail";
import VenueReports from "./pages/venue-owner/VenueReports";
import PaymentHistory from "./pages/payments/PaymentHistory";
import PaymentReceipt from "./pages/payments/PaymentReceipt";
import TrainingDiscovery from "./pages/training/TrainingDiscovery";
import TrainingBatchDetail from "./pages/training/TrainingBatchDetail";
import MyBatches from "./pages/training/MyBatches";
import Scoreboard from "./pages/matches/Scoreboard";
import PairDisplay from "./pages/display/PairDisplay";
import ClaimDisplay from "./pages/display/ClaimDisplay";
import VenueDisplays from "./pages/venue-owner/VenueDisplays";
import MatchmakingSuggestions from "./pages/matchmaking/MatchmakingSuggestions";
import PeerInvites from "./pages/matchmaking/PeerInvites";
import PlayerProfile from "./pages/players/PlayerProfile";
import PeerCompare from "./pages/players/PeerCompare";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminAccounts from "./pages/admin/AdminAccounts";
import AdminOnboarding from "./pages/admin/AdminOnboarding";
import AdminVenues from "./pages/admin/AdminVenues";
import AdminLedger from "./pages/admin/AdminLedger";
import AdminAudit from "./pages/admin/AdminAudit";

export default function App() {
  useEffect(() => {
    const localToken = localStorage.getItem("auth_token");
    if (localToken) setAuthToken(localToken);
  }, []);

  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Route>

      <Route element={<MainLayout />}>
        <Route path="/venues" element={<VenueList />} />
        <Route path="/venues/:id" element={<VenueDetail />} />
        <Route path="/training" element={<TrainingDiscovery />} />
        <Route path="/training/:id" element={<TrainingBatchDetail />} />
        <Route path="/trainers" element={<TrainerList />} />
        <Route path="/trainers/:id" element={<TrainerProfile />} />
        <Route path="/score-match" element={<ScoreMatch />} />
        <Route path="/open-plays" element={<OpenPlayList />} />
        <Route path="/open-plays/:id" element={<OpenPlayDetail />} />
        <Route path="/tournaments" element={<TournamentList />} />
        <Route path="/tournaments/:id" element={<TournamentDetail />} />
        <Route path="/tournaments/:id/register" element={<TournamentRegister />} />
        <Route path="/tournaments/:id/sumula/:fixtureId" element={<MatchSumula />} />
        <Route path="/stats/leaderboard" element={<Leaderboard />} />
        <Route path="/leaderboard" element={<Navigate to="/stats/leaderboard" replace />} />
        <Route path="/share/player-progress" element={<PublicPlayerProgress />} />
        <Route element={<AuthGuard />}>
          <Route path="/" element={<Home />} />
          <Route path="/book" element={<InstantBook />} />
          <Route path="/bookings" element={<BookingHistory />} />
          <Route path="/bookings/:id" element={<BookingDetail />} />
          <Route path="/matches" element={<MatchList />} />
          <Route path="/matches/create" element={<CreateMatch />} />
          <Route path="/matches/:id" element={<LiveMatch />} />
          <Route path="/open-plays/create" element={<CreateOpenPlay />} />
          <Route path="/open-plays/:id/manage" element={<ManageSession />} />
          <Route path="/tournaments/create" element={<CreateTournament />} />
          <Route path="/tournaments/:id/edit" element={<EditTournament />} />
          <Route path="/stats" element={<StatsOverview />} />
          <Route path="/stats/analytics" element={<SportAnalyticsHub />} />
          <Route path="/stats/sport/:sport" element={<SportDashboard />} />
          <Route path="/stats/match/:matchId" element={<MatchAnalytics />} />
          <Route path="/my-batches" element={<MyBatches />} />
          <Route path="/matchmaking" element={<MatchmakingSuggestions />} />
          <Route path="/matchmaking/invites" element={<PeerInvites />} />
          <Route path="/players/:id" element={<PlayerProfile />} />
          <Route path="/players/:id/compare" element={<PeerCompare />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/edit" element={<ProfileEdit />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/payments" element={<PaymentHistory />} />
          <Route path="/payments/receipt/:id" element={<PaymentReceipt />} />

          {/* ── Coach / Trainer routes ── */}
          <Route element={<RoleGuard required="coach" />}>
            <Route path="/trainer" element={<TrainerDashboard />} />
            <Route path="/trainer/sessions" element={<TrainerSessions />} />
            <Route path="/trainer/payments" element={<TrainerPayments />} />
            <Route path="/trainer/reviews" element={<TrainerReviews />} />
            <Route path="/trainer/batches" element={<TrainerBatches />} />
            <Route path="/trainer/batches/create" element={<CreateBatch />} />
            <Route path="/trainer/batches/:batchId/progress/:playerId" element={<PlayerProgressCard />} />
            <Route path="/trainer/batches/:id" element={<BatchDetail />} />
            <Route path="/trainer/calendar" element={<TrainerBatchCalendar />} />
          </Route>

          {/* ── Venue Owner routes ── */}
          <Route element={<RoleGuard required="venue_owner" />}>
            <Route path="/venue-owner" element={<VenueDashboard />} />
            <Route path="/venue-owner/venues" element={<MyVenues />} />
            <Route path="/venue-owner/venues/create" element={<CreateVenue />} />
            <Route path="/venue-owner/venues/:id" element={<VenueDetailOwner />} />
            <Route path="/venue-owner/bookings" element={<VenueBookings />} />
            <Route path="/venue-owner/bookings/:id" element={<VenueBookingDetail />} />
            <Route path="/venue-owner/calendar" element={<VenueCalendar />} />
            <Route path="/venue-owner/schedule" element={<VenueSchedule />} />
            <Route path="/venue-owner/facilities" element={<VenueFacilities />} />
            <Route path="/venue-owner/payments" element={<VenuePayments />} />
            <Route path="/venue-owner/reports" element={<VenueReports />} />
            <Route path="/venue-owner/displays" element={<VenueDisplays />} />
          </Route>

          {/* ── Admin routes ── */}
          <Route element={<RoleGuard required="admin" />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/accounts" element={<AdminAccounts />} />
            <Route path="/admin/onboarding" element={<AdminOnboarding />} />
            <Route path="/admin/venues" element={<AdminVenues />} />
            <Route path="/admin/ledger" element={<AdminLedger />} />
            <Route path="/admin/audit" element={<AdminAudit />} />
          </Route>

          {/* Claim display — auth required, phone user after scanning QR */}
          <Route path="/claim/:token" element={<ClaimDisplay />} />
        </Route>
      </Route>

      {/* Fullscreen TV pages — no layout wrapper, no auth required */}
      <Route path="/scoreboard/:matchId" element={<Scoreboard />} />
      <Route path="/display/pair/:token" element={<PairDisplay />} />

      {/* Public spectator page — shareable, no auth, no nav */}
      <Route path="/t/:id" element={<TournamentSpectator />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
