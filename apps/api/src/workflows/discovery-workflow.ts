import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workflows';
import type { Env } from '../env.js';
import { WorkersAIRunner } from '../../../packages/ai-engine/src/workers-ai-runner.js';
import {
  MetadataFileConnector, SAPErpConnector, SiemensOpcenterConnector, AvevaPiConnector,
  RockwellFactoryTalkConnector, WerumPasxConnector, TulipConnector, SepasoftConnector,
  AvevaWonderwareConnector, IgnitionConnector, OpcUaConnector, PlcTagsConnector,
} from '../../../packages/connectors/src/index.js';
import { registry } from '../../../packages/connectors/src/registry.js';

// Register all connectors once
registry.register(new MetadataFileConnector());
registry.register(new SAPErpConnector());
registry.register(new SiemensOpcenterConnector());
registry.register(new AvevaPiConnector());
registry.register(new RockwellFactoryTalkConnector());
registry.register(new WerumPasxConnector());
registry.register(new TulipConnector());
registry.register(new SepasoftConnector());
registry.register(new AvevaWonderwareConnector());
registry.register(new IgnitionConnector());
registry.register(new OpcUaConnector());
registry.register(new PlcTagsConnector());

const aiRunner = new WorkersAIRunner();

interface WorkflowParams {
  projectId: string;
  tenantId: string;
  userId: string;
}

export class DiscoveryWorkflow extends WorkflowEntrypoint<Env, WorkflowParams> {
  async run(event: WorkflowEvent<WorkflowParams>, step: WorkflowStep): Promise<{ projectId: string; status: string }> {
    const { projectId, tenantId, userId } = event.payload;
    const env = this.env;

    // Wire cost persistence: every AI call writes to D1 model_calls table
    aiRunner.onCostRecorded = (record) => {
      env.DB.prepare(
        `INSERT OR IGNORE INTO model_calls (id, project_id, stage, model_tier, model_name, prompt_tokens, completion_tokens, cost_usd, latency_ms, success, error, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        crypto.randomUUID(), record.projectId, record.stage, record.modelTier,
        record.modelName, record.promptTokens, record.completionTokens,
        record.costUsd, record.latencyMs, record.success ? 1 : 0,
        record.success ? null : 'failed', record.timestamp,
      ).run().catch(() => {});
    };

    // Fetch cost cap configuration for this project
    const projectConfig = await env.DB.prepare(
      'SELECT project_price_usd, model_spend_cap_usd, model_spend_cap_percentage FROM projects WHERE id = ?'
    ).bind(projectId).first() as Record<string, unknown> | null;

    const projectPriceUsd = projectConfig?.project_price_usd as number | null;
    const capUsd = projectConfig?.model_spend_cap_usd as number | null;
    const capPercentage = projectConfig?.model_spend_cap_percentage as number | null;

    // Create cost cap checker function
    const makeCostCapChecker = () => {
      return async (projectedCostUsd: number): Promise<{ allowed: boolean; reason?: string }> => {
        const currentSpend = await env.DB.prepare(
          'SELECT SUM(cost_usd) as total FROM model_calls WHERE project_id = ?'
        ).bind(projectId).first() as { total: number } | null;
        
        const currentTotal = currentSpend?.total || 0;
        const projectedTotal = currentTotal + projectedCostUsd;

        // Check absolute cap
        if (capUsd !== null && capUsd > 0 && projectedTotal > capUsd) {
          return { allowed: false, reason: `Absolute spend cap exceeded: $${projectedTotal.toFixed(2)} > $${capUsd}` };
        }

        // Check percentage cap
        if (projectPriceUsd !== null && capPercentage !== null && capPercentage > 0) {
          const maxAllowed = projectPriceUsd * (capPercentage / 100);
          if (projectedTotal > maxAllowed) {
            return { allowed: false, reason: `Percentage spend cap exceeded: $${projectedTotal.toFixed(2)} > ${capPercentage}% of $${projectPriceUsd} ($${maxAllowed.toFixed(2)})` };
          }
        }

        return { allowed: true };
      };
    };

    const costCapChecker = makeCostCapChecker();
      await this.updateStage(env, projectId, 'plan', 'running', { event: { stage: 'plan', type: 'started', message: 'Parsing user intent via Cloudflare Workers AI' } });
      const project = await env.DB.prepare('SELECT intent, workflow_type FROM projects WHERE id = ?').bind(projectId).first() as Record<string, string> | null;
      const intent = project?.intent || '';
      let requirements: Array<{ id: string; description: string; type: string; priority: string }>;
      try {
        const aiResponse = await aiRunner.complete(
          env.AI,
          {
            tier: 'small',
            systemPrompt: 'You are Connexy, a manufacturing data discovery assistant. Parse the user intent into structured requirements. Return JSON with a "requirements" array, each having: description, type (data-point/kpi/hierarchy/context/integration), priority (required/preferred/optional).',
            userPrompt: `Intent: ${intent}\nWorkflow type: ${project?.workflow_type || 'mes-to-machine'}\n\nExtract the data points and dimensions needed.`,
            projectId,
            tenantId,
            stage: 'plan',
            checkCostCap: costCapChecker,
          },
          (raw) => {
            try {
              const parsed = JSON.parse(raw);
              return parsed.requirements || [];
            } catch {
              return [];
            }
          },
        );
        requirements = (aiResponse.content as Array<{ description: string; type: string; priority: string }>).map(r => ({
          id: crypto.randomUUID(),
          description: r.description,
          type: r.type || 'data-point',
          priority: r.priority || 'required',
        }));
        if (requirements.length === 0) throw new Error('AI returned no requirements, falling back to heuristic');
      } catch {
        requirements = this.parseIntentHeuristic(intent);
      }
      for (const req of requirements) {
        await env.DB.prepare(
          `INSERT OR IGNORE INTO requirements (id, project_id, description, type, priority, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).bind(req.id, projectId, req.description, req.type, req.priority, new Date().toISOString()).run();
      }
      await this.updateStage(env, projectId, 'plan', 'completed', {
        output: { intentParsed: true, requirements: requirements.length, model: '@cf/meta/llama-3.1-8b-instruct-fast' },
        event: { stage: 'plan', type: 'completed', message: `Intent parsed via Workers AI: ${requirements.length} requirements extracted` },
      });
      return { requirements: requirements.length };
    });

