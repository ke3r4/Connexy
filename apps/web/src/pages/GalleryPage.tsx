import { useState } from 'react';
import { tokens } from '../theme/tokens';
import { Card, Button, Badge } from '../components/ui';
import { ConfidenceChip } from '../components/ConfidenceChip';
import { MappingCanvas } from '../components/MappingCanvas';
import { DiscoveryConsole } from '../components/DiscoveryConsole';
import { EvidenceDrawer } from '../components/EvidenceDrawer';
import { SemanticModelGraph } from '../components/SemanticModelGraph';
import { LineageExplorer } from '../components/LineageExplorer';
import type { CSSProperties } from 'react';

const sampleLinks = [
  { id: '1', sourceId: 's1', sourceName: 'PLT_LINE_1.PRODUCTION_COUNT', targetId: 't1', targetName: 'ProductionCount', confidence: 0.92, status: 'proposed' as const },
  { id: '2', sourceId: 's2', sourceName: 'PLT_LINE_1.MACHINE_STATE', targetId: 't2', targetName: 'MachineState', confidence: 0.78, status: 'accepted' as const },
  { id: '3', sourceId: 's3', sourceName: 'PLT_LINE_1.BATCH_ID', targetId: 't3', targetName: 'BatchContext', confidence: 0.55, status: 'proposed' as const },
];

const sampleEvents = [
  { id: '1', stage: 'plan', type: 'completed', message: 'Intent parsed: 4 requirements', timestamp: '2026-06-24T18:50:00Z' },
  { id: '2', stage: 'ingest', type: 'completed', message: 'Ingested 4 metadata objects', timestamp: '2026-06-24T18:50:05Z' },
  { id: '3', stage: 'map', type: 'completed', message: 'Proposed 3 mappings', timestamp: '2026-06-24T18:50:10Z' },
];

const sampleEvidence = [
  { type: 'naming', sourceRef: 'PLT_LINE_1.PRODUCTION_COUNT', description: 'Name match for ProductionCount', weight: 0.7 },
  { type: 'semantic', sourceRef: 'PLT_LINE_1.PRODUCTION_COUNT', description: 'Category match: production-count', weight: 0.8 },
];

const sampleGraphNodes = [
  { id: 'e1', name: 'ProductionFact', type: 'fact' as const, x: 200, y: 100, approved: true },
  { id: 'e2', name: 'DimLine', type: 'dimension' as const, x: 80, y: 50, approved: false },
  { id: 'e3', name: 'DimShift', type: 'dimension' as const, x: 80, y: 150, approved: false },
  { id: 'e4', name: 'MissingBatch', type: 'gap' as const, x: 320, y: 100, isGap: true },
];

const sampleGraphEdges = [
  { id: 'r1', fromId: 'e1', toId: 'e2', type: 'many-to-one', approved: true },
  { id: 'r2', fromId: 'e1', toId: 'e3', type: 'many-to-one', approved: false },
];

const sampleLineageNodes = [
  { id: 's1', label: 'PLC.ProductionCount', type: 'source' as const, meta: 'INT' },
  { id: 't1', label: 'direct', type: 'transform' as const, meta: 'conf 0.92' },
  { id: 'target1', label: 'ProductionFact.Count', type: 'target' as const, meta: 'fact' },
];

const sampleLineageEdges = [
  { fromId: 's1', toId: 't1' },
  { fromId: 't1', toId: 'target1' },
];

