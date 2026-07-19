/* Sidebar navigation component for Haus Fund investor portal */

function Sidebar({ activeScreen, onNavigate }) {
  const { Icon } = window;

  const navItems = [
    { id: 'dashboard',  label: 'Dashboard',        icon: 'layout-dashboard' },
    { id: 'portfolio',  label: 'Portfolio',         icon: 'briefcase' },
    { id: 'deal-flow',  label: 'Deal Flow',         icon: 'git-branch' },
    { id: 'reports',    label: 'Reports',           icon: 'file-text' },
    { id: 'lps',        label: 'Limited Partners',  icon: 'users' },
  ];

  const [hoveredItem, setHoveredItem] = React.useState(null);

  const navBtnStyle = (id) => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
    backgroundColor: activeScreen === id ? 'rgba(255,255,255,0.13)' : hoveredItem === id ? 'rgba(255,255,255,0.06)' : 'transparent',
    color: activeScreen === id ? '#ffffff' : 'rgba(255,255,255,0.52)',
    fontFamily: 'var(--font-body)', fontSize: 14,
    fontWeight: activeScreen === id ? 500 : 400,
    transition: 'background-color 120ms, color 120ms',
    width: '100%', textAlign: 'left',
  });

  return (
    <div style={{
      width: 240, minWidth: 240, height: '100vh',
      backgroundColor: '#1C3B2D', display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <img src="../../assets/logo-white.svg" alt="HAUS"
          style={{ height: 34, objectFit: 'contain' }}
        />
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map(item => (
          <button key={item.id} onClick={() => onNavigate(item.id)}
            onMouseEnter={() => setHoveredItem(item.id)}
            onMouseLeave={() => setHoveredItem(null)}
            style={navBtnStyle(item.id)}
          >
            <Icon name={item.icon} size={16} color={activeScreen === item.id ? '#fff' : 'rgba(255,255,255,0.52)'} />
            {item.label}
          </button>
        ))}
      </nav>

      {/* Fund summary */}
      <div style={{ margin: '0 8px 10px', padding: '12px 14px', backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 5, fontFamily: 'var(--font-mono)' }}>
          HAUS FUND I
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-display)', letterSpacing: '-0.01em', lineHeight: 1.1 }}>
          $20M
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)', marginTop: 4, lineHeight: 1.4 }}>
          $14.2M deployed<br />14 companies · 2022
        </div>
      </div>

      {/* Settings */}
      <div style={{ padding: '8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={() => {}} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
          borderRadius: 6, border: 'none', cursor: 'pointer', backgroundColor: 'transparent',
          color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-body)', fontSize: 13, width: '100%', textAlign: 'left',
        }}>
          <Icon name="settings" size={15} color="rgba(255,255,255,0.35)" />
          Settings
        </button>
      </div>
    </div>
  );
}

window.Sidebar = Sidebar;
