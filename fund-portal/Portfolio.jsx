/* Portfolio list screen — all portfolio companies */

function Portfolio({ onSelectCompany }) {
  const { Badge, Tag } = window.HausFundDesignSystem_a048b8;
  const { Icon } = window;
  const companies = window.PORTFOLIO_COMPANIES || [];

  const [query, setQuery] = React.useState('');
  const [sectorFilter, setSectorFilter] = React.useState('All');

  const sectors = ['All', ...Array.from(new Set(companies.map(c => c.sector)))];
  const filtered = companies.filter(c =>
    (sectorFilter === 'All' || c.sector === sectorFilter) &&
    (query === '' || c.name.toLowerCase().includes(query.toLowerCase()) || c.sector.toLowerCase().includes(query.toLowerCase()))
  );

  const stageVariant = { 'Pre-seed': 'default', 'Seed': 'forest', 'Series A': 'bronze', 'Series B': 'steel' };
  const accentBar = { steel: 'var(--steel-2)', forest: 'var(--forest-2)', bronze: 'var(--bronze-3)', default: 'var(--border-2)' };

  return (
    <div style={{ flex: 1, overflowY: 'auto', backgroundColor: 'var(--canvas-1)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ backgroundColor: 'var(--canvas-0)', borderBottom: '1px solid var(--border-1)', padding: '18px 32px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700, color: 'var(--ink-1)', margin: 0 }}>Portfolio</h1>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)' }}>{filtered.length} companies</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: 'var(--canvas-1)', border: '1px solid var(--border-2)', borderRadius: 'var(--radius-md)', padding: '0 12px', height: 36, flex: 1, maxWidth: 300 }}>
            <Icon name="search" size={14} color="var(--ink-4)" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search companies…"
              style={{ border: 'none', outline: 'none', backgroundColor: 'transparent', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--ink-1)', width: '100%' }}
            />
          </div>
          {/* Sector filter */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {sectors.map(s => (
              <button key={s} onClick={() => setSectorFilter(s)} style={{
                padding: '4px 10px', borderRadius: 'var(--radius-sm)', border: `1px solid ${sectorFilter === s ? 'var(--forest-2)' : 'var(--border-2)'}`,
                backgroundColor: sectorFilter === s ? 'var(--forest-5)' : 'transparent',
                color: sectorFilter === s ? 'var(--forest-2)' : 'var(--ink-3)',
                fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}>{s}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ padding: '20px 32px' }}>
        <div style={{ backgroundColor: 'var(--canvas-0)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 0, padding: '10px 18px', borderBottom: '1px solid var(--border-1)', backgroundColor: 'var(--canvas-1)' }}>
            {['Company', 'Sector', 'Stage', 'Invested', 'Date'].map(h => (
              <div key={h} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-4)' }}>{h}</div>
            ))}
          </div>
          {/* Rows */}
          {filtered.map((co, i) => <PortfolioRow key={co.id} company={co} onClick={() => onSelectCompany(co)} isLast={i === filtered.length - 1} accentBar={accentBar} stageVariant={stageVariant} />)}
        </div>
      </div>
    </div>
  );
}

function PortfolioRow({ company, onClick, isLast, accentBar, stageVariant }) {
  const { Badge } = window.HausFundDesignSystem_a048b8;
  const [hov, setHov] = React.useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 0, padding: '13px 18px', borderBottom: isLast ? 'none' : '1px solid var(--border-1)', cursor: 'pointer', backgroundColor: hov ? 'var(--canvas-1)' : 'transparent', transition: 'background-color 100ms', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <div style={{ width: 30, height: 30, borderRadius: 6, backgroundColor: 'var(--canvas-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 700, color: 'var(--ink-2)', borderLeft: `3px solid ${accentBar[company.accent]}`, flexShrink: 0 }}>{company.initials}</div>
        <div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--ink-1)' }}>{company.name}</div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--ink-4)' }}>{company.cohort}</div>
        </div>
      </div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--ink-3)' }}>{company.sector}</div>
      <div><Badge variant={stageVariant[company.stage] || 'default'} size="sm">{company.stage}</Badge></div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--ink-1)' }}>{company.invested}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-4)' }}>{company.date}</div>
    </div>
  );
}

window.Portfolio = Portfolio;
