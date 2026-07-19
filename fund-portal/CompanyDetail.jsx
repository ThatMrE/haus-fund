/* Company detail screen for Haus Fund investor portal */

function CompanyDetail({ company, onBack }) {
  const { Button, Badge, Tag, StatCard } = window.HausFundDesignSystem_a048b8;
  const { Icon } = window;

  const stageVariant = { 'Pre-seed': 'default', 'Seed': 'forest', 'Series A': 'bronze', 'Series B': 'steel' };
  const accentBar = { steel: 'var(--steel-2)', forest: 'var(--forest-2)', bronze: 'var(--bronze-3)', default: 'var(--border-2)' };

  return (
    <div style={{ flex: 1, overflowY: 'auto', backgroundColor: 'var(--canvas-1)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ backgroundColor: 'var(--canvas-0)', borderBottom: '1px solid var(--border-1)', padding: '18px 32px', flexShrink: 0 }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontFamily: 'var(--font-body)', fontSize: 13, padding: 0, marginBottom: 14 }}>
          <Icon name="chevron-left" size={14} color="var(--ink-3)" /> Back to portfolio
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: 'var(--canvas-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 700, color: 'var(--ink-2)', borderLeft: `4px solid ${accentBar[company.accent]}`, flexShrink: 0 }}>
              {company.initials}
            </div>
            <div>
              <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700, color: 'var(--ink-1)', margin: '0 0 6px', lineHeight: 1 }}>{company.name}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Badge variant={stageVariant[company.stage] || 'default'}>{company.stage}</Badge>
                <Tag color="default">{company.sector}</Tag>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--ink-3)', fontSize: 12, fontFamily: 'var(--font-body)' }}>
                  <Icon name="map-pin" size={12} color="var(--ink-4)" /> {company.location}
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="outline" size="sm">
              <Icon name="external-link" size={13} color="var(--ink-2)" /> Website
            </Button>
            <Button variant="forest" size="sm">Add update</Button>
          </div>
        </div>
      </div>

      <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Investment metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <StatCard label="Invested" value={company.invested} subvalue={company.date} accent={company.accent} />
          <StatCard label="Valuation" value={company.valuation} subvalue={company.cohort} accent="default" />
          <StatCard label="Multiple" value={company.multiple} trend="up" trendValue="vs entry" accent="bronze" />
          <StatCard label="Portfolio co." value="#" subvalue="of 14 companies" accent="steel" />
        </div>

        {/* Description + metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
          <div style={{ backgroundColor: 'var(--canvas-0)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 10 }}>OVERVIEW</div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.65, margin: 0 }}>{company.description}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {company.metrics.map((m, i) => (
              <div key={i} style={{ backgroundColor: 'var(--canvas-0)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-lg)', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--ink-3)' }}>{m.label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--ink-1)' }}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Team */}
        <div style={{ backgroundColor: 'var(--canvas-0)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-lg)', padding: '20px 24px' }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 12 }}>FOUNDERS</div>
          <div style={{ display: 'flex', gap: 12 }}>
            {company.founders.split(',').map(f => f.trim()).map((founder, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', backgroundColor: 'var(--canvas-1)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-1)' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'var(--forest-5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700, color: 'var(--forest-2)' }}>
                  {founder.split(' ').filter(w => !w.includes('.')).map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, color: 'var(--ink-1)' }}>{founder}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

window.CompanyDetail = CompanyDetail;
