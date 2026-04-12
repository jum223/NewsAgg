import React from 'react';

/**
 * The Digestino logo mark — a folded newspaper with a warm espresso palette.
 * size: controls the icon width/height in px.
 * variant: 'full' (icon + wordmark), 'icon' (icon only), 'wordmark' (text only)
 */
export default function Logo({ size = 36, variant = 'full', className = '' }) {
  const icon = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Background circle */}
      <circle cx="20" cy="20" r="20" fill="#c2410c" />

      {/* Newspaper body */}
      <rect x="9" y="11" width="18" height="20" rx="2" fill="white" opacity="0.95" />

      {/* Fold corner */}
      <path d="M23 11 L27 11 L27 15 Z" fill="#c2410c" opacity="0.5" />
      <path d="M23 11 L27 15 L23 15 Z" fill="white" opacity="0.7" />

      {/* Headline bar */}
      <rect x="12" y="15" width="10" height="2.5" rx="1" fill="#c2410c" />

      {/* Body lines */}
      <rect x="12" y="20" width="13" height="1.5" rx="0.75" fill="#9ca3af" />
      <rect x="12" y="23" width="11" height="1.5" rx="0.75" fill="#9ca3af" />
      <rect x="12" y="26" width="8"  height="1.5" rx="0.75" fill="#9ca3af" />

      {/* Small "D" accent dot */}
      <circle cx="31" cy="29" r="5" fill="#ea580c" />
      <text x="31" y="33" textAnchor="middle" fontSize="7" fontWeight="700" fill="white" fontFamily="Georgia, serif">d</text>
    </svg>
  );

  if (variant === 'icon') return <span className={className}>{icon}</span>;

  if (variant === 'wordmark') {
    return (
      <span className={`digestino-wordmark ${className}`}>
        <span className="digestino-the">The</span>
        <span className="digestino-name">Digestino</span>
      </span>
    );
  }

  // full
  return (
    <div className={`digestino-logo ${className}`}>
      {icon}
      <div className="digestino-text">
        <span className="digestino-wordmark">
          <span className="digestino-the">The</span>
          <span className="digestino-name">Digestino</span>
        </span>
        <span className="digestino-tagline">Your curated newsletter</span>
      </div>
    </div>
  );
}
