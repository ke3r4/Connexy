import { useState, useEffect, useCallback } from 'react';
import { tokens } from '../theme/tokens';
import { Card, Button, Badge } from '../components/ui';
import { ConfidenceChip } from '../components/ConfidenceChip.js';
import { EvidenceDrawer } from '../components/EvidenceDrawer.js';
import { SemanticModelGraph } from '../components/SemanticModelGraph.js';
import { LineageExplorer } from '../components/LineageExplorer.js';
import { api } from '../api/client.js';
import { useAppStore } from '../store/app-store.js';
import type { CSSProperties } from 'react';
import type { Mapping, Gap, SemanticModel, Evidence } from '../api/types.js';
import type { GraphNode, GraphEdge } from '../components/SemanticModelGraph.js';
import type { LineageNode, LineageEdge } from '../components/LineageExplorer.js';

type Tab = 'mappings' | 'gaps' | 'models';

export function ReviewPage({ projectId }: { projectId: string }) {
  const navigate = useAppStore((s) => s.navigate);
  const [tab, setTab] = useState<Tab>('mappings');
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [models, setModels] = useState<SemanticModel[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedMappings, setSelectedMappings] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [mappingsRes, gapsRes, modelsRes] = await Promise.all([
        api.listMappings(projectId),
        api.listGaps(projectId),
        api.listModels(projectId),
      ]);
      setMappings(mappingsRes.mappings || []);
      setGaps(gapsRes.gaps || []);
      setModels(modelsRes.models || []);
    } catch (err) {
      console.error('Failed to load review data:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadData(); }, [loadData]);

  const pendingMappings = mappings.filter(m => m.status === 'proposed');
  const acceptedMappings = mappings.filter(m => m.status === 'accepted');
  const rejectedMappings = mappings.filter(m => m.status === 'rejected');

  const handleAccept = async (id: string) => {
    await api.acceptMapping(id);
    loadData();
  };

  const handleReject = async (id: string) => {
    await api.rejectMapping(id);
    loadData();
  };

  const handleBulkAccept = async () => {
    if (selectedMappings.size === 0) return;
    await api.bulkAccept(projectId, Array.from(selectedMappings));
    setSelectedMappings(new Set());
    loadData();
  };

  const handleCompleteReview = async () => {
    await api.completeReview(projectId);
    navigate({ name: 'export', projectId });
  };

  const showEvidence = (evidence: Evidence[]) => {
    setSelectedEvidence(evidence);
    setDrawerOpen(true);
  };

  const toggleSelect = (id: string) => {
    setSelectedMappings(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacing.lg,
    padding: tokens.spacing.xl,
  };

  const tabStyle = (active: boolean): CSSProperties => ({
    padding: `${tokens.spacing.sm} ${tokens.spacing.lg}`,
    borderBottom: active ? `2px solid ${tokens.color.accent}` : '2px solid transparent',
    color: active ? tokens.color.accent : tokens.color.text1,
    cursor: 'pointer',
    fontSize: tokens.fontSize.sm,
    fontWeight: tokens.fontWeight.medium,
    textTransform: 'uppercase',
    letterSpacing: tokens.letterSpacing.wide,
    transition: `all ${tokens.transition.fast} ${tokens.transition.ease}`,
  });

  const mappingRowStyle = (selected: boolean): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing.md,
    padding: tokens.spacing.md,
    border: `${tokens.border.hairline} ${selected ? tokens.color.accent : tokens.color.line}`,
    borderRadius: tokens.radius.sm,
    backgroundColor: selected ? `${tokens.color.accent}0A` : 'transparent',
    transition: `border-color ${tokens.transition.fast} ${tokens.transition.ease}`,
  });

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span className="micro-label" style={{ display: 'block', marginBottom: tokens.spacing.xs }}>Review Workspace</span>
          <h2 style={{ fontSize: tokens.fontSize.xl, fontWeight: tokens.fontWeight.semibold, color: tokens.color.text0 }}>
            Approve Recommendations
          </h2>
          <p style={{ color: tokens.color.text1, marginTop: tokens.spacing.xs, fontSize: tokens.fontSize.sm }}>
            Every AI recommendation is a proposal. Accept, edit, or reject each item.
          </p>
        </div>
        <div style={{ display: 'flex', gap: tokens.spacing.sm }}>
          <Button variant="secondary" onClick={() => navigate({ name: 'discovery', projectId })}>← Back to Pipeline</Button>
          <Button variant="primary" onClick={handleCompleteReview} disabled={pendingMappings.length > 0}>
            Complete Review → Export
          </Button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: tokens.spacing.lg }}>
        <Card style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: tokens.spacing.lg, borderBottom: `${tokens.border.hairline} ${tokens.color.line}` }}>
            <button style={tabStyle(tab === 'mappings')} onClick={() => setTab('mappings')}>
              Mappings <Badge variant={pendingMappings.length > 0 ? 'warn' : 'ok'}>{pendingMappings.length}</Badge>
            </button>
            <button style={tabStyle(tab === 'gaps')} onClick={() => setTab('gaps')}>
              Gaps <Badge variant={gaps.filter(g => g.status === 'open').length > 0 ? 'alert' : 'ok'}>{gaps.filter(g => g.status === 'open').length}</Badge>
            </button>
            <button style={tabStyle(tab === 'models')} onClick={() => setTab('models')}>
              Models <Badge variant={models.length > 0 ? 'accent' : 'default'}>{models.length}</Badge>
            </button>
          </div>

          <div style={{ padding: `${tokens.spacing.lg} 0` }}>
            {loading ? (
              <div style={{ color: tokens.color.text2, padding: tokens.spacing.xl, textAlign: 'center' }}>Loading...</div>
            ) : tab === 'mappings' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
                {pendingMappings.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: `${tokens.spacing.sm} 0` }}>
                    <span style={{ color: tokens.color.text1, fontSize: tokens.fontSize.sm }}>
                      {selectedMappings.size} selected
                    </span>
                    <Button variant="secondary" onClick={handleBulkAccept} disabled={selectedMappings.size === 0}>
                      Bulk Accept ({selectedMappings.size})
                    </Button>
                  </div>
                )}
                {pendingMappings.length === 0 && acceptedMappings.length === 0 && rejectedMappings.length === 0 ? (
                  <EmptyState message="No mappings yet. Run the discovery pipeline first." />
                ) : (
                  <>
                    {pendingMappings.length > 0 && (
                      <SectionLabel label="Pending Review" count={pendingMappings.length} />
                    )}
                    {pendingMappings.map(m => (
                      <MappingRow
                        key={m.id}
                        mapping={m}
                        selected={selectedMappings.has(m.id)}
                        onToggle={() => toggleSelect(m.id)}
                        onAccept={() => handleAccept(m.id)}
                        onReject={() => handleReject(m.id)}
                        onEvidence={() => showEvidence(m.evidence || [])}
                      />
                    ))}
                    {acceptedMappings.length > 0 && (
                      <SectionLabel label="Accepted" count={acceptedMappings.length} />
                    )}
                    {acceptedMappings.map(m => (
                      <MappingRow key={m.id} mapping={m} onEvidence={() => showEvidence(m.evidence || [])} />
                    ))}
                    {rejectedMappings.length > 0 && (
                      <SectionLabel label="Rejected" count={rejectedMappings.length} />
                    )}
                    {rejectedMappings.map(m => (
                      <MappingRow key={m.id} mapping={m} onEvidence={() => showEvidence(m.evidence || [])} />
                    ))}
                  </>
                )}
              </div>
            ) : tab === 'gaps' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
                {gaps.length === 0 ? (
                  <EmptyState message="No gaps detected." />
                ) : (
                  gaps.map(g => (
                    <GapRow key={g.id} gap={g} onEvidence={() => showEvidence(g.evidence || [])} onAcknowledge={() => api.acknowledgeGap(g.id).then(loadData)} onResolve={() => api.resolveGap(g.id).then(loadData)} />
                  ))
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.lg }}>
                {models.length === 0 ? (
                  <EmptyState message="No semantic models generated yet." />
                ) : (
                  <>
                    {models.map(m => <ModelRow key={m.id} model={m} onApprove={() => api.approveModel(m.id).then(loadData)} onPublish={() => api.publishModel(m.id).then(loadData)} />)}
                    {models[0] && (
                      <>
                        <div style={{ marginTop: tokens.spacing.md }}>
                          <span className="micro-label" style={{ display: 'block', marginBottom: tokens.spacing.sm }}>Semantic Model Graph</span>
                          <SemanticModelGraph
                            nodes={buildGraphNodes(models[0])}
                            edges={buildGraphEdges(models[0])}
                          />
                        </div>
                        <div style={{ marginTop: tokens.spacing.md }}>
                          <span className="micro-label" style={{ display: 'block', marginBottom: tokens.spacing.sm }}>Lineage Explorer</span>
                          <LineageExplorer
                            nodes={buildLineageNodes(models[0], mappings)}
                            edges={buildLineageEdges(models[0])}
                          />
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      <EvidenceDrawer open={drawerOpen} items={selectedEvidence} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}

function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.sm, padding: `${tokens.spacing.sm} 0` }}>
      <span className="micro-label">{label}</span>
      <span style={{ color: tokens.color.text2, fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.xs }}>({count})</span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{
      padding: tokens.spacing.xxl,
      textAlign: 'center',
      color: tokens.color.text2,
      fontStyle: 'italic',
      fontSize: tokens.fontSize.sm,
    }}>
      {message}
    </div>
  );
}

