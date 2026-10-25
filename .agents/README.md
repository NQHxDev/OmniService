# OmniServices Agent Hub (`.agents`)

Welcome to the centralized configuration, rules, and skills hub for AI Agents (Antigravity IDE, Cursor, Claude Code, Codex, Gemini CLI, etc.) in the **OmniServices** monorepo.

---

## 📁 Directory Structure

```text
.agents/
├── README.md               # Overview of rules, skills, and workflows (this file)
├── rules/                  # Mandatory engineering guidelines and domain rules
│   ├── api-response-and-error-handling.md
│   ├── codegraph-guidelines.md
│   ├── grpc-proto-versioning-guidelines.md
│   └── swagger-openapi-guidelines.md
├── skills/                 # Agent skills and capability extensions
│   └── mermaid/            # Mermaid diagram generation skill & syntax references
└── scripts/                # Helper automations and agent execution scripts
```

---

## Rules Catalog (`.agents/rules/`)

Each rule file specifies strict architectural conventions, code patterns, and validation requirements:

### 1. [API Response and Error Handling Guidelines](rules/api-response-and-error-handling.md)

- **i18n Standards**: Never hardcode client-facing response messages. All success and error responses must use uppercase i18n keys (e.g., `AUTH.LOGIN_SUCCESS`, `COMMON.INVALID_REQUEST`).
- **Dynamic Values**: Pass dynamic values inside `params: Record<string, unknown>` instead of string concatenation or template literals.
- **Type-Safe Error Constants**: Group and export error codes as `as const` object constants with exported union types.

### 2. [CodeGraph Semantic Intelligence Guidelines](rules/codegraph-guidelines.md)

- **High-Velocity Navigation**: Leverage `@colbymchenry/codegraph` MCP tools (`codegraph_explore`, `codegraph_search`, `codegraph_impact`) instead of blind file-crawling.
- **Blast-Radius Analysis**: Always analyze caller/callee graphs and affected nodes before modifying shared modules or core libraries.

### 3. [gRPC & Proto File Versioning Strategy](rules/grpc-proto-versioning-guidelines.md)

- **Directory Layout**: All `.proto` files reside under explicit version paths (e.g., `proto/v1/auth.proto`, `proto/v2/auth.proto`).
- **Dynamic Package Names**: Package declarations must include versions (`package auth.v1;`), and constants must be constructed via `buildGrpcPackageName(domain, version)`.
- **Breaking Change Discipline**: Maintain backward compatibility; introduce a new version directory (`v2`) for breaking schema changes.

### 4. [Swagger & OpenAPI 3.0 Documentation Standards](rules/swagger-openapi-guidelines.md)

- **English-Only**: All Swagger descriptions, summaries, and schemas must be 100% in professional English.
- **Error Documentation**: Decorate every endpoint throwing exceptions with `@ApiErrorResponse` or `@ApiErrorResponses` from `@common`.
- **Workflow Linkage**: Define explicit `operationId` and OpenAPI 3.0 `links` for multi-step processes (e.g., OTP verification, authentication).

---

## 🛠️ Skills Catalog (`.agents/skills/`)

Skills provide specialized domain capabilities and references for agents:

### 1. [Mermaid Diagram Generator](skills/mermaid/SKILL.md)

- **Purpose**: Generates high-quality, syntactically accurate Mermaid diagrams for architecture, sequence flows, database schemas, and workflows.
- **Supported Types (23+)**:
   - **Flow & Process**: Flowchart, State Diagram, User Journey
   - **Structural**: Class Diagram, ER Diagram, C4 Diagram, Architecture Diagram
   - **Temporal**: Sequence Diagram, Gantt Chart, Timeline, Git Graph
   - **Data Visualization**: Pie Chart, XY Chart, Sankey, Quadrant Chart, Radar Chart, Treemap
   - **Organization & Technical**: Mindmap, Kanban, Block Diagram, Packet Diagram, ZenUML
- **Documentation & References**: Detailed syntax guides are available under `skills/mermaid/references/`.

---

## ⚡ Integration with Root `AGENTS.md`

- Root [`AGENTS.md`](../AGENTS.md) acts as the entrypoint containing primary mandatory rules and guardrails loaded by all agents upon initialization.
- Refer to individual files in `.agents/rules/` and `.agents/skills/` for in-depth specifications and reference material.
