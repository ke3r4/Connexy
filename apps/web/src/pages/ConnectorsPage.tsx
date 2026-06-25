import { useState, useEffect, useCallback } from 'react';
import { tokens } from '../theme/tokens';
import { Card, Button, Badge } from '../components/ui';
import { api } from '../api/client.js';
import { useAppStore } from '../store/app-store.js';
import type { CSSProperties } from 'react';
import type { Connector, MetadataObject } from '../api/types.js';

const CONNECTOR_TYPES = [
  { type: 'metadata-file', name: 'Metadata File (PLC tags, specs)', tier: 'file' },
  { type: 'sap-erp', name: 'SAP ERP / S/4HANA', tier: 'erp' },
  { type: 'siemens-opcenter', name: 'Siemens Opcenter (MES)', tier: 'mes' },
  { type: 'rockwell-factorytalk', name: 'Rockwell FactoryTalk (MES)', tier: 'mes' },
  { type: 'werum-pasx', name: 'Werum PAS-X (MES)', tier: 'mes' },
  { type: 'tulip', name: 'Tulip (MES)', tier: 'mes' },
  { type: 'sepasoft', name: 'Sepasoft (MES for Ignition)', tier: 'mes' },
  { type: 'aveva-pi', name: 'AVEVA PI System (Historian)', tier: 'historian' },
  { type: 'aveva-wonderware', name: 'AVEVA Wonderware (Historian)', tier: 'historian' },
  { type: 'ignition', name: 'Inductive Automation Ignition (SCADA)', tier: 'scada' },
  { type: 'opc-ua', name: 'OPC UA (Machine Interface)', tier: 'machine' },
  { type: 'plc-tags', name: 'PLC Tag Export', tier: 'machine' },
];

