# Connexy — User Guide

## What is Connexy?

Connexy is a manufacturing data discovery, mapping, and semantic-modeling platform. It ingests read-only metadata from your ERP, MES, historian, SCADA, and machine systems, then uses AI to:
- Identify relevant data objects
- Propose source-to-target mappings (with confidence + evidence)
- Generate governed semantic models
- Detect gaps in your data coverage
- Produce validation-ready documentation

All AI recommendations are **proposals** — a human reviews, accepts, edits, or rejects every one.

## Quick Start

### 1. Create a Project
1. Click **+ New Project** on the Projects page
2. Choose a workflow type:
   - **MES-to-Machine** — connect shop floor equipment to MES
   - **KPI Dashboard** — build a data model for KPIs (e.g. OEE)
3. Describe your goal in plain language (e.g. *"identify the data needed to connect packaging line 1 to MES for production count, machine state, downtime reason, and batch context"*)
4. Optionally set a project price (for cost cap enforcement — AI spend is capped at 3%)
5. Click **Create Project**

### 2. Connect Data Sources
1. Click **+ Add Connector**
2. Select a connector type (SAP ERP, Siemens Opcenter, AVEVA PI, OPC UA, etc.)
3. Connexy reads **metadata only** — it never writes to your source systems
4. Click **Run Discovery** to start the AI pipeline

### 3. Watch the Discovery Pipeline
The Discovery Console shows live progress as Connexy:
- **Plan** — parses your intent into structured requirements
- **Ingest** — reads metadata from connected systems (read-only)
- **Classify** — categorizes each metadata object
- **Map** — proposes source-to-target mappings with confidence + evidence
- **Model** — generates a semantic model (entities, relationships)
- **Score** — detects gaps and computes coverage
- **Review** — pauses for human approval

### 4. Review Recommendations
1. Go to the **Review** tab
2. For each mapping:
   - Click **Evidence** to see why the AI proposed it
   - Click **Accept** if correct, **Reject** if wrong, or edit to modify
   - Use **Bulk Accept** for high-confidence items
3. Review detected gaps — acknowledge, resolve, or mark as won't-fix
4. Review the semantic model — approve or publish

### 5. Export
1. Go to the **Export** tab
2. Generate a package:
   - **Full Package** — mappings + model + gaps + compliance dossier
   - **Mapping Spec** — just the mappings
   - **Validation Dossier** — ALCOA+ compliance, read-only evidence, audit trail
3. Download the package for your validation team

## Key Concepts

### Confidence Scores
Every recommendation includes a confidence score (0.0–1.0):
- **High (≥0.8)** — green chip — strong match, likely correct
- **Medium (0.6–0.8)** — yellow chip — probable match, review recommended
- **Low (<0.6)** — red chip — weak match, manual review required

### Evidence Trail
Every mapping shows the evidence behind the AI's recommendation:
- **Naming** — source name matches target name
- **Semantic** — object category matches requirement
- **Metadata** — data type, unit, enum compatible
- **Lineage** — source lineage traced

### Read-Only Guarantee
Connexy **never writes to, modifies, or controls** any source system. This is enforced:
- Structurally: no write methods exist on the connector interface
- At runtime: every connector config must declare `readOnlyAssertion: true`
- In tests: 63 automated tests verify `canWrite: false` across all 12 connectors

### Audit Trail
Every action (AI proposal, human accept/reject, model approval) is recorded in an immutable, hash-chained audit log. The chain can be verified at any time.

### Cost Control
AI model spend is tracked per project and per call. Set a project price to enforce the 3% spend cap (BRD KPI). The dashboard shows real-time spend by model tier.

## Workflows

### Workflow A — MES-to-Machine Integration Discovery
Use when you need to connect shop floor equipment (PLC tags, OPC UA nodes) to a MES system.

1. Connect machine-side connectors (PLC tags, OPC UA) and MES connectors (Opcenter, FactoryTalk)
2. Run discovery — Connexy identifies which tags map to which MES fields
3. Review mappings, accept correct ones
4. Export the mapping spec for your integration team

### Workflow B — KPI Dashboard Data-Model Discovery
Use when you need to build a data model for KPIs (OEE, throughput, downtime rate).

1. Connect ERP (for material/order data) and historian (for production/machine data)
2. Describe the KPIs you need (e.g. "OEE by line, shift, material, and production order")
3. Run discovery — Connexy generates a star schema (facts + dimensions + KPI formulas)
4. Review the model, approve, and export

## Connectors

| Connector | Type | Tier |
|-----------|------|------|
| Metadata File | PLC tag exports, specs | file |
| SAP ERP / S/4HANA | Enterprise resource planning | erp |
| Siemens Opcenter | MES (formerly Camstar) | mes |
| Rockwell FactoryTalk | MES | mes |
| Werum PAS-X | MES (pharma) | mes |
| Tulip | MES (cloud-native) | mes |
| Sepasoft | MES for Ignition | mes |
| AVEVA PI | Historian | historian |
| AVEVA Wonderware | Historian/SCADA | historian |
| Ignition | SCADA | scada |
| OPC UA | Machine interface | machine |
| PLC Tags | PLC tag export | machine |

All connectors support fixture mode (for development) and live mode (when credentials are provided).

## AI Models

| Tier | Model | Used For |
|------|-------|----------|
| small | Llama 3.1 8B Fast | Intent parsing, classification |
| large | GLM-5.2 | Mapping reasoning, model generation, gap detection |
| medium | Llama 3.3 70B | Escalation (rare, ambiguous cases) |
| embedding | BGE Large | Metadata semantic search |

All inference runs on Cloudflare Workers AI — no data leaves the Cloudflare boundary.

## Troubleshooting

**No metadata objects after ingest:** Ensure the connector is configured and click "Test Scan" to verify connectivity.

**All mappings have low confidence:** The source metadata may not match the intent well. Try adjusting the intent description or adding more connectors.

**Cost cap exceeded:** Increase the project price or reduce the scope of the discovery.

**Workflow stuck at "review":** This is expected — the workflow pauses until a human approves the mappings via the Review page.