-- Restore platform admin role for the seeded admin account.
-- Run when admin@sportza.in lost admin (e.g. after onboarding approve-owner overwrote role).
UPDATE users
SET
  role = 'admin',
  isActive = true,
  onboardingStatus = NULL,
  onboardingNote = NULL
WHERE email = 'admin@sportza.in';