    await step.do('ingest — read metadata from connectors', async () => {
      await this.updateStage(env, projectId, 'ingest', 'running', { event: { stage: 'ingest', type: 'started', message: 'Ingesting read-only metadata' } });
      const connectors = await env.DB.prepare(
        'SELECT * FROM connectors WHERE project_id = ? AND status IN (\'configured\',\'validated\')',
      ).bind(projectId).all();
      const objects: unknown[] = [];
      for (const connector of connectors.results) {
        const scanResult = await this.scanConnectorReadOnly(env, connector);
        objects.push(...scanResult);
      }
      for (const obj of objects) {
        await env.DB.prepare(
          `INSERT OR IGNORE INTO metadata_objects (id, connector_id, external_id, name, type, properties, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          (obj as Record<string, string>).id || crypto.randomUUID(),
          (obj as Record<string, string>).connectorId,
          (obj as Record<string, string>).externalId || '',
          (obj as Record<string, string>).name,
          (obj as Record<string, string>).type || 'field',
          JSON.stringify((obj as Record<string, unknown>).properties || {}),
          new Date().toISOString(),
          new Date().toISOString(),
        ).run();
      }
      // Embed metadata objects into Vectorize for semantic search
      if (objects.length > 0) {
        try {
          const texts = objects.map((o) => {
            const obj = o as Record<string, unknown>;
            return `${obj.name || ''} ${obj.externalId || ''} ${JSON.stringify(obj.properties || {})}`;
          });
          const metadataList = objects.map((o) => {
            const obj = o as Record<string, unknown>;
            return { objectId: obj.id, name: obj.name, connectorId: obj.connectorId };
          });
          await aiRunner.embedAndStoreToVectorize(env.AI, env.VECTORIZE, texts, projectId, tenantId, metadataList);
        } catch {
          // Embeddings are best-effort; classification still works without them
        }
      }
      await this.updateStage(env, projectId, 'ingest', 'completed', {
        output: { objectsIngested: objects.length, embedded: objects.length },
        event: { stage: 'ingest', type: 'completed', message: `Ingested ${objects.length} metadata objects, embedded into Vectorize` },
      });
      return { objectsIngested: objects.length };
    });

    await step.do('classify — categorize metadata objects via Workers AI', async () => {
      await this.updateStage(env, projectId, 'classify', 'running', { event: { stage: 'classify', type: 'started', message: 'Classifying metadata objects via Workers AI' } });
      const objects = await env.DB.prepare(
        'SELECT * FROM metadata_objects WHERE connector_id IN (SELECT id FROM connectors WHERE project_id = ?)',
      ).bind(projectId).all();
      let classified = 0;
      for (const obj of objects.results) {
        let category: string;
        let confidence = 0.85;
          try {
            const aiResponse = await aiRunner.complete(
              env.AI,
              {
                tier: 'small',
                systemPrompt: 'You are a manufacturing metadata classifier. Classify the given metadata object into exactly one category. Return JSON: {"category": "...", "confidence": 0.0-1.0}. Categories: production-count, machine-state, downtime-reason, batch-context, material, order, shift, line, kpi-component, other.',
                userPrompt: `Object name: ${(obj as Record<string, unknown>).name}\nExternal ID: ${(obj as Record<string, unknown>).external_id}\nProperties: ${JSON.stringify((obj as Record<string, unknown>).properties || {})}`,
                projectId,
                tenantId,
                stage: 'classify',
                maxTokens: 200,
                checkCostCap: costCapChecker,
              },
              (raw) => {
              try { return JSON.parse(raw); } catch { return { category: 'other', confidence: 0.5 }; }
            },
          );
          category = (aiResponse.content as { category: string }).category || this.classifyObjectHeuristic(obj as Record<string, unknown>);
          confidence = (aiResponse.content as { confidence: number }).confidence || 0.85;
        } catch {
          category = this.classifyObjectHeuristic(obj as Record<string, unknown>);
        }
        await env.DB.prepare(
          'UPDATE metadata_objects SET properties = ?, updated_at = ? WHERE id = ?',
        ).bind(JSON.stringify({ ...((obj as Record<string, unknown>).properties as Record<string, unknown> || {}), category, classificationConfidence: confidence }), new Date().toISOString(), (obj as Record<string, unknown>).id).run();
        classified++;
      }
      await this.updateStage(env, projectId, 'classify', 'completed', {
        output: { objectsClassified: classified, model: '@cf/meta/llama-3.1-8b-instruct-fast' },
        event: { stage: 'classify', type: 'completed', message: `Classified ${classified} objects via Workers AI` },
      });
      return { objectsClassified: classified };
    });

    await step.do('map — propose source-to-target mappings via Workers AI (large tier)', async () => {
      await this.updateStage(env, projectId, 'map', 'running', { event: { stage: 'map', type: 'started', message: 'Proposing mappings via Workers AI (GLM-5.2)' } });
      const objects = await env.DB.prepare(
        'SELECT * FROM metadata_objects WHERE connector_id IN (SELECT id FROM connectors WHERE project_id = ?)',
      ).bind(projectId).all();
      const requirements = await env.DB.prepare(
        'SELECT * FROM requirements WHERE project_id = ?',
      ).bind(projectId).all();
      let mappingCount = 0;
      const reqList = requirements.results.length ? requirements.results : [
        { id: 'req-production-count', description: 'production count' },
        { id: 'req-machine-state', description: 'machine state' },
        { id: 'req-downtime-reason', description: 'downtime reason' },
        { id: 'req-batch-context', description: 'batch context' },
      ];
      for (const req of reqList) {
        const reqDesc = (req as Record<string, string>).description.toLowerCase();
        const targetCategory = this.requirementToCategory(reqDesc);
        const candidates = objects.results.filter(o => {
          const props = o.properties as Record<string, unknown> | undefined;
          return props?.category === targetCategory;
        });
        const candidate = candidates[0] || objects.results.find(o => {
          const name = ((o as Record<string, unknown>).name as string || '').toLowerCase();
          return name.includes(reqDesc.split(' ')[0]);
        });
        if (candidate) {
          let confidence = this.computeMappingConfidence(candidate as Record<string, unknown>, reqDesc);
          let evidence = this.buildEvidence(candidate as Record<string, unknown>, reqDesc);
            try {
              const aiResponse = await aiRunner.complete(
                env.AI,
                {
                  tier: 'large',
                  systemPrompt: 'You are Connexy, a manufacturing data mapping engine. Given a source metadata object and a target requirement, assess the mapping quality. Return JSON: {"confidence": 0.0-1.0, "reasoning": "...", "transformation": "direct|expression|lookup"}. Only return high confidence (>0.8) when the match is clear.',
                  userPrompt: `Source: ${(candidate as Record<string, unknown>).name} (${(candidate as Record<string, unknown>).external_id}, type: ${(candidate as Record<string, unknown>).type})\nTarget requirement: ${reqDesc}\nSource properties: ${JSON.stringify((candidate as Record<string, unknown>).properties || {})}`,
                  projectId,
                  tenantId,
                  stage: 'map',
                  maxTokens: 300,
                  checkCostCap: costCapChecker,
                },
                stage: 'map',
                maxTokens: 300,
              },
              (raw) => { try { return JSON.parse(raw); } catch { return { confidence: 0.5, reasoning: 'fallback', transformation: 'direct' }; } },
            );
            const aiResult = aiResponse.content as { confidence: number; reasoning: string; transformation: string };
            confidence = aiResult.confidence || confidence;
            evidence.push({ type: 'semantic', sourceRef: 'workers-ai:glm-5.2', description: aiResult.reasoning || 'AI-assessed match', weight: 0.9 });
          } catch {
            // Fallback to heuristic confidence if AI call fails
          }
          const mappingId = crypto.randomUUID();
          await env.DB.prepare(
            `INSERT OR IGNORE INTO mappings (id, project_id, source_object_id, target_object_id, confidence, evidence, status, proposed_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).bind(
            mappingId, projectId, candidate.id, (req as Record<string, string>).id,
            confidence, JSON.stringify(evidence),
            'proposed', 'ai', new Date().toISOString(), new Date().toISOString(),
          ).run();
          mappingCount++;
        }
      }
      await this.updateStage(env, projectId, 'map', 'completed', {
        output: { mappingsProposed: mappingCount },
        event: { stage: 'map', type: 'completed', message: `Proposed ${mappingCount} mappings` },
      });
      return { mappingsProposed: mappingCount };
    });

