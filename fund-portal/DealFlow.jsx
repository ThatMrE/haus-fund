/* Deal flow pipeline screen for Haus Fund investor portal */

function DealFlow() {
  const { Badge, Button } = window.HausFundDesignSystem_a048b8;
  const { Icon } = window;
  const deals = window.DEAL_FLOW || [];

  const stages = [
    { id: 'submitted',  label: 'Submitted',      color: 'var(--ink-4)',    bgColor: 'var(--canvas-2)' },
    { id: 'screening',  label: 'Screening',       color: 'var(--steel-2)',  bgColor: 'var(--steel-5)' },
    { id: 'diligence',  label: 'Due Diligence',   color: 'var(--bronze-1)', bgColor: 'var(--bronze-5)' },
    { id: 'term-sheet', label: 'Term Sheet',      color: 'var(--forest-2)', bgColor: 'var(--forest-5)' },
  ];

  const dealsByStage = stages.reduce((acc, s) => {
    acc[s.id] = deals.filter(d => d.stage === s.id);
    return acc;
  }, {});

  return (
    <div style={{ flex: 1, overflowY: 'auto', backgroundColor: 'var(--canvas-1)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ backgroundColor: 'var(--canvas-0)', borderBottom: '1px solid var(--border-1)', padding: '18px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 3, fontFamily: 'var(--font-mono)' }}>COHORT 3 · OPEN</div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700, color: 'var(--ink-1)', margin: 0 }}>Deal Flow</h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="outline" size="sm"><Icon name="filter" size={13} color="var(--ink-2)" /> Filter</Button>
          <Button variant="forest" size="sm"><Icon name="plus" size={13} color="#fff" /> Add deal</Button>
        </div>
      </div>

      {/* Pipeline */}
      <div style={{ padding: '24px 32px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, flex: 1 }}>
        {stages.map(stage => (
          <div key={stage.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Column header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: stage.bgColor, borderRadius: 'var(--radius-sm)', border: `1px solid ${stage.color}22` }}>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: stage.color }}>{stage.label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: stage.color, opacity: 0.7 }}>{dealsByStage[stage.id].length}</div>
            </div>

            {/* Deal cards */}
            {dealsByStage[stage.id].map(deal => <DealCard key={deal.id} deal={deal} stageColor={stage.color} />)}

            {/* Add */}
            <button style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border-2)', backgroundColor: 'transparent', cursor: 'pointer', color: 'var(--ink-4)', fontFamily: 'var(--font-body)', fontSize: 12 }}>
              <Icon name="plus" size={12} color="var(--ink-4)" /> Add
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function DealCard({ deal, stageColor }) {
  const [hov, setHov] = React.useState(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{
      backgroundColor: 'var(--canvas-0)', border: '1px solid var(--border-1)', borderRadius: 'var(--radius-md)',
      padding: '12px 14px', cursor: 'pointer',
      boxShadow: hov ? 'var(--shadow-sm)' : 'var(--shadow-xs)',
      transform: hov ? 'translateY(-1px)' : 'none',
      transition: 'box-shadow 120ms, transform 120ms',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--ink-1)' }}>{deal.name}</div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'var(--ink-3)' }}>{deal.sector}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)' }}>{deal.date}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: 'var(--canvas-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-body)', fontSize: 9, fontWeight: 700, color: 'var(--ink-3)' }}>
            {deal.lead.split(' ').map(w => w[0]).join('')}
          </div>
        </div>
      </div>
    </div>
  );
}

window.DealFlow = DealFlow;
