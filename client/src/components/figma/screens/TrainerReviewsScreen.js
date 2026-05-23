import React, { useState } from 'react';
import { ChevronLeft, Star, MessageSquare, Trash2, Info } from 'lucide-react';

const STAR_COLOR = '#F59E0B';

function StarRating({ value, size = 16 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} color={STAR_COLOR} fill={i <= value ? STAR_COLOR : 'none'} />
      ))}
    </span>
  );
}

const MOCK_REVIEWS = [
  { id: '1', userName: 'Priya S.', rating: 5, review: 'Excellent coach. Improved my game in just 2 months!', date: '1 week ago', isOwn: false },
  { id: '2', userName: 'Rahul M.', rating: 5, review: 'Very professional. Great drills and match practice.', date: '2 weeks ago', isOwn: false },
  { id: '3', userName: 'You', rating: 0, review: null, date: null, isOwn: true },
];

export function TrainerReviewsScreen({ trainer, onBack, canReview, onWriteReview, onDeleteReview }) {
  const t = trainer || { id: '1', name: 'Arjun Kumar', rating: 4.9, reviewCount: 48 };
  const [reviews] = useState(MOCK_REVIEWS.filter((r) => !r.isOwn || r.rating > 0));
  const averageRating = t.rating ?? 4.9;
  const reviewCount = t.reviewCount ?? 48;
  const [showWriteForm, setShowWriteForm] = useState(false);
  const [writeRating, setWriteRating] = useState(0);
  const [writeText, setWriteText] = useState('');

  const handleSubmitReview = () => {
    onWriteReview && onWriteReview({ trainerId: t.id, rating: writeRating, review: writeText });
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
        <span className="figma-heading2" style={{ margin: 0 }}>Trainer Reviews</span>
      </div>

      <div className="figma-card" style={{ padding: 20, marginBottom: 20 }}>
        <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{t.name}</h2>
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

        {!canReview && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', marginBottom: 16 }}>
            <Info size={18} color="#3B82F6" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ color: '#94A3B8', fontSize: 13, margin: 0 }}>
              You can leave a review only after completing at least 1 month in a batch with this trainer.
            </p>
          </div>
        )}

        {canReview && (
          <button
            className="figma-btn-primary"
            style={{ width: '100%' }}
            onClick={() => setShowWriteForm(true)}
          >
            Write a review
          </button>
        )}
      </div>

      {showWriteForm && canReview && (
        <div className="figma-card" style={{ padding: 20, marginBottom: 20 }}>
          <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Your review</h3>
          <div style={{ marginBottom: 12 }}>
            <span style={{ color: '#94A3B8', fontSize: 13, marginRight: 8 }}>Rating</span>
            <span style={{ display: 'inline-flex', gap: 4 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  type="button"
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                  onClick={() => setWriteRating(i)}
                >
                  <Star size={24} color={STAR_COLOR} fill={i <= writeRating ? STAR_COLOR : 'none'} />
                </button>
              ))}
            </span>
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
            <button className="figma-btn-primary" style={{ flex: 1 }} onClick={handleSubmitReview} disabled={writeRating < 1}>
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
            {r.date && <p style={{ color: '#94A3B8', fontSize: 12, marginBottom: 8 }}>{r.date}</p>}
            {r.review && <p style={{ color: '#E2E8F0', fontSize: 14, margin: 0 }}>{r.review}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
