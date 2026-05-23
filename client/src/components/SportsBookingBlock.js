import React from 'react';
import { Link } from 'react-router-dom';
import './SportsBookingBlock.css';

/**
 * Sports Booking block – implements "Sports booking" concept from Figma.
 * Use on Home or as a CTA. Refine layout/copy when Figma design is available.
 */
const SportsBookingBlock = ({
  title = 'Sports Booking',
  subtitle = 'Book courts, turfs, and facilities. Find venues by sport and location.',
  primaryLabel = 'Find Venues',
  primaryTo = '/venues',
  secondaryLabel,
  secondaryTo,
  className = '',
}) => {
  return (
    <section className={`sports-booking-block ${className}`}>
      <div className="sports-booking-block__inner">
        <div className="sports-booking-block__content">
          <h2 className="sports-booking-block__title">{title}</h2>
          <p className="sports-booking-block__subtitle">{subtitle}</p>
          <div className="sports-booking-block__actions">
            <Link to={primaryTo} className="sports-booking-block__btn sports-booking-block__btn--primary">
              {primaryLabel}
            </Link>
            {secondaryLabel && secondaryTo && (
              <Link to={secondaryTo} className="sports-booking-block__btn sports-booking-block__btn--secondary">
                {secondaryLabel}
              </Link>
            )}
          </div>
        </div>
        <div className="sports-booking-block__visual" aria-hidden="true">
          <div className="sports-booking-block__visual-icon" />
        </div>
      </div>
    </section>
  );
};

export default SportsBookingBlock;