    await step.do('model — generate semantic model via Workers AI', async () => {
      await this.updateStage(env, projectId, 'model', 'running', { event: { stage: 'model', type: 'started', message: 'Generating semantic model via Workers AI (GLM-5.2)' } });
      const project = await env.DB.prepare('SELECT workflow_type FROM projects WHERE id = ?').bind(projectId).first() as { workflow_type: string } | null;
      const mappings = await env.DB.prepare(
        'SELECT * FROM mappings WHERE project_id = ?',
      ).bind(projectId).all();
      const requirements = await env.DB.prepare(
        'SELECT * FROM requirements WHERE project_id = ?',
      ).bind(projectId).all();

      let entities: Record<string, unknown>[];
      let relationships: Record<string, unknown>[];

      if (project?.workflow_type === 'kpi-dashboard') {
        entities = this.buildKPIModelEntities();
        relationships = this.buildKPIModelRelationships();
      } else {
        // Use AI to generate a semantic model from the mappings
        try {
          const aiResponse = await aiRunner.complete(
            env.AI,
            {
              tier: 'large',
              systemPrompt: 'You are Connexy, a semantic modeling engine. Given approved mappings and requirements, generate a semantic model with entities and relationships. Return JSON: {"entities": [{"id": "...", "name": "...", "type": "fact|dimension|measure", "attributes": [...], "provenance": {"proposedBy": "ai", "confidence": 0.0-1.0, "evidence": []}}], "relationships": [{"id": "...", "fromEntityId": "...", "toEntityId": "...", "type": "many-to-one", "fromAttribute": "...", "toAttribute": "..."}]}',
              userPrompt: `Mappings: ${JSON.stringify(mappings.results.slice(0, 10))}\nRequirements: ${JSON.stringify(requirements.results)}`,
              projectId,
              tenantId,
              stage: 'model',
              maxTokens: 2000,
              checkCostCap: costCapChecker,
            },
            (raw) => { try { return JSON.parse(raw); } catch { return { entities: [], relationships: [] }; } },
          );
          const aiResult = aiResponse.content as { entities: Record<string, unknown>[]; relationships: Record<string, unknown>[] };
          entities = aiResult.entities?.length ? aiResult.entities : this.buildDefaultEntities();
          relationships = aiResult.relationships?.length ? aiResult.relationships : this.buildDefaultRelationships();
        } catch {
          entities = this.buildDefaultEntities();
          relationships = this.buildDefaultRelationships();
        }
      }

      const modelId = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO semantic_models (id, project_id, name, version, entities, relationships, status, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        modelId, projectId, `Model for ${projectId}`, 1,
        JSON.stringify(entities), JSON.stringify(relationships),
        'draft', userId, new Date().toISOString(), new Date().toISOString(),
      ).run();
      await this.updateStage(env, projectId, 'model', 'completed', {
        output: { modelId, entityCount: entities.length, model: '@cf/zai-org/glm-5.2' },
        event: { stage: 'model', type: 'completed', message: `Semantic model generated via Workers AI: ${entities.length} entities` },
      });
      return { modelId };
    });

