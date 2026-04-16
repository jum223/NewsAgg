import React from 'react';

/**
 * The Digestino / Digestina logo mark.
 * Reads the current flavor from the document's data-flavor attribute
 * so it automatically adapts when the theme changes.
 *
 * size: controls the icon width/height in px.
 * variant: 'full' (icon + wordmark), 'icon' (icon only), 'wordmark' (text only)
 * flavor: override — if not passed, reads from document root attribute
 */
export default function Logo({ size = 36, variant = 'full', className = '', flavor: flavorProp }) {
  // Read flavor from DOM if not explicitly passed
  const flavor = flavorProp ||
    (typeof document !== 'undefined'
      ? document.documentElement.getAttribute('data-flavor') || 'digestino'
      : 'digestino');

  const isDigestina = flavor === 'digestina';
  const brandColor = isDigestina ? '#be185d' : '#c2410c';
  const accentColor = isDigestina ? '#db2777' : '#ea580c';
  const editionName = isDigestina ? 'Digestina' : 'Digestino';

  const icon = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="20" cy="20" r="20" fill={brandColor} />
      <rect x="9" y="11" width="18" height="20" rx="2" fill="white" opacity="0.95" />
      <path d="M23 11 L27 11 L27 15 Z" fill={brandColor} opacity="0.5" />
      <path d="M23 11 L27 15 L23 15 Z" fill="white" opacity="0.7" />
      <rect x="12" y="15" width="10" height="2.5" rx="1" fill={brandColor} />
      <rect x="12" y="20" width="13" height="1.5" rx="0.75" fill="#9ca3af" />
      <rect x="12" y="23" width="11" height="1.5" rx="0.75" fill="#9ca3af" />
      <rect x="12" y="26" width="8"  height="1.5" rx="0.75" fill="#9ca3af" />
      <circle cx="31" cy="29" r="5" fill={accentColor} />
      <text x="31" y="33" textAnchor="middle" fontSize="7" fontWeight="700" fill="white" fontFamily="Georgia, serif">
        {isDigestina ? 'a' : 'd'}
      </text>
    </svg>
  );

  if (variant === 'icon') return <span className={className}>{icon}</span>;

  if (variant === 'wordmark') {
    return (
      <span className={`digestino-wordmark ${className}`}>
        <span className="digestino-the">The</span>
        <span className="digestino-name">{editionName}</span>
      </span>
    );
  }

  return (
    <div className={`digestino-logo ${className}`}>
      {icon}
      <div className="digestino-text">
        <span className="digestino-wordmark">
          <span className="digestino-the">The</span>
          <span className="digestino-name">{editionName}</span>
        </span>
        <span className="digestino-tagline">Your curated newsletter</span>
      </div>
    </div>
  );
}
