/* LocalComponents.jsx — self-contained DS components for the Haus Fund UI Kit
 * Mirrors components/core/* without requiring the compiled _ds_bundle.js
 */

function Button({ children, variant = 'primary', size = 'md', disabled = false, onClick, fullWidth = false }) {
  const [hov, setHov] = React.useState(false);
  const [pressed, setPressed] = React.useState(false);
  const sizes = {
    sm: { padding: '0 12px', height: '32px', fontSize: '12px', borderRadius: '4px' },
    md: { padding: '0 18px', height: '40px', fontSize: '14px', borderRadius: '6px' },
    lg: { padding: '0 24px', height: '48px', fontSize: '15px', borderRadius: '6px' },
  };
  const variants = {
    primary:   { background: hov ? '#3A3A3A' : '#0D0D0D', color: '#fff',     border: 'none' },
    secondary: { background: hov ? '#E5E1D9' : '#F0EDE6', color: '#0D0D0D',  border: 'none' },
    ghost:     { background: hov ? '#F0EDE6' : 'transparent', color: '#3A3A3A', border: 'none' },
    outline:   { background: hov ? '#F0EDE6' : 'transparent', color: '#0D0D0D', border: '1.5px solid #CECAC1' },
    forest:    { background: hov ? '#2A5C46' : '#1C3B2D', color: '#fff',     border: 'none' },
    bronze:    { background: hov ? '#9A7040' : '#B8924A', color: '#fff',     border: 'none' },
    danger:    { background: hov ? '#a02a2a' : '#B83232', color: '#fff',     border: 'none' },
  };
  return (
    <button
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
        fontFamily: "'DM Sans', sans-serif", fontWeight: 600, letterSpacing: '0.01em',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
        outline: 'none', boxSizing: 'border-box', whiteSpace: 'nowrap', userSelect: 'none',
        transition: 'background 120ms, transform 80ms',
        transform: pressed && !disabled ? 'scale(0.97)' : 'scale(1)',
        width: fullWidth ? '100%' : 'auto',
        ...sizes[size], ...variants[variant],
      }}
    >{children}</button>
  );
}

function Badge({ children, variant = 'default', size = 'md' }) {
  const variants = {
    default:  { background: '#F0EDE6', color: '#3A3A3A' },
    primary:  { background: '#0D0D0D', color: '#fff' },
    forest:   { background: '#BDDDD3', color: '#1C3B2D' },
    bronze:   { background: '#F2E8D5', color: '#6B4E2A' },
    steel:    { background: '#C8DFEF', color: '#1A3D5C' },
    positive: { background: '#D8F0E5', color: '#1B7A48' },
    warning:  { background: '#FDF0D5', color: '#C47A1A' },
    negative: { background: '#F5D5D5', color: '#B83232' },
    info:     { background: '#D5E5F8', color: '#1A4E8A' },
  };
  const sizes = {
    sm: { padding: '2px 6px',  fontSize: '10px', borderRadius: '2px', height: '18px' },
    md: { padding: '3px 8px',  fontSize: '11px', borderRadius: '4px', height: '22px' },
    lg: { padding: '4px 10px', fontSize: '12px', borderRadius: '4px', height: '26px' },
  };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
      letterSpacing: '0.04em', textTransform: 'uppercase', lineHeight: 1, whiteSpace: 'nowrap',
      ...variants[variant], ...sizes[size],
    }}>{children}</span>
  );
}

function Tag({ children, color = 'default', onRemove, onClick }) {
  const [hov, setHov] = React.useState(false);
  const colors = {
    default: { background: hov ? '#E5E1D9' : '#F0EDE6', color: '#3A3A3A', borderColor: '#CECAC1' },
    forest:  { background: '#BDDDD3', color: '#1C3B2D', borderColor: 'rgba(28,59,45,0.2)' },
    bronze:  { background: '#F2E8D5', color: '#6B4E2A', borderColor: 'rgba(184,146,74,0.25)' },
    steel:   { background: '#C8DFEF', color: '#1A3D5C', borderColor: 'rgba(26,61,92,0.2)' },
    ink:     { background: '#0D0D0D', color: '#fff',    borderColor: '#0D0D0D' },
  };
  return (
    <span onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px',
      borderRadius: '4px', border: '1px solid', fontFamily: "'DM Sans', sans-serif",
      fontSize: '12px', fontWeight: 500, lineHeight: 1.4, cursor: onClick ? 'pointer' : 'default',
      transition: 'background 120ms', ...colors[color],
    }}>
      {children}
      {onRemove && (
        <button onClick={e => { e.stopPropagation(); onRemove(); }}
          style={{ background: 'none', border: 'none', padding: '0 1px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'inherit', opacity: 0.5, fontSize: '14px', lineHeight: 1 }}>
          ×
        </button>
      )}
    </span>
  );
}

