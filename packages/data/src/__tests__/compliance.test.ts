import { describe, it, expect } from 'vitest';
import { ComplianceDossierGenerator } from '../compliance.js';

describe('Compliance Dossier (Phase 4)', () => {
  it('generates a complete validation dossier', () => {
    const gen = new ComplianceDossierGenerator();
    const dossier = gen.generate(
      'project-1', 'tenant-1',
      {
        auditEntries: [
          { id: 'a1', tenantId: 't1', action: 'mapping.accept', entityType: 'mapping', entityId: 'm1', timestamp: new Date().toISOString(), hash: 'abc' },
        ],
        mappings: [
          { status: 'accepted', proposedBy: 'ai' },
          { status: 'rejected', proposedBy: 'ai' },
          { status: 'proposed', proposedBy: 'ai' },
        ],
        connectors: [
          { type: 'metadata-file', tier: 'file', canWrite: false },
          { type: 'sap-erp', tier: 'erp', canWrite: false },
        ],
        costSummary: { totalCost: 2.50, byTier: { small: { calls: 10, cost: 0.50 }, large: { calls: 5, cost: 2.00 } } },
        modelEndpoints: ['https://api.mistral.ai/v1 (EU)'],
        chainValid: true,
      },
    );

    expect(dossier.projectId).toBe('project-1');
    expect(dossier.readOnlyAssertion.verified).toBe(true);
    expect(dossier.readOnlyAssertion.connectorInventory).toHaveLength(2);
    expect(dossier.auditTrail.chainValid).toBe(true);
    expect(dossier.humanInLoop.accepted).toBe(1);
    expect(dossier.humanInLoop.rejected).toBe(1);
    expect(dossier.humanInLoop.autoApplied).toBe(0);
    expect(dossier.dataResidency.residencyEnforced).toBe(true);
    expect(dossier.alcoePlus.length).toBeGreaterThanOrEqual(9);
    expect(dossier.segregationOfDuties.length).toBe(5);
    expect(dossier.whatConnexyDid.length).toBeGreaterThan(0);
    expect(dossier.whatConnexyDidNot.length).toBeGreaterThan(0);
    expect(dossier.whatConnexyDidNot).toContain('Did NOT write to, modify, or control any source system or shopfloor equipment');
  });

  it('ALCOA+ assessment covers all principles', () => {
    const gen = new ComplianceDossierGenerator();
    const dossier = gen.generate('p1', 't1', {
      auditEntries: [], mappings: [], connectors: [],
      costSummary: { totalCost: 0, byTier: {} }, modelEndpoints: [], chainValid: true,
    });
    const principles = dossier.alcoePlus.map(a => a.principle.toLowerCase());
    expect(principles).toContain('attributable');
    expect(principles).toContain('legible');
    expect(principles).toContain('contemporaneous');
    expect(principles).toContain('original');
    expect(principles).toContain('accurate');
    expect(principles).toContain('complete');
    expect(principles).toContain('consistent');
    expect(principles).toContain('enduring');
    expect(principles).toContain('available');
    for (const a of dossier.alcoePlus) {
      expect(a.compliant).toBe(true);
    }
  });

  it('segregation of duties prevents engineer from approving', () => {
    const gen = new ComplianceDossierGenerator();
    const dossier = gen.generate('p1', 't1', {
      auditEntries: [], mappings: [], connectors: [],
      costSummary: { totalCost: 0, byTier: {} }, modelEndpoints: [], chainValid: true,
    });
    const engineer = dossier.segregationOfDuties.find(s => s.role === 'engineer')!;
    expect(engineer.canCreate).toBe(true);
    expect(engineer.canApprove).toBe(false);
    expect(engineer.canExport).toBe(false);
  });
});