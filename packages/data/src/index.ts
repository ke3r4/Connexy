import type { D1Database } from '@cloudflare/workers-types';

export interface SemanticModelVersion {
  id: string;
  projectId: string;
  name: string;
  version: number;
  entities: unknown[];
  relationships: unknown[];
  hierarchy: HierarchyLevel[];
  kpiDefinitions: KPIDefinition[];
  status: 'draft' | 'review' | 'approved' | 'published' | 'superseded';
  parentVersionId?: string;
  changeLog: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface HierarchyLevel {
  level: number;
  name: string;
  parent?: string;
  sourceMapping?: string;
}

export interface KPIDefinition {
  name: string;
  formula: string;
  description: string;
  measures: string[];
}

export class SemanticModelStore {
  constructor(private db: D1Database) {}

  async createVersion(model: Omit<SemanticModelVersion, 'id' | 'version' | 'createdAt' | 'updatedAt'>): Promise<SemanticModelVersion> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const latestVersion = await this.db.prepare(
      'SELECT MAX(version) as maxVersion FROM semantic_model_versions WHERE project_id = ?',
    ).bind(model.projectId).first() as { maxVersion: number | null } | null;
    const version = (latestVersion?.maxVersion || 0) + 1;
    await this.db.prepare(
      `INSERT INTO semantic_model_versions (id, project_id, name, version, entities, relationships, hierarchy, kpi_definitions, status, parent_version_id, change_log, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id, model.projectId, model.name, version,
      JSON.stringify(model.entities), JSON.stringify(model.relationships),
      JSON.stringify(model.hierarchy || []), JSON.stringify(model.kpiDefinitions || []),
      model.status, model.parentVersionId || null, model.changeLog,
      model.createdBy, now, now,
    ).run();
    return { ...model, id, version, createdAt: now, updatedAt: now };
  }

  async getLatestVersion(projectId: string): Promise<SemanticModelVersion | null> {
    const result = await this.db.prepare(
      'SELECT * FROM semantic_model_versions WHERE project_id = ? ORDER BY version DESC LIMIT 1',
    ).bind(projectId).first();
    return result as SemanticModelVersion | null;
  }

  async getVersion(projectId: string, version: number): Promise<SemanticModelVersion | null> {
    const result = await this.db.prepare(
      'SELECT * FROM semantic_model_versions WHERE project_id = ? AND version = ?',
    ).bind(projectId, version).first();
    return result as SemanticModelVersion | null;
  }

  async listVersions(projectId: string): Promise<SemanticModelVersion[]> {
    const result = await this.db.prepare(
      'SELECT * FROM semantic_model_versions WHERE project_id = ? ORDER BY version DESC',
    ).bind(projectId).all();
    return result.results as unknown as SemanticModelVersion[];
  }

  async updateStatus(id: string, status: SemanticModelVersion['status']): Promise<void> {
    await this.db.prepare(
      'UPDATE semantic_model_versions SET status = ?, updated_at = ? WHERE id = ?',
    ).bind(status, new Date().toISOString(), id).run();
  }

  async supersede(id: string, newVersionId: string): Promise<void> {
    await this.db.prepare(
      'UPDATE semantic_model_versions SET status = ?, updated_at = ? WHERE id = ?',
    ).bind('superseded', new Date().toISOString(), id).run();
  }
}

export class HierarchyBuilder {
  buildCanonicalHierarchy(entities: Array<{ name: string; type: string; attributes: Array<{ name: string; isKey?: boolean }> }>): HierarchyLevel[] {
    const dimensions = entities.filter(e => e.type === 'dimension' || e.type === 'hierarchy');
    const hierarchyMap: Record<string, number> = {
      enterprise: 0, site: 1, area: 2, line: 3, cell: 4, machine: 5,
    };
    const levels: HierarchyLevel[] = [];
    for (const dim of dimensions) {
      const nameLower = dim.name.toLowerCase().replace('dim', '').trim();
      const level = hierarchyMap[nameLower] ?? 99;
      levels.push({
        level,
        name: dim.name,
        parent: level > 0 ? this.findParent(levels, level - 1) : undefined,
      });
    }
    return levels.sort((a, b) => a.level - b.level);
  }

  private findParent(levels: HierarchyLevel[], targetLevel: number): string | undefined {
    return levels.find(l => l.level === targetLevel)?.name;
  }
}

export interface ReuseArtifact {
  id: string;
  tenantId: string;
  scope: 'project' | 'site' | 'enterprise';
  artifactType: 'mapping' | 'semantic-model' | 'hierarchy' | 'kpi-definition';
  artifactId: string;
  name: string;
  sourceProjectId: string;
  promotedBy: string;
  promotedAt: string;
}

export class ReuseCatalogue {
  constructor(private db: D1Database) {}

  async promote(artifact: Omit<ReuseArtifact, 'id' | 'promotedAt'>): Promise<ReuseArtifact> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await this.db.prepare(
      `INSERT INTO reuse_catalogue (id, tenant_id, scope, artifact_type, artifact_id, name, source_project_id, promoted_by, promoted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id, artifact.tenantId, artifact.scope, artifact.artifactType,
      artifact.artifactId, artifact.name, artifact.sourceProjectId,
      artifact.promotedBy, now,
    ).run();
    return { ...artifact, id, promotedAt: now };
  }

  async listByTenant(tenantId: string, scope?: string): Promise<ReuseArtifact[]> {
    let query = 'SELECT * FROM reuse_catalogue WHERE tenant_id = ?';
    const params: unknown[] = [tenantId];
    if (scope) {
      query += ' AND scope = ?';
      params.push(scope);
    }
    query += ' ORDER BY promoted_at DESC';
    const result = await this.db.prepare(query).bind(...params).all();
    return result.results as unknown as ReuseArtifact[];
  }

  async findReusable(tenantId: string, artifactType: string): Promise<ReuseArtifact[]> {
    const result = await this.db.prepare(
      'SELECT * FROM reuse_catalogue WHERE tenant_id = ? AND artifact_type = ? AND scope IN (?, ?) ORDER BY scope DESC, promoted_at DESC',
    ).bind(tenantId, artifactType, 'site', 'enterprise').all();
    return result.results as unknown as ReuseArtifact[];
  }
}
export * from './compliance.js';
export * from './adapters.js';