function Avatar({ name, src, size = 'md', variant = 'default', shape = 'circle' }) {
  const sizes = {
    xs: { dim: 24, fontSize: '9px' }, sm: { dim: 32, fontSize: '12px' },
    md: { dim: 40, fontSize: '14px' }, lg: { dim: 56, fontSize: '18px' }, xl: { dim: 72, fontSize: '24px' },
  };
  const variants = {
    default:     { background: '#E5E1D9', color: '#3A3A3A' },
    forest:      { background: '#BDDDD3', color: '#1C3B2D' },
    bronze:      { background: '#F2E8D5', color: '#6B4E2A' },
    steel:       { background: '#C8DFEF', color: '#1A3D5C' },
    dark:        { background: '#0D0D0D', color: '#fff' },
    forest_dark: { background: '#1C3B2D', color: '#fff' },
  };
  const initials = name ? name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() : '?';
  const { dim, fontSize } = sizes[size];
  const borderRadius = shape === 'circle' ? '50%' : shape === 'rounded' ? '6px' : '4px';
  return (
    <div style={{ width: dim, height: dim, borderRadius, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif", fontSize, fontWeight: 700, flexShrink: 0, overflow: 'hidden', ...variants[variant] }}>
      {src ? <img src={src} alt={name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
    </div>
  );
}

function Card({ children, padding = 'md', shadow = 'sm', radius = 'md', border = true, background, onClick, style }) {
  const [hov, setHov] = React.useState(false);
  const isClickable = typeof onClick === 'function';
  const paddings = { none: '0', sm: '12px', md: '20px', lg: '28px', xl: '40px' };
  const shadows = { none: 'none', xs: '0 1px 2px rgba(13,13,13,0.06)', sm: '0 1px 4px rgba(13,13,13,0.06)', md: '0 4px 12px rgba(13,13,13,0.08)', lg: '0 8px 24px rgba(13,13,13,0.10)' };
  const radii = { none: '0', sm: '4px', md: '10px', lg: '16px', xl: '24px' };
  return (
    <div onClick={onClick} onMouseEnter={() => isClickable && setHov(true)} onMouseLeave={() => isClickable && setHov(false)} style={{
      backgroundColor: background || '#fff', padding: paddings[padding],
      boxShadow: isClickable && hov ? '0 4px 12px rgba(13,13,13,0.08)' : shadows[shadow],
      borderRadius: radii[radius], border: border ? '1px solid #E5E1D9' : 'none',
      cursor: isClickable ? 'pointer' : 'default', transition: 'box-shadow 160ms, transform 120ms',
      transform: isClickable && hov ? 'translateY(-1px)' : 'translateY(0)', ...style,
    }}>{children}</div>
  );
}

function StatCard({ label, value, subvalue, trend, trendValue, accent = 'default' }) {
  const tops   = { default: '#CECAC1', forest: '#1C3B2D', bronze: '#B8924A', steel: '#1A3D5C' };
  const trendC = { up: '#1B7A48', down: '#B83232', flat: '#727272' };
  const arrows = { up: '↑', down: '↓', flat: '→' };
  return (
    <div style={{ backgroundColor: '#fff', border: '1px solid #E5E1D9', borderTop: `3px solid ${tops[accent]}`, borderRadius: '10px', padding: '20px 24px 22px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#727272' }}>{label}</div>
      <div style={{ fontFamily: "'Barlow Condensed', 'Barlow', sans-serif", fontSize: '36px', fontWeight: 700, lineHeight: 1.05, color: '#0D0D0D', letterSpacing: '-0.01em' }}>{value}</div>
      {(subvalue || (trend && trendValue)) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
          {subvalue    && <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', color: '#727272' }}>{subvalue}</span>}
          {trend && trendValue && <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: 600, color: trendC[trend] }}>{arrows[trend]} {trendValue}</span>}
        </div>
      )}
    </div>
  );
}

function Input({ label, placeholder, value, onChange, type = 'text', error, hint, disabled = false, size = 'md', prefix, suffix, required = false }) {
  const [focused, setFocused] = React.useState(false);
  const sizes = { sm: { height: '32px', fontSize: '13px', px: '10px' }, md: { height: '40px', fontSize: '14px', px: '12px' }, lg: { height: '48px', fontSize: '15px', px: '14px' } };
  const sz = sizes[size];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', width: '100%' }}>
      {label && <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: 600, color: '#3A3A3A' }}>{label}{required && <span style={{ color: '#B83232', marginLeft: '3px' }}>*</span>}</label>}
      <div style={{ display: 'flex', alignItems: 'stretch', height: sz.height, borderRadius: '6px', border: `1px solid ${error ? '#B83232' : focused ? '#727272' : '#CECAC1'}`, backgroundColor: disabled ? '#F0EDE6' : '#fff', overflow: 'hidden', boxShadow: focused && !error ? '0 0 0 3px #E5E1D9' : 'none', transition: 'border-color 140ms, box-shadow 140ms' }}>
        {prefix && <div style={{ padding: `0 ${sz.px}`, display: 'flex', alignItems: 'center', fontSize: sz.fontSize, color: '#727272', background: '#F0EDE6', borderRight: '1px solid #E5E1D9', flexShrink: 0 }}>{prefix}</div>}
        <input type={type} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} required={required} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={{ flex: 1, height: '100%', border: 'none', outline: 'none', padding: `0 ${sz.px}`, fontSize: sz.fontSize, fontFamily: "'DM Sans', sans-serif", color: '#0D0D0D', background: 'transparent', cursor: disabled ? 'not-allowed' : 'text' }} />
        {suffix && <div style={{ padding: `0 ${sz.px}`, display: 'flex', alignItems: 'center', fontSize: sz.fontSize, color: '#727272', background: '#F0EDE6', borderLeft: '1px solid #E5E1D9', flexShrink: 0 }}>{suffix}</div>}
      </div>
      {(error || hint) && <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: error ? '#B83232' : '#727272' }}>{error || hint}</div>}
    </div>
  );
}

