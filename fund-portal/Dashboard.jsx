/* Dashboard screen — fund overview for Haus Fund investor portal */

function Dashboard({ onSelectCompany, onNavigate }) {
  const { Button, StatCard, Badge } = window.HausFundDesignSystem_a048b8;
  const { Icon } = window;
  const companies = (window.PORTFOLIO_COMPANIES || []).slice(0, 4);
  const activity = window.ACTIVITY || [];

  const accentVariants = { steel: 'steel', forest: 'forest', bronze: 'bronze', default: 'default' };

  return (
    <div style={{ flex: 1, overflowY: 'auto', backgroundColor: 'var(--canvas-1)', display: 'flex', flexDirection: 'column' }}>
      {/* Page header */}
      <div style={{ backgroundColor: 'var(--canvas-0)', borderBottom: '1px solid var(--border-1)', padding: '18px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 3, fontFamily: 'var(--font-mono)' }}>HAUS FUND I — VINTAGE 2022</div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700, color: 'var(--ink-1)', margin: 0, lineHeight: 1 }}>Dashboard</h1>
        </div>
        <Button variant="forest" size="sm" onClick={() => onNavigate('deal-flow')}>
          <Icon name="plus" size={13} color="#fff" /> New deal
        </Button>
      </div>

      <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 32 }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <StatCard label="Fund Size" value="$20M" subvalue="Vintage 2022" accent="forest" />
          <StatCard label="Deployed" value="$14.2M" trend="up" trendValue="+$1.8M QoQ" accent="bronze" />
          <StatCard label="Reserve" value="$5.8M" subvalue="29% remaining" accent="steel" />
          <StatCard label="Portfolio" value="14" subvalue="Across 4 sectors" accent="default" />
        </div>

        {/* Recent investments */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 17, fontWeight: 600, color: 'var(--ink-1)', margin: 0 }}>Recent investments</h2>
            <button onClick={() => onNavigate('portfolio')} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--forest-2)', fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: 500 }}>
              View all <Icon name="arrow-right" size={13} color="var(--forest-2)" />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {companies.map(co => <MiniCompanyCard key={co.id} company={co} onClick={() => onSelectCompany(co)} />)}
          </div>
        </div>

        {/* Activity */}
        <div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 17, fontWeight: 600, color: 'var(--ink-1)', margin: '0 0 14px' }}>Activity</h2>
          <div style={{ backgroundColor: 'var(--canvas-0)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-lg)' }}>
            {activity.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', borderBottom: i < activity.length - 1 ? '1px solid var(--border-1)' : 'none' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', backgroundColor: 'var(--canvas-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name={item.icon} size={13} color={item.color} />
                </div>
                <div style={{ flex: 1, fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.4 }}>{item.text}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)', whiteSpace: 'nowrap' }}>{item.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniCompanyCard({ company, onClick }) {
  const { Badge } = window.HausFundDesignSystem_a048b8;
  const [hov, setHov] = React.useState(false);
  const accentBar = { steel: 'var(--steel-2)', forest: 'var(--forest-2)', bronze: 'var(--bronze-3)', default: 'var(--border-2)' };
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{
      backgroundColor: 'var(--canvas-0)', border: '1px solid var(--border-1)',
      borderTop: `3px solid ${accentBar[company.accent]}`,
      borderRadius: 'var(--radius-lg)', padding: '14px 16px', cursor: 'pointer',
      boxShadow: hov ? 'var(--shadow-md)' : 'var(--shadow-xs)',
      transform: hov ? 'translateY(-1px)' : 'none',
      transition: 'box-shadow 150ms, transform 150ms',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: 'var(--canvas-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700, color: 'var(--ink-2)' }}>{company.initials}</div>
        <Badge variant="forest" size="sm">{company.stage}</Badge>
      </div>
      <div>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 600, color: 'var(--ink-1)', marginBottom: 2 }}>{company.name}</div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.4 }}>{company.tagline}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--ink-1)' }}>{company.invested}</div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-4)' }}>{company.date}</div>
      </div>
    </div>
  );
}

window.Dashboard = Dashboard;