function MappingRow({ mapping, selected, onToggle, onAccept, onReject, onEvidence }: {
  mapping: Mapping;
  selected?: boolean;
  onToggle?: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  onEvidence: () => void;
}) {
  const rowStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacing.md,
    padding: tokens.spacing.md,
    border: `${tokens.border.hairline} ${selected ? tokens.color.accent : tokens.color.line}`,
    borderRadius: tokens.radius.sm,
    backgroundColor: selected ? `${tokens.color.accent}0A` : 'transparent',
  };
  const statusColors: Record<string, string> = {
    proposed: tokens.color.warn,
    accepted: tokens.color.ok,
    rejected: tokens.color.alert,
    modified: tokens.color.accent,
  };
  return (
    <div style={rowStyle}>
      {onToggle && mapping.status === 'proposed' && (
        <input type="checkbox" checked={selected || false} onChange={onToggle} style={{ accentColor: tokens.color.accent }} />
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: tokens.spacing.xs }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.md }}>
          <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.sm, color: tokens.color.text0 }}>
            {mapping.source_object_id.substring(0, 8)}...
          </span>
          <span style={{ color: tokens.color.text2 }}>→</span>
          <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.sm, color: tokens.color.accent2 }}>
            {mapping.target_object_id.substring(0, 8)}...
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.sm }}>
          <ConfidenceChip score={mapping.confidence} />
          <Badge variant="default" >{mapping.status}</Badge>
          <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.xs, color: tokens.color.text2 }}>
            by {mapping.proposed_by}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: tokens.spacing.xs }}>
        <Button variant="ghost" onClick={onEvidence}>Evidence</Button>
        {mapping.status === 'proposed' && onAccept && (
          <>
            <Button variant="secondary" onClick={onAccept}>Accept</Button>
            <Button variant="ghost" onClick={onReject}>Reject</Button>
          </>
        )}
      </div>
    </div>
  );
}