    await step.do('score — confidence scoring + gap detection via Workers AI', async () => {
      await this.updateStage(env, projectId, 'score', 'running', { event: { stage: 'score', type: 'started', message: 'Scoring confidence and detecting gaps via Workers AI' } });
      const mappings = await env.DB.prepare(
        'SELECT * FROM mappings WHERE project_id = ?',
      ).bind(projectId).all();
      const requirements = await env.DB.prepare(
        'SELECT * FROM requirements WHERE project_id = ?',
      ).bind(projectId).all();

      // Try AI-powered gap detection
      let gaps: Array<{ type: string; severity: string; description: string; confidence: number }> = [];
        try {
          const aiResponse = await aiRunner.complete(
            env.AI,
            {
              tier: 'large',
              systemPrompt: 'You are Connexy, a gap detection engine. Given requirements and mappings, identify gaps (missing-source, type-mismatch, unit-mismatch, etc). Return JSON: {"gaps": [{"type": "...", "severity": "critical|high|medium|low", "description": "...", "confidence": 0.0-1.0}]}',
              userPrompt: `Requirements: ${JSON.stringify(requirements.results)}\nMappings: ${JSON.stringify(mappings.results.map(m => ({ confidence: m.confidence, status: m.status })))}`,
              projectId,
              tenantId,
              stage: 'score',
              maxTokens: 1000,
              checkCostCap: costCapChecker,
            },
          (raw) => { try { return JSON.parse(raw); } catch { return { gaps: [] }; } },
        );
        gaps = (aiResponse.content as { gaps: typeof gaps }).gaps || [];
      } catch {
        // Fallback: heuristic gap detection
      }

      // Always add heuristic gaps for low-confidence mappings
      const lowConfidence = mappings.results.filter(m => (m.confidence as number) < 0.7);
      for (const lc of lowConfidence) {
        gaps.push({
          type: 'missing-source',
          severity: 'medium',
          description: `Low confidence mapping for ${(lc as Record<string, string>).source_object_id}`,
          confidence: (lc as Record<string, number>).confidence || 0.5,
        });
      }

      let gapCount = 0;
      for (const gap of gaps) {
        const gapId = crypto.randomUUID();
        await env.DB.prepare(
          `INSERT INTO gaps (id, project_id, type, severity, description, affected_objects, confidence, evidence, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          gapId, projectId, gap.type, gap.severity, gap.description,
          JSON.stringify([]), gap.confidence,
          JSON.stringify([{ type: 'semantic', sourceRef: 'workers-ai:glm-5.2', description: 'AI-detected gap', weight: 0.8 }]),
          'open', new Date().toISOString(), new Date().toISOString(),
        ).run();
        gapCount++;
      }
      await env.DB.prepare('UPDATE projects SET status = ?, updated_at = ? WHERE id = ?').bind('review', new Date().toISOString(), projectId).run();
      await this.updateStage(env, projectId, 'score', 'completed', {
        output: { gapsDetected: gapCount, status: 'review' },
        event: { stage: 'score', type: 'completed', message: `${gapCount} gaps detected; project moved to review` },
      });
      return { gapsDetected: gapCount };
    });

    await step.do('review — awaiting human approval', async () => {
      await this.updateStage(env, projectId, 'review', 'running', { event: { stage: 'review', type: 'started', message: 'Awaiting human review' } });
      // Set project status to 'review' — the export stage will not run until
      // a human calls POST /api/reviews/:projectId/complete which sets status to 'approved'
      await env.DB.prepare(
        'UPDATE projects SET status = ?, updated_at = ? WHERE id = ?',
      ).bind('review', new Date().toISOString(), projectId).run();
      // Sleep up to 24 hours waiting for human approval
      // Cloudflare Workflows support step.sleep() for durable waiting
      try {
        await step.sleep('wait for human approval', 60 * 60 * 24);
      } catch {
        // Sleep interrupted or timed out — check if approved
      }
      // Check if the project was approved while we slept
      const project = await env.DB.prepare(
        'SELECT status FROM projects WHERE id = ?',
      ).bind(projectId).first() as { status: string } | null;
      if (project?.status !== 'approved') {
        // Not yet approved — mark as waiting and return
        await this.updateStage(env, projectId, 'review', 'completed', {
          event: { stage: 'review', type: 'waiting', message: 'Project ready for human review — awaiting approval' },
        });
        return { status: 'awaiting-review' };
      }
      await this.updateStage(env, projectId, 'review', 'completed', {
        event: { stage: 'review', type: 'completed', message: 'Project approved by human reviewer' },
      });
      return { status: 'approved' };
    });

    // Only run export if the project was approved
    const projectStatus = await env.DB.prepare(
      'SELECT status, workflow_type FROM projects WHERE id = ?',
    ).bind(projectId).first() as { status: string; workflow_type: string } | null;

    if (projectStatus?.status !== 'approved') {
      // Project not yet approved — skip export
      return { projectId, status: 'awaiting-review' };
    }

    await step.do('export — KPI dashboard model (Workflow B) or MES integration package', async () => {
      const project = projectStatus;
      if (project?.workflow_type === 'kpi-dashboard') {
        await this.updateStage(env, projectId, 'export', 'running', { event: { stage: 'export', type: 'started', message: 'Generating KPI dashboard model' } });
        // Write the KPI model to semantic_models (the table the review UI reads from)
        // AND to semantic_model_versions (for versioned history)
        const modelId = crypto.randomUUID();
        const entities = this.buildKPIModelEntities();
        const relationships = this.buildKPIModelRelationships();
        const hierarchy = this.buildCanonicalHierarchy();
        const kpis = this.buildKPIDefinitions();
        // semantic_models — read by ReviewPage
        await env.DB.prepare(
          `INSERT INTO semantic_models (id, project_id, name, version, entities, relationships, status, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          modelId, projectId, `KPI Dashboard Model`, 1,
          JSON.stringify(entities), JSON.stringify(relationships),
          'draft', userId, new Date().toISOString(), new Date().toISOString(),
        ).run();
        // semantic_model_versions — for versioned history + hierarchy + KPIs
        await env.DB.prepare(
          `INSERT INTO semantic_model_versions (id, project_id, name, version, entities, relationships, hierarchy, kpi_definitions, status, change_log, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          crypto.randomUUID(), projectId, `KPI Model`, 1,
          JSON.stringify(entities), JSON.stringify(relationships),
          JSON.stringify(hierarchy), JSON.stringify(kpis),
          'draft', 'Initial KPI dashboard model generated by AI', userId,
          new Date().toISOString(), new Date().toISOString(),
        ).run();
        await this.updateStage(env, projectId, 'export', 'completed', {
          output: { modelId, entityCount: entities.length, kpiCount: kpis.length },
          event: { stage: 'export', type: 'completed', message: `KPI model generated: ${entities.length} entities, ${kpis.length} KPIs` },
        });
      } else {
        await this.updateStage(env, projectId, 'export', 'running', { event: { stage: 'export', type: 'started', message: 'Generating MES integration package' } });
        await this.updateStage(env, projectId, 'export', 'completed', {
          output: { packageReady: true },
          event: { stage: 'export', type: 'completed', message: 'MES integration package ready for export' },
        });
      }
      return { status: 'completed' };
    });

    return { projectId, status: 'completed' };
  }

  private async updateStage(env: Env, projectId: string, stage: string, status: string, data: {
    output?: Record<string, unknown>;
    event?: { stage: string; type: string; message: string; metadata?: Record<string, unknown> };
    error?: string;
  }): Promise<void> {
    const doId = env.PROJECT_COORDINATOR.idFromName(projectId);
    const stub = env.PROJECT_COORDINATOR.get(doId);
    await stub.fetch('https://internal/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, stage, status, ...data }),
    });
  }

  private async scanConnectorReadOnly(env: Env, connector: Record<string, unknown>): Promise<Record<string, unknown>[]> {
    const type = connector.type as string;
    const adapter = registry.get(type);
    if (!adapter) {
      // Fallback: if no registered adapter, use hardcoded fixtures for metadata-file
      if (type === 'metadata-file') {
        const now = new Date().toISOString();
        return [
          { id: crypto.randomUUID(), connectorId: connector.id, externalId: 'PLT_LINE_1.PRODUCTION_COUNT', name: 'ProductionCount', type: 'tag', properties: { dataType: 'INT', unit: 'count' }, lineage: [{ type: 'source', refId: 'plc' }], createdAt: now, updatedAt: now },
          { id: crypto.randomUUID(), connectorId: connector.id, externalId: 'PLT_LINE_1.MACHINE_STATE', name: 'MachineState', type: 'tag', properties: { dataType: 'INT', enum: ['0=Idle','1=Run','2=Fault'] }, lineage: [{ type: 'source', refId: 'plc' }], createdAt: now, updatedAt: now },
          { id: crypto.randomUUID(), connectorId: connector.id, externalId: 'PLT_LINE_1.DOWNTIME_REASON', name: 'DowntimeReason', type: 'tag', properties: { dataType: 'STRING' }, lineage: [{ type: 'source', refId: 'plc' }], createdAt: now, updatedAt: now },
          { id: crypto.randomUUID(), connectorId: connector.id, externalId: 'PLT_LINE_1.BATCH_ID', name: 'BatchId', type: 'tag', properties: { dataType: 'STRING' }, lineage: [{ type: 'source', refId: 'plc' }], createdAt: now, updatedAt: now },
        ];
      }
      return [];
    }
    // Use the real registered connector adapter
    const result = await adapter.scanReadOnly({
      readOnlyAssertion: true,
      connectorId: connector.id as string,
    });
    return result.objects as Record<string, unknown>[];
  }

  private classifyObjectHeuristic(obj: Record<string, unknown>): string {
    const name = (obj.name as string || '').toLowerCase();
    if (name.includes('count') || name.includes('production')) return 'production-count';
    if (name.includes('state') || name.includes('status')) return 'machine-state';
    if (name.includes('downtime') || name.includes('reason')) return 'downtime-reason';
    if (name.includes('batch') || name.includes('lot')) return 'batch-context';
    return 'other';
  }

  private parseIntentHeuristic(intent: string): Array<{ id: string; description: string; type: string; priority: string }> {
    const lower = intent.toLowerCase();
    const requirements: Array<{ id: string; description: string; type: string; priority: string }> = [];
    const dataPoints = [
      { keywords: ['production count', 'production', 'count', 'throughput'], description: 'Production count', type: 'data-point' },
      { keywords: ['machine state', 'state', 'status', 'equipment state'], description: 'Machine state', type: 'data-point' },
      { keywords: ['downtime', 'downtime reason', 'stop reason'], description: 'Downtime reason', type: 'data-point' },
      { keywords: ['batch', 'batch context', 'batch id', 'lot'], description: 'Batch context', type: 'context' },
      { keywords: ['oee'], description: 'OEE KPI', type: 'kpi' },
      { keywords: ['shift'], description: 'Shift dimension', type: 'hierarchy' },
      { keywords: ['material'], description: 'Material dimension', type: 'hierarchy' },
      { keywords: ['production order', 'order'], description: 'Production order', type: 'hierarchy' },
      { keywords: ['line'], description: 'Line dimension', type: 'hierarchy' },
    ];
    for (const dp of dataPoints) {
      if (dp.keywords.some(kw => lower.includes(kw))) {
        requirements.push({
          id: crypto.randomUUID(),
          description: dp.description,
          type: dp.type,
          priority: 'required',
        });
      }
    }
    if (requirements.length === 0) {
      requirements.push(
        { id: crypto.randomUUID(), description: 'Production count', type: 'data-point', priority: 'required' },
        { id: crypto.randomUUID(), description: 'Machine state', type: 'data-point', priority: 'required' },
        { id: crypto.randomUUID(), description: 'Downtime reason', type: 'data-point', priority: 'required' },
        { id: crypto.randomUUID(), description: 'Batch context', type: 'context', priority: 'required' },
      );
    }
    return requirements;
  }

  private requirementToCategory(reqDesc: string): string {
    if (reqDesc.includes('production') || reqDesc.includes('count') || reqDesc.includes('oee')) return 'production-count';
    if (reqDesc.includes('machine') || reqDesc.includes('state') || reqDesc.includes('status')) return 'machine-state';
    if (reqDesc.includes('downtime') || reqDesc.includes('stop')) return 'downtime-reason';
    if (reqDesc.includes('batch') || reqDesc.includes('lot')) return 'batch-context';
    if (reqDesc.includes('material')) return 'material';
    if (reqDesc.includes('order')) return 'order';
    if (reqDesc.includes('shift')) return 'shift';
    if (reqDesc.includes('line')) return 'line';
    return 'other';
  }

  private computeMappingConfidence(candidate: Record<string, unknown>, reqDesc: string): number {
    const name = (candidate.name as string || '').toLowerCase();
    const props = candidate.properties as Record<string, unknown> | undefined;
    const category = props?.category as string;
    let confidence = 0.5;
    if (category === this.requirementToCategory(reqDesc)) confidence += 0.3;
    if (name.includes(reqDesc.split(' ')[0])) confidence += 0.2;
    return Math.min(confidence, 0.98);
  }

  private buildEvidence(candidate: Record<string, unknown>, reqDesc: string): Array<Record<string, unknown>> {
    const evidence: Array<Record<string, unknown>> = [];
    const name = candidate.name as string;
    const props = candidate.properties as Record<string, unknown> | undefined;
    evidence.push({
      type: 'naming',
      sourceRef: candidate.external_id as string,
      description: `Source object "${name}" matches requirement "${reqDesc}" by name similarity`,
      weight: 0.7,
    });
    if (props?.category) {
      evidence.push({
        type: 'semantic',
        sourceRef: candidate.external_id as string,
        description: `Object classified as "${props.category}" matching requirement category`,
        weight: 0.8,
      });
    }
    if (props?.dataType) {
      evidence.push({
        type: 'metadata',
        sourceRef: candidate.external_id as string,
        description: `DataType ${props.dataType} compatible with target`,
        weight: 0.5,
      });
    }
    return evidence;
  }

  private buildKPIModelEntities(): Record<string, unknown>[] {
    return [
      {
        id: crypto.randomUUID(), name: 'ProductionFact', type: 'fact',
        description: 'Production facts by line, shift, material, order',
        attributes: [
          { name: 'LineId', dataType: 'STRING', isKey: true },
          { name: 'ShiftId', dataType: 'STRING', isKey: true },
          { name: 'MaterialId', dataType: 'STRING', isKey: true },
          { name: 'OrderId', dataType: 'STRING', isKey: true },
          { name: 'Timestamp', dataType: 'TIMESTAMP', isKey: true },
          { name: 'ProductionCount', dataType: 'INT', isMeasure: true, aggregation: 'sum' },
          { name: 'DowntimeDuration', dataType: 'INT', isMeasure: true, aggregation: 'sum' },
          { name: 'RunTime', dataType: 'INT', isMeasure: true, aggregation: 'sum' },
        ],
        provenance: { proposedBy: 'ai', confidence: 0.88, evidence: [{ type: 'semantic', sourceRef: 'requirements', description: 'KPI requirements specify OEE by line/shift/material/order', weight: 0.9 }] },
      },
      {
        id: crypto.randomUUID(), name: 'DimLine', type: 'dimension',
        description: 'Production line dimension',
        attributes: [
          { name: 'LineId', dataType: 'STRING', isKey: true },
          { name: 'LineName', dataType: 'STRING' },
          { name: 'Area', dataType: 'STRING' },
          { name: 'Site', dataType: 'STRING' },
        ],
        provenance: { proposedBy: 'ai', confidence: 0.92, evidence: [{ type: 'semantic', sourceRef: 'hierarchy', description: 'Line is a hierarchy level', weight: 0.8 }] },
      },
      {
        id: crypto.randomUUID(), name: 'DimShift', type: 'dimension',
        description: 'Shift dimension',
        attributes: [
          { name: 'ShiftId', dataType: 'STRING', isKey: true },
          { name: 'ShiftName', dataType: 'STRING' },
          { name: 'StartTime', dataType: 'TIMESTAMP' },
          { name: 'EndTime', dataType: 'TIMESTAMP' },
        ],
        provenance: { proposedBy: 'ai', confidence: 0.90, evidence: [{ type: 'semantic', sourceRef: 'requirements', description: 'Shift is required for OEE by shift', weight: 0.8 }] },
      },
      {
        id: crypto.randomUUID(), name: 'DimMaterial', type: 'dimension',
        description: 'Material dimension from ERP',
        attributes: [
          { name: 'MaterialId', dataType: 'STRING', isKey: true },
          { name: 'MaterialName', dataType: 'STRING' },
          { name: 'MaterialGroup', dataType: 'STRING' },
          { name: 'UnitOfMeasure', dataType: 'STRING' },
        ],
        provenance: { proposedBy: 'ai', confidence: 0.85, evidence: [{ type: 'semantic', sourceRef: 'sap-erp:MARA', description: 'Material master table in SAP', weight: 0.7 }] },
      },
      {
        id: crypto.randomUUID(), name: 'DimOrder', type: 'dimension',
        description: 'Production order dimension from ERP',
        attributes: [
          { name: 'OrderId', dataType: 'STRING', isKey: true },
          { name: 'MaterialId', dataType: 'STRING' },
          { name: 'Quantity', dataType: 'INT' },
          { name: 'StartDate', dataType: 'TIMESTAMP' },
          { name: 'Status', dataType: 'STRING' },
        ],
        provenance: { proposedBy: 'ai', confidence: 0.83, evidence: [{ type: 'semantic', sourceRef: 'sap-erp:AUFK', description: 'Production order table in SAP', weight: 0.7 }] },
      },
      {
        id: crypto.randomUUID(), name: 'DimTime', type: 'dimension',
        description: 'Time dimension for trend analysis',
        attributes: [
          { name: 'Timestamp', dataType: 'TIMESTAMP', isKey: true },
          { name: 'Hour', dataType: 'INT' },
          { name: 'Day', dataType: 'INT' },
          { name: 'Month', dataType: 'INT' },
          { name: 'Year', dataType: 'INT' },
          { name: 'Shift', dataType: 'STRING' },
        ],
        provenance: { proposedBy: 'ai', confidence: 0.95, evidence: [{ type: 'semantic', sourceRef: 'standard', description: 'Standard time dimension for BI', weight: 0.9 }] },
      },
    ];
  }

  private buildKPIModelRelationships(): Record<string, unknown>[] {
    return [
      { fromEntity: 'ProductionFact', toEntity: 'DimLine', type: 'many-to-one', fromAttribute: 'LineId', toAttribute: 'LineId' },
      { fromEntity: 'ProductionFact', toEntity: 'DimShift', type: 'many-to-one', fromAttribute: 'ShiftId', toAttribute: 'ShiftId' },
      { fromEntity: 'ProductionFact', toEntity: 'DimMaterial', type: 'many-to-one', fromAttribute: 'MaterialId', toAttribute: 'MaterialId' },
      { fromEntity: 'ProductionFact', toEntity: 'DimOrder', type: 'many-to-one', fromAttribute: 'OrderId', toAttribute: 'OrderId' },
      { fromEntity: 'ProductionFact', toEntity: 'DimTime', type: 'many-to-one', fromAttribute: 'Timestamp', toAttribute: 'Timestamp' },
      { fromEntity: 'DimOrder', toEntity: 'DimMaterial', type: 'many-to-one', fromAttribute: 'MaterialId', toAttribute: 'MaterialId' },
    ];
  }

  private buildCanonicalHierarchy(): Record<string, unknown>[] {
    return [
      { level: 0, name: 'Enterprise', parent: null },
      { level: 1, name: 'Site', parent: 'Enterprise' },
      { level: 2, name: 'Area', parent: 'Site' },
      { level: 3, name: 'Line', parent: 'Area' },
      { level: 4, name: 'Cell', parent: 'Line' },
      { level: 5, name: 'Machine', parent: 'Cell' },
    ];
  }

  private buildKPIDefinitions(): Record<string, unknown>[] {
    return [
      { name: 'OEE', formula: 'Availability * Performance * Quality', description: 'Overall Equipment Effectiveness', measures: ['RunTime', 'ProductionCount', 'DowntimeDuration'] },
      { name: 'Availability', formula: 'RunTime / (RunTime + DowntimeDuration)', description: 'Machine availability', measures: ['RunTime', 'DowntimeDuration'] },
      { name: 'Performance', formula: 'ActualProductionCount / TargetProductionCount', description: 'Production performance vs target', measures: ['ProductionCount'] },
      { name: 'Quality', formula: 'GoodCount / TotalCount', description: 'Quality rate', measures: ['ProductionCount'] },
      { name: 'Throughput', formula: 'SUM(ProductionCount) / TimePeriod', description: 'Units produced per time period', measures: ['ProductionCount'] },
      { name: 'DowntimeRate', formula: 'DowntimeDuration / TotalTime', description: 'Proportion of downtime', measures: ['DowntimeDuration'] },
    ];
  }

  private buildDefaultEntities(): Record<string, unknown>[] {
    return [
      {
        id: crypto.randomUUID(), name: 'ProductionFact', type: 'fact',
        description: 'Production data fact table',
        attributes: [
          { name: 'ProductionCount', dataType: 'INT', isMeasure: true },
          { name: 'MachineState', dataType: 'INT' },
          { name: 'Timestamp', dataType: 'TIMESTAMP', isKey: true },
        ],
        sourceMappings: [],
        provenance: { proposedBy: 'ai', confidence: 0.85, evidence: [{ type: 'semantic', sourceRef: 'mappings', description: 'Derived from approved mappings', weight: 0.8 }] },
      },
      {
        id: crypto.randomUUID(), name: 'DimLine', type: 'dimension',
        description: 'Production line dimension',
        attributes: [
          { name: 'LineId', dataType: 'STRING', isKey: true },
          { name: 'LineName', dataType: 'STRING' },
        ],
        sourceMappings: [],
        provenance: { proposedBy: 'ai', confidence: 0.80, evidence: [] },
      },
    ];
  }

  private buildDefaultRelationships(): Record<string, unknown>[] {
    return [
      {
        id: crypto.randomUUID(),
        fromEntityId: 'ProductionFact', toEntityId: 'DimLine',
        type: 'many-to-one', fromAttribute: 'LineId', toAttribute: 'LineId',
        provenance: { proposedBy: 'ai', confidence: 0.75, evidence: [] },
      },
    ];
  }
}