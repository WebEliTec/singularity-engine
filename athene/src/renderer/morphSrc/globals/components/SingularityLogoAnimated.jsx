// Animated brand mark for Singularity Engine. Lifted 1:1 from
// morpheus/devApp/globals/components/MorpheusLogoAnimated.jsx (the
// "Morpheus Development Center" hero logo, version 5) — same geometry,
// gradients, and animations. Renamed component + wrapper class so
// future view-specific styling can target one without affecting the
// other when both shells run side-by-side.

export default function SingularityLogoAnimated( { width = '200px', height = '200px', className } ) {
  return (
    <div
      className="singularity-logo-animated-01"
      style={{
        width,
        height,
        display:        'flex',
        justifyContent: 'center',
        alignItems:     'center',
      }}
    >
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }} className={ className }>
        <defs>
          <linearGradient id="singularityTealGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   style={{ stopColor: '#4dd0e1', stopOpacity: 1 }} />
            <stop offset="50%"  style={{ stopColor: '#0ad4ef', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#00bcd4', stopOpacity: 1 }} />
          </linearGradient>
        </defs>

        {/* Outer ring — static */}
        <circle cx="50" cy="50" r="43" fill="none" stroke="#1d2e3e" strokeWidth="9" />

        {/* Outer ring highlight — rotating glow */}
        <g>
          <circle cx="50" cy="50" r="43" fill="none" stroke="#18e5eb" strokeWidth="1" strokeDasharray="20 249" opacity="0.6" />
          <animateTransform attributeName="transform" attributeType="XML" type="rotate" from="0 50 50"   to="360 50 50" dur="12s" repeatCount="indefinite" />
        </g>

        {/* Second arc — opposite side */}
        <g>
          <circle cx="50" cy="50" r="43" fill="none" stroke="#18e5eb" strokeWidth="1" strokeDasharray="20 249" opacity="0.4" />
          <animateTransform attributeName="transform" attributeType="XML" type="rotate" from="180 50 50" to="540 50 50" dur="12s" repeatCount="indefinite" />
        </g>

        {/* Inner teal arc */}
        <g>
          <path d="M 33.74 66.26 A 23 23 0 1 1 66.26 66.26"
            fill="none"
            stroke="url(#singularityTealGradient)"
            strokeWidth="14" />
          <animateTransform attributeName="transform" attributeType="XML" type="rotate" from="0 50 50" to="-360 50 50" dur="24s" repeatCount="indefinite" />
        </g>

        {/* Center pulse */}
        <circle cx="50" cy="50" r="7" fill="url(#singularityTealGradient)" stroke="none">
          <animate attributeName="opacity" values="1;0.8;1" dur="4s" repeatCount="indefinite" />
        </circle>

        {/* Orbiting dot */}
        <g>
          <circle cx="50" cy="3" r="3.5" fill="#18e5eb" stroke="none" />
          <animateTransform attributeName="transform" attributeType="XML" type="rotate" from="0 50 50" to="360 50 50" dur="16s" repeatCount="indefinite" />
        </g>
      </svg>
    </div>
  );
}
