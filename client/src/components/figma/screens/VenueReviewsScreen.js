import React, { useState } from 'react';
import { ChevronLeft, Star, MessageSquare, Trash2 } from 'lucide-react';

const STAR_COLOR = '#F59E0B';

function StarRating({ value, size = 16, interactive, onChange }) {
  const [hover, setHover] = useState(0);
  const v = interactive ? (hover || value) : value;
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: interactive ? 'pointer' : 'default',
          }}
          onMouseEnter={() => interactive && setHover(i)}
          onMouseLeave={() => interactive && setHover(0)}
          onClick={() => interactive && onChange && onChange(i)}
        >
          <Star size={size} color={STAR_COLOR} fill={i <= v ? STAR_COLOR : 'none'} />
        </button>
      ))}
    </span>
  );
}

const MOCK_REVIEWS = [
  { id: '1', userName: 'Priya S.', rating: 5, review: 'Great courts and clean facilities. Will book again!', date: '2 days ago', isOwn: false },
  { id: '2', userName: 'You', rating: 4, review: 'Good experience. Parking was a bit tight.', date: '1 week ago', isOwn: true },
  { id: '3', userName: 'Rahul M.', rating: 5, review: 'Best badminton venue in the area. Staff is helpful.', date: '2 weeks ago', isOwn: false },
];

export function VenueReviewsScreen({ venue, onBack, onWriteReview, onDeleteReview }) {
  const v = venue || { id: '1', name: 'Elite Sports Arena' };
  const [reviews] = useState(MOCK_REVIEWS);
  const averageRating = 4.7;
  const reviewCount = 24;
  const [showWriteForm, setShowWriteForm] = useState(false);
  const [writeRating, setWriteRating] = useState(0);
  const [writeText, setWriteText] = useState('');

  const handleSubmitReview = () => {
    onWriteReview && onWriteReview({ venueId: v.id, rating: writeRating, review: writeText });
    setShowWriteForm(false);
    setWriteRating(0);
    setWriteText('');
  };

  return (
    <div className="figma-page" style={{ paddingBottom: '5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#fff' }}>
          <ChevronLeft size={24} />
        </button>
        <img src="/logo.png" alt="Sportza" style={{ width: 32, height: 32, objectFit: 'contain', objectPosition: '51% 52%', flexShrink: 0 }} />
        <span className="figma-heading2" style={{ margin: 0 }}>Ratings & Reviews</span>
      </div>

      <div className="figma-card" style={{ padding: 20, marginBottom: 20 }}>
        <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{v.name}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Star size={24} color={STAR_COLOR} fill={STAR_COLOR} />
            <span style={{ color: '#fff', fontSize: 24, fontWeight: 700 }}>{averageRating}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94A3B8', fontSize: 14 }}>
            <MessageSquare size={16} />
            <span>{reviewCount} review{reviewCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <button
          className="figma-btn-primary"
          style={{ width: '100%' }}
          onClick={() => setShowWriteForm(true)}
        >
          Write a review
        </button>
      </div>

      {showWriteForm && (
        <div className="figma-card" style={{ padding: 20, marginBottom: 20 }}>
          <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Your review</h3>
          <div style={{ marginBottom: 12 }}>
            <span style={{ color: '#94A3B8', fontSize: 13, marginRight: 8 }}>Rating</span>
            <StarRating value={writeRating} interactive onChange={setWriteRating} />
          </div>
          <textarea
            placeholder="Share your experience (optional)"
            value={writeText}
            onChange={(e) => setWriteText(e.target.value)}
            rows={3}
            style={{
              width: '100%',
              padding: 12,
              borderRadius: 12,
              border: '1px solid var(--figma-border)',
              background: 'var(--figma-bg)',
              color: '#fff',
              fontSize: 14,
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button className="figma-btn-ghost" style={{ flex: 1 }} onClick={() => { setShowWriteForm(false); setWriteRating(0); setWriteText(''); }}>
              Cancel
            </button>
            <button
              className="figma-btn-primary"
              style={{ flex: 1 }}
              onClick={handleSubmitReview}
              disabled={writeRating < 1}
            >
              Submit
            </button>
          </div>
        </div>
      )}

      <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 12 }}>All reviews</h3>
      <div className="figma-space-y-4">
        {reviews.map((r) => (
          <div key={r.id} className="figma-card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{r.userName}</span>
                <StarRating value={r.rating} size={14} />
              </div>
              {r.isOwn && (
                <button
                  type="button"
                  onClick={() => onDeleteReview && onDeleteReview(r.id)}
                  style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: '#94A3B8' }}
                  title="Delete your review"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            <p style={{ color: '#94A3B8', fontSize: 12, marginBottom: 8 }}>{r.date}</p>
            {r.review && <p style={{ color: '#E2E8F0', fontSize: 14, margin: 0 }}>{r.review}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
