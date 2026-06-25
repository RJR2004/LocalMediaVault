import React, { useState } from 'react';

/**
 * Rating Slider Component
 * Provides visual rating input with slider, number input, and preset buttons
 * Maintains architectural compliance by being a pure UI component
 */
function RatingSlider({ 
  initialValue = 0, 
  onRatingChange, 
  min = 0, 
  max = 100 
}) {
  const [rating, setRating] = useState(initialValue);
  const [isDragging, setIsDragging] = useState(false);

  const handleSliderChange = (e) => {
    const newRating = parseInt(e.target.value);
    setRating(newRating);
    onRatingChange(newRating);
  };

  const handleInputChange = (e) => {
    const newRating = parseInt(e.target.value) || 0;
    const clampedRating = Math.max(min, Math.min(max, newRating));
    setRating(clampedRating);
    onRatingChange(clampedRating);
  };

  const handlePresetClick = (value) => {
    setRating(value);
    onRatingChange(value);
  };


  return (
    <div className="rating-slider-container">
      {/* Slider Input */}
      <div className="rating-slider">
        <input
          type="range"
          min={min}
          max={max}
          value={rating}
          onChange={handleSliderChange}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onTouchStart={() => setIsDragging(true)}
          onTouchEnd={() => setIsDragging(false)}
          className="rating-range-input"
        />
      </div>
      
      {/* Number Input */}
      <div className="rating-number-container">
        <input
          type="number"
          min={min}
          max={max}
          value={rating}
          onChange={handleInputChange}
          className="rating-number-input"
          placeholder="0-100"
        />
      </div>
    </div>
  );
}

export default RatingSlider;
