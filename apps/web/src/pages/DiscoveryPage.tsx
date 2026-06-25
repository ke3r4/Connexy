import { useState, useEffect, useCallback } from 'react';
import { tokens } from '../theme/tokens';
import { Card, Button, Badge } from '../components/ui';
import { DiscoveryConsole } from '../components/DiscoveryConsole.js';
import { api } from '../api/client.js';
import { useAppStore } from '../store/app-store.js';
import type { CSSProperties } from 'react';
import type { WorkflowEvent, WorkflowState } from '../api/types.js';

const STAGES = ['plan', 'ingest', 'classify', 'map', 'model', 'score', 'review', 'export'] as const;

export function DiscoveryPage({ projectId }: { projectId: string }) {
  const navigate = useAppStore((s) => s.navigate);
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null);
  const [polling, setPolling] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchState = useCallback(async () => {
    try {
      const state = await api.getWorkflowState(projectId);
      setWorkflowState(state);
      setEvents(state.events || []);
      if (state.completedAt || state.error) {
        setPolling(false);
      }
      if (state.currentStage === 'review' && state.stages['review']?.status === 'completed') {
        setPolling(false);
      }
    } catch {
      // Workflow might not have started yet
    }
  }, [projectId]);

  const fetchEvents = useCallback(async () => {
    try {
      const result = await api.getWorkflowEvents(projectId);
      setEvents(result.events || []);
    } catch {
      // Ignore
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    fetchState().finally(() => setLoading(false));
  }, [fetchState]);

  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(() => {
      fetchEvents();
      fetchState();
    }, 2000);
    return () => clearInterval(interval);
  }, [polling, fetchEvents, fetchState]);

  const startWorkflow = async () => {
    try {
      await api.runProject(projectId);
      setPolling(true);
      fetchState();
    } catch (err) {
      console.error('Failed to start workflow:', err);
    }
  };

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacing.lg,
    padding: tokens.spacing.xl,
  };

  const stageBarStyle: CSSProperties = {
    display: 'flex',
    gap: tokens.spacing.xs,
    padding: `${tokens.spacing.md} 0`,
  };

  const stageStyle = (stageName: string): CSSProperties => {
    const stage = workflowState?.stages?.[stageName];
    const isCurrent = workflowState?.currentStage === stageName;
    let color = tokens.color.text2;
    let bg = 'transparent';
    let borderColor = tokens.color.line;
    if (stage?.status === 'completed') { color = tokens.color.ok; bg = `${tokens.color.ok}12`; borderColor = `${tokens.color.ok}40`; }
    else if (stage?.status === 'running') { color = tokens.color.accent; bg = `${tokens.color.accent}12`; borderColor = `${tokens.color.accent}40`; }
    else if (stage?.status === 'failed') { color = tokens.color.alert; bg = `${tokens.color.alert}12`; borderColor = `${tokens.color.alert}40`; }
    return {
      flex: 1,
      padding: `${tokens.spacing.sm} ${tokens.spacing.md}`,
      borderRadius: tokens.radius.sm,
      border: `${tokens.border.hairline} ${borderColor}`,
      backgroundColor: bg,
      color,
      fontFamily: tokens.fontFamily.mono,
      fontSize: tokens.fontSize.xs,
      textTransform: 'uppercase',
      letterSpacing: tokens.letterSpacing.wide,
      textAlign: 'center',
      fontWeight: tokens.fontWeight.medium,
      position: 'relative',
      boxShadow: isCurrent ? `0 0 0 1px ${tokens.color.accent}` : 'none',
    };
  };

  const isCompleted = workflowState?.completedAt != null;
  const isReview = workflowState?.currentStage === 'review' && !polling;

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span className="micro-label" style={{ display: 'block', marginBottom: tokens.spacing.xs }}>Discovery Pipeline</span>
          <h2 style={{ fontSize: tokens.fontSize.xl, fontWeight: tokens.fontWeight.semibold, color: tokens.color.text0 }}>
            {isCompleted ? 'Pipeline Complete' : isReview ? 'Ready for Review' : loading ? 'Loading...' : 'Pipeline Running'}
          </h2>
        </div>
        <div style={{ display: 'flex', gap: tokens.spacing.sm }}>
          {!polling && !isCompleted && !isReview && (
            <Button variant="primary" onClick={startWorkflow}>Start Discovery</Button>
          )}
          {isReview && (
            <Button variant="primary" onClick={() => navigate({ name: 'review', projectId })}>
              Go to Review →
            </Button>
          )}
          {polling && (
            <Button variant="ghost" onClick={() => { api.cancelWorkflow(projectId); setPolling(false); }}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      <Card>
        <div style={stageBarStyle}>
          {STAGES.map((stage) => (
            <div key={stage} style={stageStyle(stage)}>
              {stage}
              {workflowState?.stages?.[stage]?.status === 'running' && (
                <span style={{ marginLeft: tokens.spacing.xs, animation: 'pulse 1.5s infinite' }}>.</span>
              )}
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: tokens.spacing.lg }}>
        <Card raised>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: tokens.spacing.md }}>
            <span className="micro-label">Discovery Console</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.sm }}>
              {polling ? (
                <Badge variant="accent">
                  <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: tokens.color.accent, display: 'inline-block', marginRight: tokens.spacing.xs, animation: 'pulse 1s infinite' }} />
                  LIVE
                </Badge>
              ) : (
                <Badge variant={isCompleted ? 'ok' : 'default'}>{isCompleted ? 'DONE' : 'IDLE'}</Badge>
              )}
            </div>
          </div>
          <DiscoveryConsole events={events} />
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.lg }}>
          <Card>
            <span className="micro-label" style={{ display: 'block', marginBottom: tokens.spacing.md }}>Stage Output</span>
            {workflowState?.stages && Object.entries(workflowState.stages).map(([stage, state]) => (
              <div key={stage} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: `${tokens.spacing.sm} 0`,
                borderBottom: `1px solid ${tokens.color.line}40`,
                fontFamily: tokens.fontFamily.mono,
                fontSize: tokens.fontSize.xs,
              }}>
                <span style={{ color: tokens.color.text1, textTransform: 'uppercase' }}>{stage}</span>
                <span style={{
                  color: state.status === 'completed' ? tokens.color.ok : state.status === 'running' ? tokens.color.accent : state.status === 'failed' ? tokens.color.alert : tokens.color.text2,
                }}>
                  {state.status}
                </span>
              </div>
            ))}
            {!workflowState?.stages && (
              <div style={{ color: tokens.color.text2, fontSize: tokens.fontSize.sm, fontStyle: 'italic' }}>
                No stages yet. Start the pipeline.
              </div>
            )}
          </Card>

          <Card>
            <span className="micro-label" style={{ display: 'block', marginBottom: tokens.spacing.md }}>Pipeline Stats</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.sm }}>
              <StatRow label="Events" value={String(events.length)} />
              <StatRow label="Started" value={workflowState?.startedAt ? new Date(workflowState.startedAt).toLocaleTimeString() : '--'} />
              <StatRow label="Current" value={workflowState?.currentStage || '--'} mono />
              <StatRow label="Errors" value={events.filter(e => e.type === 'failed').length.toString()} alert={events.some(e => e.type === 'failed')} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, mono, alert }: { label: string; value: string; mono?: boolean; alert?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: tokens.color.text2, fontSize: tokens.fontSize.xs, textTransform: 'uppercase', letterSpacing: tokens.letterSpacing.wide }}>{label}</span>
      <span style={{
        color: alert ? tokens.color.alert : tokens.color.text0,
        fontFamily: mono ? tokens.fontFamily.mono : tokens.fontFamily.sans,
        fontSize: tokens.fontSize.sm,
        fontWeight: tokens.fontWeight.medium,
      }}>
        {value}
      </span>
    </div>
  );
}