export function ConnectorsPage({ projectId }: { projectId: string }) {
  const navigate = useAppStore((s) => s.navigate);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [metadataObjects, setMetadataObjects] = useState<Record<string, MetadataObject[]>>({});
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.listConnectors(projectId);
      setConnectors(result.connectors || []);
      for (const c of result.connectors || []) {
        try {
          const meta = await api.getConnectorMetadata(c.id);
          setMetadataObjects(prev => ({ ...prev, [c.id]: meta.objects || [] }));
        } catch { /* ignore */ }
      }
    } catch {
      setConnectors([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const addConnector = async (type: string, name: string) => {
    await api.createConnector({
      projectId,
      type,
      name,
      config: { readOnlyAssertion: true, testScan: true },
    });
    setShowAdd(false);
    load();
  };

  const runDiscovery = async () => {
    try {
      await api.runProject(projectId);
      navigate({ name: 'discovery', projectId });
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

  const tierColors: Record<string, string> = {
    erp: tokens.color.accent,
    mes: tokens.color.accent2,
    historian: tokens.color.warn,
    file: tokens.color.text1,
  };

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span className="micro-label" style={{ display: 'block', marginBottom: tokens.spacing.xs }}>Data Sources</span>
          <h2 style={{ fontSize: tokens.fontSize.xl, fontWeight: tokens.fontWeight.semibold, color: tokens.color.text0 }}>
            Connect Source Systems
          </h2>
          <p style={{ color: tokens.color.text1, marginTop: tokens.spacing.xs, fontSize: tokens.fontSize.sm }}>
            Connexy reads metadata only. No writes to source systems — guaranteed by design.
          </p>
        </div>
        <div style={{ display: 'flex', gap: tokens.spacing.sm }}>
          <Button variant="ghost" onClick={() => navigate({ name: 'projects' })}>← Back</Button>
          <Button variant="secondary" onClick={() => setShowAdd(!showAdd)}>+ Add Connector</Button>
          {connectors.length > 0 && (
            <Button variant="primary" onClick={runDiscovery}>Run Discovery →</Button>
          )}
        </div>
      </div>

      {showAdd && (
        <Card raised>
          <span className="micro-label" style={{ display: 'block', marginBottom: tokens.spacing.md }}>Available Connectors</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: tokens.spacing.md }}>
            {CONNECTOR_TYPES.map(c => (
              <div
                key={c.type}
                onClick={() => addConnector(c.type, c.name)}
                style={{
                  padding: tokens.spacing.md,
                  border: `${tokens.border.hairline} ${tokens.color.line}`,
                  borderLeft: `3px solid ${tierColors[c.tier] || tokens.color.text1}`,
                  borderRadius: tokens.radius.sm,
                  cursor: 'pointer',
                  transition: `background-color ${tokens.transition.fast}`,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = tokens.color.bg2; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: tokens.fontWeight.medium, color: tokens.color.text0, fontSize: tokens.fontSize.sm }}>{c.name}</span>
                  <Badge variant="default">{c.tier}</Badge>
                </div>
                <div style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.xs, color: tokens.color.text2, marginTop: tokens.spacing.xs }}>
                  {c.type}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing.md }}>
        {loading ? (
          <div style={{ padding: tokens.spacing.xxl, textAlign: 'center', color: tokens.color.text2 }}>Loading...</div>
        ) : connectors.length === 0 ? (
          <Card>
            <div style={{ padding: tokens.spacing.xxl, textAlign: 'center', color: tokens.color.text2 }}>
              <p style={{ fontSize: tokens.fontSize.md, marginBottom: tokens.spacing.md }}>No connectors configured.</p>
              <p style={{ fontSize: tokens.fontSize.sm }}>Add at least one data source to begin discovery.</p>
            </div>
          </Card>
        ) : (
          connectors.map(c => {
            const objects = metadataObjects[c.id] || [];
            const tierColor = tierColors[CONNECTOR_TYPES.find(t => t.type === c.type)?.tier || 'file'];
            return (
              <Card key={c.id} raised>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.md }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: tokens.radius.sm,
                      border: `${tokens.border.hairline} ${tierColor}40`,
                      backgroundColor: `${tierColor}12`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.lg, color: tierColor,
                    }}>
                      {c.type.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: tokens.fontWeight.semibold, color: tokens.color.text0, fontSize: tokens.fontSize.md }}>{c.name}</div>
                      <div style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.xs, color: tokens.color.text2, marginTop: tokens.spacing.xs }}>
                        {c.type}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing.sm }}>
                    <Badge variant={c.status === 'validated' || c.status === 'configured' ? 'ok' : 'default'}>{c.status}</Badge>
                    <Badge variant="ok">READ-ONLY</Badge>
                    {objects.length > 0 && (
                      <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.xs, color: tokens.color.text1 }}>
                        {objects.length} objects
                      </span>
                    )}
                  </div>
                </div>
                {objects.length > 0 && (
                  <div style={{ marginTop: tokens.spacing.md, paddingTop: tokens.spacing.md, borderTop: `1px solid ${tokens.color.line}40` }}>
                    <span className="micro-label" style={{ display: 'block', marginBottom: tokens.spacing.sm }}>Metadata Objects</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: tokens.spacing.xs }}>
                      {objects.slice(0, 8).map(o => (
                        <span
                          key={o.id}
                          style={{
                            fontFamily: tokens.fontFamily.mono,
                            fontSize: tokens.fontSize.xs,
                            color: tokens.color.text1,
                            padding: `${tokens.spacing.xs} ${tokens.spacing.sm}`,
                            border: `${tokens.border.hairline} ${tokens.color.line}`,
                            borderRadius: tokens.radius.sm,
                            backgroundColor: tokens.color.bg0,
                          }}
                        >
                          {o.name}
                        </span>
                      ))}
                      {objects.length > 8 && (
                        <span style={{ fontFamily: tokens.fontFamily.mono, fontSize: tokens.fontSize.xs, color: tokens.color.text2, padding: `${tokens.spacing.xs} ${tokens.spacing.sm}` }}>
                          +{objects.length - 8} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}