export function GalleryPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const containerStyle: CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: tokens.spacing.xl, padding: tokens.spacing.xxl, maxWidth: '1200px', margin: '0 auto',
  };

  return (
    <div style={containerStyle}>
      <div>
        <span className="micro-label" style={{ display: 'block', marginBottom: tokens.spacing.xs }}>Living Component Gallery</span>
        <h2 style={{ fontSize: tokens.fontSize.xxl, fontWeight: tokens.fontWeight.bold, color: tokens.color.text0 }}>Connexy Design System</h2>
        <p style={{ color: tokens.color.text1, marginTop: tokens.spacing.sm }}>All signature components built from design tokens per section 5. This gallery makes the design language auditable.</p>
      </div>

      <Section title="Color System">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: tokens.spacing.sm }}>
          {[
            { name: 'bg-0', color: tokens.color.bg0 }, { name: 'bg-1', color: tokens.color.bg1 },
            { name: 'bg-2', color: tokens.color.bg2 }, { name: 'accent', color: tokens.color.accent },
            { name: 'accent-2', color: tokens.color.accent2 }, { name: 'line', color: tokens.color.line },
            { name: 'ok', color: tokens.color.ok }, { name: 'warn', color: tokens.color.warn },
            { name: 'alert', color: tokens.color.alert }, { name: 'text-0', color: tokens.color.text0 },
            { name: 'text-1', color: tokens.color.text1 }, { name: 'text-2', color: tokens.color.text2 },
          ].map(c => (
            <div key={c.name} style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.xs }}>
              <div style={{ height: '60px', borderRadius: tokens.radius.sm, backgroundColor: c.color, border: `${tokens.border.hairline} ${tokens.color.line}` }} />
              <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.xs, color: tokens.color.text2 }}>{c.name}</span>
              <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.xs, color: tokens.color.text1 }}>{c.color}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Confidence Chips">
        <div style={{ display: 'flex', gap: tokens.spacing.md, alignItems: 'center' }}>
          <ConfidenceChip score={0.95} />
          <ConfidenceChip score={0.82} />
          <ConfidenceChip score={0.71} />
          <ConfidenceChip score={0.55} />
          <ConfidenceChip score={0.30} />
        </div>
      </Section>

      <Section title="Badges">
        <div style={{ display: 'flex', gap: tokens.spacing.md, flexWrap: 'wrap' }}>
          <Badge>default</Badge>
          <Badge variant="accent">accent</Badge>
          <Badge variant="ok">ok</Badge>
          <Badge variant="warn">warn</Badge>
          <Badge variant="alert">alert</Badge>
        </div>
      </Section>

      <Section title="Buttons">
        <div style={{ display: 'flex', gap: tokens.spacing.md }}>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Mapping Canvas">
        <MappingCanvas links={sampleLinks} />
      </Section>

      <Section title="Discovery Console">
        <DiscoveryConsole events={sampleEvents} />
      </Section>

      <Section title="Semantic Model Graph">
        <SemanticModelGraph nodes={sampleGraphNodes} edges={sampleGraphEdges} />
      </Section>

      <Section title="Lineage Explorer">
        <LineageExplorer nodes={sampleLineageNodes} edges={sampleLineageEdges} />
      </Section>

      <Section title="Evidence Drawer">
        <Button variant="secondary" onClick={() => setDrawerOpen(true)}>Open Evidence Drawer</Button>
        <EvidenceDrawer open={drawerOpen} items={sampleEvidence} onClose={() => setDrawerOpen(false)} />
      </Section>

      <Section title="Typography Scale">
        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
          <span style={{ fontSize: tokens.fontSize.xxl, color: tokens.color.text0, fontWeight: tokens.fontWeight.bold }}>XXL Heading</span>
          <span style={{ fontSize: tokens.fontSize.xl, color: tokens.color.text0, fontWeight: tokens.fontWeight.semibold }}>XL Heading</span>
          <span style={{ fontSize: tokens.fontSize.lg, color: tokens.color.text0, fontWeight: tokens.fontWeight.medium }}>LG Heading</span>
          <span style={{ fontSize: tokens.fontSize.md, color: tokens.color.text0 }}>MD Body Text</span>
          <span style={{ fontSize: tokens.fontSize.sm, color: tokens.color.text1 }}>SM Secondary Text</span>
          <span style={{ fontSize: tokens.fontSize.xs, color: tokens.color.text2, textTransform: 'uppercase', letterSpacing: tokens.letterSpacing.wider }}>XS MICRO LABEL</span>
          <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.sm, color: tokens.color.accent }}>mono: PLT_LINE_1.PRODUCTION_COUNT</span>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card raised>
      <span className="micro-label" style={{ display: 'block', marginBottom: tokens.spacing.lg }}>{title}</span>
      {children}
    </Card>
  );
}