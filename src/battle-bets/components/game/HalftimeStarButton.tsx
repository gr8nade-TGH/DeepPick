/**
 * Halftime Star Button
 * 
 * Appears in the center of the battle grid during halftime.
 * Clicking it shows a "COMING SOON" modal for the LIVE PICK feature.
 * 
 * Future: Pay 50 Gold to get a custom crafted LIVE pick from the best AI sports bettor.
 */

import React, { useState } from 'react';
import './HalftimeStarButton.css';

interface HalftimeStarButtonProps {
  isHalftime: boolean;
}

export const HalftimeStarButton: React.FC<HalftimeStarButtonProps> = ({ isHalftime }) => {
  const [showModal, setShowModal] = useState(false);

  if (!isHalftime) {
    return null;
  }

  const handleClick = () => {
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  return (
    <>
      {/* Star Button - Centered on the grid */}
      <button 
        className="halftime-star-button"
        onClick={handleClick}
        aria-label="Get LIVE Pick"
      >
        <span className="star-icon">⭐</span>
        <span className="star-text">LIVE PICK</span>
      </button>

      {/* Coming Soon Modal */}
      {showModal && (
        <div className="halftime-modal-overlay" onClick={handleCloseModal}>
          <div className="halftime-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-star">⭐</span>
              <h2>LIVE PICK</h2>
            </div>
            
            <div className="modal-content">
              <div className="gold-cost">
                <span className="gold-icon">🪙</span>
                <span className="gold-amount">50 Gold</span>
              </div>
              
              <p className="modal-description">
                Get a custom crafted <strong>LIVE pick</strong> from the best AI sports bettor in the world!
              </p>
              
              <div className="coming-soon-badge">
                COMING SOON
              </div>
            </div>
            
            <button className="modal-close-btn" onClick={handleCloseModal}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default HalftimeStarButton;

