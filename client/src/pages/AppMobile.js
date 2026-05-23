import React, { useState, useEffect } from 'react';
import { BottomNav, getDefaultTab, getTabsForMode } from '../components/figma/BottomNav';
import { HomeTab } from '../components/figma/HomeTab';
import { BookingsTab } from '../components/figma/BookingsTab';
import { ScoreMatchTab } from '../components/figma/ScoreMatchTab';
import { ProfileTab } from '../components/figma/ProfileTab';
import { TrainerDashboardTab } from '../components/figma/TrainerDashboardTab';
import { TrainerBatchesTab } from '../components/figma/TrainerBatchesTab';
import { TrainerSessionsTab } from '../components/figma/TrainerSessionsTab';
import { TrainerPaymentsTab } from '../components/figma/TrainerPaymentsTab';
import { VenueDashboardTab } from '../components/figma/VenueDashboardTab';
import { VenueBookingsTab } from '../components/figma/VenueBookingsTab';
import { VenueFacilitiesTab } from '../components/figma/VenueFacilitiesTab';
import { VenuePaymentsTab } from '../components/figma/VenuePaymentsTab';
import { VenueDetailScreen } from '../components/figma/screens/VenueDetailScreen';
import { TimeSlotScreen } from '../components/figma/screens/TimeSlotScreen';
import { BookingSummaryScreen } from '../components/figma/screens/BookingSummaryScreen';
import { PaymentTypeScreen } from '../components/figma/screens/PaymentTypeScreen';
import { PaymentScreen } from '../components/figma/screens/PaymentScreen';
import { ConfirmationScreen } from '../components/figma/screens/ConfirmationScreen';
import { BookingDetailScreen } from '../components/figma/screens/BookingDetailScreen';
import { OpenPlayDetailScreen } from '../components/figma/screens/OpenPlayDetailScreen';
import { VenueListScreen } from '../components/figma/screens/VenueListScreen';
import { LeaderboardScreen } from '../components/figma/screens/LeaderboardScreen';
import { StatsOverviewScreen } from '../components/figma/screens/StatsOverviewScreen';
import { CreateOpenPlayScreen } from '../components/figma/screens/CreateOpenPlayScreen';
import { ScoringHubScreen } from '../components/figma/screens/ScoringHubScreen';
import { MatchListScreen } from '../components/figma/screens/MatchListScreen';
import { LiveMatchScreen } from '../components/figma/screens/LiveMatchScreen';
import { PaymentHistoryScreen } from '../components/figma/screens/PaymentHistoryScreen';
import { ManageSessionScreen } from '../components/figma/screens/ManageSessionScreen';
import { VenueReviewsScreen } from '../components/figma/screens/VenueReviewsScreen';
import { TrainerListScreen } from '../components/figma/screens/TrainerListScreen';
import { TrainerDetailScreen } from '../components/figma/screens/TrainerDetailScreen';
import { TrainerReviewsScreen } from '../components/figma/screens/TrainerReviewsScreen';
import { CreateTournamentFlow } from '../components/figma/screens/CreateTournamentFlow';
import { TournamentListScreen } from '../components/figma/screens/TournamentListScreen';
import { TournamentDetailScreen } from '../components/figma/screens/TournamentDetailScreen';
import { BatchDetailScreen } from '../components/figma/screens/BatchDetailScreen';
import { CreateBatchScreen } from '../components/figma/screens/CreateBatchScreen';
import { TrainerBatchDetailScreen } from '../components/figma/screens/TrainerBatchDetailScreen';
import { SportAnalyticsHub } from '../components/figma/screens/SportAnalyticsHub';
import { SportDashboard } from '../components/figma/screens/SportDashboard';
import { MatchAnalyticsScreen } from '../components/figma/screens/MatchAnalyticsScreen';
import { PaymentReceiptScreen } from '../components/figma/screens/PaymentReceiptScreen';
import InstantBookFlow from '../components/figma/screens/InstantBookFlow';
import { useNav } from '../context/NavContext';

const STORAGE_KEY = 'sportza_mode';

