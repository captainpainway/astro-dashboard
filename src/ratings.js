const RATING_STYLES = {
  ideal: { label: 'Ideal', css: 'rating-ideal' },
  great: { label: 'Great', css: 'rating-great' },
  good: { label: 'Good', css: 'rating-good' },
  fair: { label: 'Fair', css: 'rating-fair' },
  poor: { label: 'Poor', css: 'rating-poor' },
  bad: { label: 'Bad', css: 'rating-bad' },
}

export function ratingStyle(rating) {
  return RATING_STYLES[rating] ?? { label: rating ?? '—', css: 'rating-none' }
}

/** Normalized rating key for css class suffixes; unknown/null → 'none'. */
export function normalizeRating(rating) {
  return RATING_STYLES[rating] ? rating : 'none'
}