function Select({ label, value, onChange, options = [], placeholder = 'Select…', error, hint, disabled = false, size = 'md', required = false }) {
  const sizes = { sm: { height: '32px', fontSize: '13px', px: '10px' }, md: { height: '40px', fontSize: '14px', px: '12px' }, lg: { height: '48px', fontSize: '15px', px: '14px' } };
  const sz = sizes[size];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', width: '100%' }}>
      {label && <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: 600, color: '#3A3A3A' }}>{label}{required && <span style={{ color: '#B83232', marginLeft: '3px' }}>*</span>}</label>}
      <div style={{ position: 'relative' }}>
        <select value={value} onChange={onChange} disabled={disabled} required={required} style={{ width: '100%', height: sz.height, padding: `0 36px 0 ${sz.px}`, border: `1px solid ${error ? '#B83232' : '#CECAC1'}`, borderRadius: '6px', background: disabled ? '#F0EDE6' : '#fff', color: value ? '#0D0D0D' : '#B0ADA6', fontSize: sz.fontSize, fontFamily: "'DM Sans', sans-serif", cursor: disabled ? 'not-allowed' : 'pointer', appearance: 'none', outline: 'none' }}>
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options.map(opt => { const v = typeof opt === 'string' ? opt : opt.value; const l = typeof opt === 'string' ? opt : opt.label; return <option key={v} value={v}>{l}</option>; })}
        </select>
        <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#727272', fontSize: '11px' }}>▾</div>
      </div>
      {(error || hint) && <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: error ? '#B83232' : '#727272' }}>{error || hint}</div>}
    </div>
  );
}

// Expose under the DS namespace so portal screens work without the compiled bundle
window.HausFundDesignSystem_a048b8 = { Button, Badge, Tag, Avatar, Card, StatCard, Input, Select };