export default function AppMobile() {
  const [currentMode, setCurrentModeState] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || 'player'; } catch { return 'player'; }
  });
  const [activeTab, setActiveTabState] = useState(() => getDefaultTab(currentMode));
  const [view, setView] = useState('tabs');
  const { hideBottomNav, setHideBottomNav } = useNav();

  const setActiveTab = (tabId) => {
    setActiveTabState(tabId);
    setView('tabs');
  };

  const [flowData, setFlowData] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [selectedTrainer, setSelectedTrainer] = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [selectedSport, setSelectedSport] = useState(null);
  const [selectedAnalyticsMatch, setSelectedAnalyticsMatch] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [confirmedBookingId, setConfirmedBookingId] = useState(null);
  const [selectedTournament, setSelectedTournament] = useState(null);

  const setCurrentMode = (mode) => {
    setCurrentModeState(mode);
    try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* noop */ }
    setActiveTab(getDefaultTab(mode));
    setView('tabs');
  };

  const goBack = () => {
    if (view === 'venue-detail') setView('tabs');
    else if (view === 'time-slot') setView('venue-detail');
    else if (view === 'summary') setView('time-slot');
    else if (view === 'payment-type') setView('summary');
    else if (view === 'payment') setView('payment-type');
    else if (view === 'confirmation') setView('tabs');
    else if (view === 'booking-detail' || view === 'openplay-detail') setView('tabs');
    else if (view === 'venue-list' || view === 'leaderboard' || view === 'create-open-play' || view === 'scoring-hub') setView('tabs');
    else if (view === 'tournament-list') setView('tabs');
    else if (view === 'tournament-detail') setView('tournament-list');
    else if (view === 'create-tournament') { setView('tabs'); setHideBottomNav(false); }
    else if (view === 'instant-book') { setView('tabs'); setHideBottomNav(false); }
    else if (view === 'match-list') setView('tabs');
    else if (view === 'live-match') setView('match-list');
    else if (view === 'payment-receipt') setView('payment-history');
    else if (view === 'payment-history') setView('tabs');
    else if (view === 'manage-session') setView('tabs');
    else if (view === 'venue-reviews') setView('venue-detail');
    else if (view === 'trainer-list') setView('tabs');
    else if (view === 'trainer-detail') setView('trainer-list');
    else if (view === 'trainer-reviews') setView('trainer-detail');
    else if (view === 'batch-detail') setView(selectedTrainer ? 'trainer-detail' : 'tabs');
    else if (view === 'create-batch') setView('tabs');
    else if (view === 'trainer-batch-detail') setView('tabs');
    else if (view === 'sport-analytics') setView('tabs');
    else if (view === 'sport-dashboard') setView('sport-analytics');
    else if (view === 'match-analytics') setView('sport-dashboard');
    else setView('tabs');
  };

  const venueFromHome = (v) => ({
    id: String(v.id),
    name: v.name,
    location: v.location,
    image: v.image,
    sport: v.sport,
    rating: v.rating,
    pricePerHour: typeof v.pricePerHour === 'number' ? v.pricePerHour : parseInt(String(v.price || '800').replace(/\D/g, ''), 10) || 800,
  });

  const onSelectVenue = (venue) => {
    setFlowData({ venue: venueFromHome(venue) });
    setView('venue-detail');
  };

  const onSelectSlot = ({ venue, facility, facilities, date }) => {
    const facilityList = facilities || (facility ? [facility] : []);
    const firstFac = facilityList[0];
    const firstFacName = typeof firstFac === 'string' ? firstFac : firstFac?.name;
    setFlowData((prev) => ({ ...prev, venue: venue || prev.venue, facility: firstFacName, facilities: facilityList, date }));
    setView('time-slot');
  };

  const onTimeSlotContinue = ({ selected, subtotal, gst, total, hours, facilities: slotFacilities }) => {
    const timeRange = selected.length ? `${selected[0].start} – ${selected[selected.length - 1].end}` : '';
    setFlowData((prev) => {
      const facilityList = slotFacilities || prev.facilities || (prev.facility ? [prev.facility] : []);
      const firstFac = facilityList[0];
      const firstFacName = typeof firstFac === 'string' ? firstFac : firstFac?.name;
      return {
        ...prev,
        selected, hours, subtotal, gst, total, timeRange,
        facilities: facilityList,
        booking: {
          venue: prev.venue, facility: firstFacName, facilities: facilityList,
          date: prev.date, timeRange, hours, subtotal, gst, total,
        },
      };
    });
    setView('summary');
  };

  const onSummaryContinue = (summaryPayload) => {
    setFlowData((prev) => ({ ...prev, ...summaryPayload, booking: { ...prev.booking, ...summaryPayload, total: summaryPayload.total } }));
    setView('payment-type');
  };

  const onPaymentTypeContinue = () => setView('payment');

  const onPaySuccess = () => {
    setConfirmedBookingId('BK' + Date.now().toString(36).toUpperCase());
    setView('confirmation');
  };

  const onViewBookingFromConfirmation = () => {
    setSelectedBooking(flowData?.booking || null);
    setView('booking-detail');
  };

  const onSelectBookingDetail = (booking) => { setSelectedBooking(booking); setView('booking-detail'); };
  const onSelectSession = (session) => { setSelectedSession(session); setView('openplay-detail'); };

  const onCreateTournament = () => { setView('create-tournament'); setHideBottomNav(true); };
  const onViewTournaments = () => setView('tournament-list');
  const onSelectTournament = (t) => { setSelectedTournament(t); setView('tournament-detail'); };
  const onInstantBook = () => { setView('instant-book'); setHideBottomNav(true); };

  const onInstantBookComplete = (booking) => {
    setView('tabs'); setHideBottomNav(false); setActiveTab('bookings');
    setFlowData(booking ? { booking } : null);
  };

  const onViewBatch = (batch) => {
    setSelectedBatch(batch);
    if (currentMode === 'trainer') { setView('trainer-batch-detail'); }
    else { setView('batch-detail'); }
  };

  const onCreateBatch = () => setView('create-batch');

  const renderTab = () => {
    const playerTabProps = {
      onSelectVenue: view === 'tabs' ? onSelectVenue : undefined,
      onSelectBookingDetail: view === 'tabs' ? onSelectBookingDetail : undefined,
      onSelectSession: view === 'tabs' ? onSelectSession : undefined,
      onViewVenueList: view === 'tabs' ? () => setView('venue-list') : undefined,
      onViewLeaderboard: view === 'tabs' ? () => setView('leaderboard') : undefined,
      onHostSession: view === 'tabs' ? () => setView('create-open-play') : undefined,
      onViewScoring: view === 'tabs' ? () => setView('scoring-hub') : undefined,
      onViewMatchList: view === 'tabs' ? () => setView('match-list') : undefined,
      onViewPaymentHistory: view === 'tabs' ? () => setView('payment-history') : undefined,
      onManageSession: view === 'tabs' ? (s) => { setSelectedSession(s); setView('manage-session'); } : undefined,
      onViewTrainerList: view === 'tabs' ? () => setView('trainer-list') : undefined,
      onCreateTournament: view === 'tabs' ? onCreateTournament : undefined,
      onViewTournaments: view === 'tabs' ? onViewTournaments : undefined,
      onInstantBook: view === 'tabs' ? onInstantBook : undefined,
      onViewBatch: view === 'tabs' ? onViewBatch : undefined,
      onViewSportAnalytics: view === 'tabs' ? () => setView('sport-analytics') : undefined,
    };

    if (currentMode === 'trainer') {
      switch (activeTab) {
        case 'trainer-dashboard': return <TrainerDashboardTab onViewBatch={onViewBatch} onMarkAttendance={(s) => { setSelectedBatch(s); setView('trainer-batch-detail'); }} />;
        case 'trainer-batches': return <TrainerBatchesTab onViewBatch={onViewBatch} onCreateBatch={onCreateBatch} />;
        case 'trainer-sessions': return <TrainerSessionsTab onMarkAttendance={(s) => { setSelectedBatch(s); setView('trainer-batch-detail'); }} />;
        case 'trainer-payments': return <TrainerPaymentsTab />;
        case 'profile': return <ProfileTab onCreateTournament={onCreateTournament} onViewTournaments={onViewTournaments} currentMode={currentMode} onSwitchRole={setCurrentMode} />;
        default: return <TrainerDashboardTab onViewBatch={onViewBatch} onMarkAttendance={(s) => { setSelectedBatch(s); setView('trainer-batch-detail'); }} />;
      }
    }

    if (currentMode === 'venue_owner') {
      switch (activeTab) {
        case 'venue-dashboard': return <VenueDashboardTab />;
        case 'venue-bookings': return <VenueBookingsTab />;
        case 'venue-facilities': return <VenueFacilitiesTab />;
        case 'venue-payments': return <VenuePaymentsTab />;
        case 'profile': return <ProfileTab onCreateTournament={onCreateTournament} onViewTournaments={onViewTournaments} currentMode={currentMode} onSwitchRole={setCurrentMode} />;
        default: return <VenueDashboardTab />;
      }
    }

    switch (activeTab) {
      case 'home': return <HomeTab {...playerTabProps} />;
      case 'bookings': return <BookingsTab {...playerTabProps} />;
      case 'score-match': return <ScoreMatchTab onSelectMatch={(m) => { setSelectedMatch(m); setView('live-match'); }} />;
      case 'stats': return <StatsOverviewScreen onViewLeaderboard={playerTabProps.onViewLeaderboard} onViewMatchList={playerTabProps.onViewMatchList} onViewSportAnalytics={playerTabProps.onViewSportAnalytics} />;
      case 'profile': return <ProfileTab onCreateTournament={playerTabProps.onCreateTournament} onViewTournaments={playerTabProps.onViewTournaments} currentMode={currentMode} onSwitchRole={setCurrentMode} />;
      default: return <HomeTab {...playerTabProps} />;
    }
  };

  const renderContent = () => {
    if (view === 'venue-detail') {
      return (
        <VenueDetailScreen
          venue={flowData?.venue}
          onBack={goBack}
          onSelectSlot={onSelectSlot}
          onViewReviews={(venue) => { setFlowData((p) => ({ ...p, venue })); setView('venue-reviews'); }}
        />
      );
    }
    if (view === 'venue-reviews') {
      return <VenueReviewsScreen venue={flowData?.venue} onBack={goBack} onWriteReview={() => {}} onDeleteReview={() => {}} />;
    }
    if (view === 'time-slot') {
      return <TimeSlotScreen venue={flowData?.venue} facility={flowData?.facility} facilities={flowData?.facilities} date={flowData?.date} onBack={goBack} onContinue={onTimeSlotContinue} />;
    }
    if (view === 'summary') {
      return <BookingSummaryScreen booking={flowData?.booking} onBack={goBack} onContinue={onSummaryContinue} />;
    }
    if (view === 'payment-type') {
      return <PaymentTypeScreen total={flowData?.total ?? flowData?.booking?.total} onBack={goBack} onContinue={onPaymentTypeContinue} />;
    }
    if (view === 'payment') {
      return <PaymentScreen total={flowData?.total ?? flowData?.booking?.total} onBack={goBack} onPaySuccess={onPaySuccess} />;
    }
    if (view === 'confirmation') {
      return (
        <ConfirmationScreen
          booking={flowData?.booking}
          bookingId={confirmedBookingId}
          onAddToCalendar={() => {}}
          onCreateOpenPlay={() => { setView('tabs'); setActiveTab('score-match'); }}
          onViewBooking={onViewBookingFromConfirmation}
        />
      );
    }
    if (view === 'booking-detail') {
      return <BookingDetailScreen booking={selectedBooking} onBack={goBack} onCancel={goBack} onModify={goBack} />;
    }
    if (view === 'openplay-detail') {
      return <OpenPlayDetailScreen session={selectedSession} onBack={goBack} onJoin={goBack} onLeave={goBack} onViewPlayers={() => {}} />;
    }
    if (view === 'venue-list') {
      return <VenueListScreen onBack={goBack} onSelectVenue={(venue) => onSelectVenue(venue)} />;
    }
    if (view === 'leaderboard') return <LeaderboardScreen onBack={goBack} />;
    if (view === 'create-open-play') return <CreateOpenPlayScreen onBack={goBack} />;
    if (view === 'scoring-hub') {
      return (
        <ScoringHubScreen
          onBack={goBack}
          onSelectMatch={(m) => { setSelectedMatch(m); setView('live-match'); }}
        />
      );
    }
    if (view === 'match-list') {
      return <MatchListScreen onBack={goBack} onSelectMatch={(m) => { setSelectedMatch(m); setView('live-match'); }} />;
    }
    if (view === 'live-match') {
      return <LiveMatchScreen match={selectedMatch} onBack={goBack} onStartMatch={() => {}} onUpdateScore={() => {}} onCompleteMatch={() => {}} />;
    }
    if (view === 'payment-receipt') {
      return <PaymentReceiptScreen payment={selectedPayment} onBack={goBack} />;
    }
    if (view === 'payment-history') {
      return <PaymentHistoryScreen onBack={goBack} onViewReceipt={(p) => { setSelectedPayment(p); setView('payment-receipt'); }} />;
    }
    if (view === 'manage-session') {
      return <ManageSessionScreen session={selectedSession} onBack={goBack} onViewPlayers={() => {}} onSaveEdit={() => {}} onCancelSession={() => {}} />;
    }
    if (view === 'trainer-list') {
      return <TrainerListScreen onBack={goBack} onSelectTrainer={(t) => { setSelectedTrainer(t); setView('trainer-detail'); }} />;
    }
    if (view === 'trainer-detail') {
      return (
        <TrainerDetailScreen
          trainer={selectedTrainer}
          onBack={goBack}
          onViewReviews={(t) => { setSelectedTrainer(t || selectedTrainer); setView('trainer-reviews'); }}
          onViewBatch={(b) => { setSelectedBatch(b); setView('batch-detail'); }}
        />
      );
    }
    if (view === 'trainer-reviews') {
      return <TrainerReviewsScreen trainer={selectedTrainer} onBack={goBack} canReview={false} onWriteReview={() => {}} onDeleteReview={() => {}} />;
    }
    if (view === 'batch-detail') {
      return <BatchDetailScreen batch={selectedBatch} onBack={goBack} onJoinBatch={() => goBack()} />;
    }
    if (view === 'create-batch') {
      return <CreateBatchScreen onBack={goBack} onSave={() => { setView('tabs'); }} />;
    }
    if (view === 'trainer-batch-detail') {
      return <TrainerBatchDetailScreen batch={selectedBatch} onBack={goBack} />;
    }
    if (view === 'sport-analytics') {
      return <SportAnalyticsHub onBack={goBack} onSelectSport={(sport) => { setSelectedSport(sport); setView('sport-dashboard'); }} />;
    }
    if (view === 'sport-dashboard') {
      return <SportDashboard sport={selectedSport} onBack={goBack} onViewMatch={(m) => { setSelectedAnalyticsMatch(m); setView('match-analytics'); }} />;
    }
    if (view === 'match-analytics') {
      return <MatchAnalyticsScreen match={selectedAnalyticsMatch} onBack={goBack} />;
    }
    if (view === 'tournament-list') {
      return <TournamentListScreen onBack={goBack} onSelectTournament={onSelectTournament} onCreateTournament={onCreateTournament} />;
    }
    if (view === 'tournament-detail') {
      return <TournamentDetailScreen tournament={selectedTournament} onBack={goBack} onUpdateScore={(fixture, t) => {
        const team1Name = typeof fixture.team1Ref === 'number' ? t.teams?.[fixture.team1Ref]?.name : 'TBD';
        const team2Name = typeof fixture.team2Ref === 'number' ? t.teams?.[fixture.team2Ref]?.name : 'TBD';
        setSelectedMatch({
          id: fixture._id,
          sport: t.sport,
          venue: t.venue?.name || t.location?.city || '',
          team1: { name: team1Name || 'Team A' },
          team2: { name: team2Name || 'Team B' },
          status: fixture.status === 'completed' ? 'completed' : 'in_progress',
          scores: fixture.match?.scores || null,
          tournamentId: t._id,
          fixtureId: fixture._id,
        });
        setView('live-match');
      }} />;
    }
    if (view === 'create-tournament') {
      return <CreateTournamentFlow onBack={goBack} onComplete={(t) => { if (t?._id) { onSelectTournament(t); } else { setView('tabs'); } setHideBottomNav(false); }} />;
    }
    if (view === 'instant-book') {
      return <InstantBookFlow onBack={goBack} onComplete={onInstantBookComplete} />;
    }
    return renderTab();
  };

  return (
    <div className="figma-app">
      <div className="figma-app-inner">
        <main style={{ position: 'relative', zIndex: 10, paddingBottom: hideBottomNav ? 0 : 72 }}>
          {renderContent()}
        </main>
        {!hideBottomNav && (
          <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} currentMode={currentMode} />
        )}
      </div>
    </div>
  );
}