function GapRow({ gap, onEvidence, onAcknowledge, onResolve }: {
  gap: Gap;
  onEvidence: () => void;
  onAcknowledge: () => void;
  onResolve: () => void;
}) {
  const severityColors: Record<string, string> = {
    critical: tokens.color.alert,
    high: tokens.color.alert,
    medium: tokens.color.warn,
    low: tokens.color.text1,
  };
  const color = severityColors[gap.severity] || tokens.color.text1;
  return (
    <div style={{
      padding: tokens.spacing.md,
      border: `1px dashed ${color}40`,
      borderRadius: tokens.radius.sm,
      backgroundColor: `${color}0A`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: tokens.spacing.xs }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.sm }}>
          <span style={{ color, fontWeight: tokens.fontWeight.medium, fontSize: tokens.fontSize.sm }}>{gap.type}</span>
          <Badge variant={gap.severity === 'critical' || gap.severity === 'high' ? 'alert' : gap.severity === 'medium' ? 'warn' : 'default'}>
            {gap.severity}
          </Badge>
          <ConfidenceChip score={gap.confidence} />
        </div>
        <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.xs, color: tokens.color.text2 }}>{gap.status}</span>
      </div>
      <p style={{ color: tokens.color.text1, fontSize: tokens.fontSize.sm, marginBottom: tokens.spacing.sm }}>{gap.description}</p>
      {gap.recommendation && (
        <p style={{ color: tokens.color.accent, fontSize: tokens.fontSize.xs, marginBottom: tokens.spacing.sm }}>→ {gap.recommendation}</p>
      )}
      <div style={{ display: 'flex', gap: tokens.spacing.xs }}>
        <Button variant="ghost" onClick={onEvidence}>Evidence</Button>
        {gap.status === 'open' && <Button variant="secondary" onClick={onAcknowledge}>Acknowledge</Button>}
        {gap.status !== 'resolved' && <Button variant="secondary" onClick={onResolve}>Resolve</Button>}
      </div>
    </div>
  );
}

