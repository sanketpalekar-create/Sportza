-- Rollback: Split with Friends + Activity Expansion + User onboarding (20260521120000)
-- Run only if that migration was applied to your database.

DROP TABLE IF EXISTS `processed_webhook_events`;

DROP INDEX `booking_payments_paymentGatewayId_key` ON `booking_payments`;

ALTER TABLE `booking_payments`
  DROP COLUMN `splitPaymentId`,
  MODIFY COLUMN `userId` INT NOT NULL;

DROP INDEX `split_payments_bookingId_guestPhone_idx` ON `split_payments`;
DROP INDEX `split_payments_bookingId_slotIndex_key` ON `split_payments`;
DROP INDEX `split_payments_claimToken_key` ON `split_payments`;

ALTER TABLE `split_payments`
  DROP COLUMN `updatedAt`,
  DROP COLUMN `createdAt`,
  DROP COLUMN `slotIndex`,
  DROP COLUMN `claimToken`,
  DROP COLUMN `guestEmail`,
  DROP COLUMN `guestPhone`,
  DROP COLUMN `guestName`,
  MODIFY COLUMN `userId` INT NOT NULL;

ALTER TABLE `bookings`
  DROP COLUMN `activityStartsAt`,
  DROP COLUMN `estimatedWaitMinutes`,
  DROP COLUMN `arriveBy`,
  DROP COLUMN `participantCount`,
  DROP COLUMN `bookingUnit`,
  DROP COLUMN `activityId`,
  DROP COLUMN `payoutReference`,
  DROP COLUMN `settlementAt`,
  DROP COLUMN `settlementStatus`,
  DROP COLUMN `splitLinkSharedAt`,
  DROP COLUMN `splitPayDeadlineAt`,
  DROP COLUMN `splitCount`;

ALTER TABLE `facilities`
  DROP COLUMN `bookingUnit`,
  DROP COLUMN `activityIds`;

ALTER TABLE `venues`
  DROP COLUMN `activityIds`;

ALTER TABLE `users`
  DROP COLUMN `onboardingSkippedAt`,
  DROP COLUMN `onboardingCompletedAt`,
  DROP COLUMN `onboardingStep`,
  DROP COLUMN `preferences`,
  DROP COLUMN `preferredTimeSlots`,
  DROP COLUMN `locationPin`,
  DROP COLUMN `locationAddr`,
  DROP COLUMN `locationCity`;