function ModelRow({ model, onApprove, onPublish }: { model: SemanticModel; onApprove: () => void; onPublish: () => void }) {
  return (
    <div style={{
      padding: tokens.spacing.md,
      border: `${tokens.border.hairline} ${tokens.color.line}`,
      borderRadius: tokens.radius.sm,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: tokens.spacing.sm }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.sm }}>
          <span style={{ fontWeight: tokens.fontWeight.semibold, color: tokens.color.text0, fontSize: tokens.fontSize.md }}>{model.name}</span>
          <Badge variant="accent">v{model.version}</Badge>
          <Badge variant={model.status === 'approved' ? 'ok' : model.status === 'published' ? 'ok' : 'default'}>{model.status}</Badge>
        </div>
        <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.xs, color: tokens.color.text2 }}>
          {model.entities?.length || 0} entities
        </span>
      </div>
      <div style={{ display: 'flex', gap: tokens.spacing.xs }}>
        {model.status === 'draft' && <Button variant="secondary" onClick={onApprove}>Approve</Button>}
        {model.status === 'approved' && <Button variant="primary" onClick={onPublish}>Publish</Button>}
      </div>
    </div>
  );
}

function buildGraphNodes(model: SemanticModel): GraphNode[] {
  const entities = model.entities || [];
  const cols = Math.ceil(Math.sqrt(entities.length));
  return entities.map((e, i) => ({
    id: e.id,
    name: e.name,
    type: e.type as GraphNode['type'],
    x: 100 + (i % cols) * 160,
    y: 80 + Math.floor(i / cols) * 100,
    approved: model.status === 'approved' || model.status === 'published',
  }));
}

function buildGraphEdges(model: SemanticModel): GraphEdge[] {
  return (model.relationships || []).map(r => ({
    id: r.id,
    fromId: r.fromEntityId,
    toId: r.toEntityId,
    type: r.type,
    approved: model.status === 'approved' || model.status === 'published',
  }));
}

function buildLineageNodes(model: SemanticModel, mappings: Mapping[]): LineageNode[] {
  const sources: LineageNode[] = [];
  const transforms: LineageNode[] = [];
  const targets: LineageNode[] = [];

  for (const e of model.entities || []) {
    targets.push({
      id: e.id,
      label: e.name,
      type: 'target',
      meta: e.type,
    });
  }

  for (const m of mappings) {
    if (m.transformation) {
      transforms.push({
        id: m.id,
        label: (m.transformation as Record<string, string>).type || 'transform',
        type: 'transform',
        meta: `conf ${m.confidence.toFixed(2)}`,
      });
    }
  }

  for (const m of mappings.slice(0, 6)) {
    sources.push({
      id: m.source_object_id,
      label: m.source_object_id.substring(0, 12) + '...',
      type: 'source',
      meta: undefined,
    });
  }

  return [...sources, ...transforms, ...targets];
}

function buildLineageEdges(model: SemanticModel): LineageEdge[] {
  return (model.relationships || []).slice(0, 5).map(r => ({
    fromId: r.fromEntityId,
    toId: r.toEntityId,
    label: r.type,
  }));
}