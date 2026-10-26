# Development Guidelines & Rules for AI Agents

Welcome to the **OmniServices** monorepo. All AI agents (Antigravity IDE, Cursor, Claude Code, Codex, Gemini CLI, etc.) must adhere to the mandatory workflow rules, domain rules, and skill capabilities documented below.

For complete architectural details and reference catalogs, refer to [.agents/README.md](.agents/README.md).

---

## Mandatory Workflow Rules

1. **Lint Check Before Handover**:
   - After making any code changes, **running `make lint` (or `pnpm run lint`) is mandatory** to verify the entire project.
   - Ensure all linting issues (ESLint, TypeScript-ESLint, Prettier) are completely resolved (0 errors, 0 warnings) before handing over the task to the user.

2. **TypeScript & Type Safety**:
   - Avoid implicit `any` types or returning unsafe `any` values (`@typescript-eslint/no-unsafe-*`).
   - Use explicit typing, `unknown`, or safe type assertions when interacting with external libraries (NestJS microservices, RabbitMQ, Express, Supertest).

3. **Import Paths & Base Path Aliases (`@`)**:
   - **All base paths and cross-module import paths MUST use the `@` prefix** (e.g., `@auth/*`, `@gateway/*`, `@common`, `@common/*`, `@/*`).
   - **Do NOT use long relative paths with parent traversals** (e.g. `../../` or `../../../`).
   - Relative imports (`./`) are ONLY acceptable for direct sibling files within the exact same local folder.
   - When adding new apps or shared libraries, always configure their respective `@` aliases in `tsconfig.json`, `nest-cli.json`, and `package.json` (`moduleNameMapper`).

4. **API Response & Error Handling (i18n Standards)**:
   - **Never hardcode response messages**: All success and error messages returned to clients must use uppercase i18n translation keys (e.g., `AUTH.LOGIN_SUCCESS`, `COMMON.INVALID_REQUEST`).
   - **Dynamic Values via `params`**: Pass dynamic interpolation data in the `params: Record<string, unknown>` object; never use string concatenation or template literals.
   - **Type-Safe Constants**: Error codes must be defined as `as const` objects with exported union types.
   - For detailed specifications and examples, see [api-response-and-error-handling.md](.agents/rules/api-response-and-error-handling.md).

5. **Code Intelligence with CodeGraph (MANDATORY FIRST STEP for Exploration & Refactoring)**:
   - **Mandatory First-Action Policy**:
      - OmniServices indexes the entire monorepo (1,400+ files, 33,000+ relationships) using **CodeGraph** (`@colbymchenry/codegraph`).
      - Whenever investigating architecture, locating symbols, understanding call flows, or planning refactors, **CodeGraph is the MANDATORY FIRST tool AI agents MUST use**.
   - **Dual Interface Protocol (MCP & CLI)**:
      - **If MCP tools are active**: Invoke MCP tools directly (`codegraph_explore`, `codegraph_search`, `codegraph_node`, `codegraph_impact`, `codegraph_callers`, `codegraph_callees`).
      - **If MCP tools are NOT available in your toolset**: **YOU MUST EXECUTE `codegraph` CLI COMMANDS IN TERMINAL/SHELL**:
         | Intent                                        | CLI Command                     | MCP Tool Equivalent |
         | :-------------------------------------------- | :------------------------------ | :------------------ |
         | Search any symbol (class, method, interface)  | `codegraph query <symbol>`      | `codegraph_search`  |
         | Build task context & relevant code blocks     | `codegraph context "<task>"`    | _CLI only_          |
         | Deep explore symbols & call paths in one call | `codegraph explore "<query>"`   | `codegraph_explore` |
         | Inspect symbol source & callers/callees       | `codegraph node <symbol>`       | `codegraph_node`    |
         | Upstream callers of a symbol                  | `codegraph callers <symbol>`    | `codegraph_callers` |
         | Downstream functions called by a symbol       | `codegraph callees <symbol>`    | `codegraph_callees` |
         | Blast radius before editing shared code       | `codegraph impact <symbol>`     | `codegraph_impact`  |
         | Find tests affected by modified files         | `codegraph affected [files...]` | _CLI only_          |
   - **Mandatory Blast Radius Check Before Refactoring**:
      - Before modifying any shared library (`libs/*`), contract (`libs/contracts/*`), DTO, entity, or public service method, agents **MUST run `codegraph impact <symbol>`** (or `codegraph_impact`) to verify all upstream callers and downstream dependents across microservices.
   - **Mandatory Graph Synchronization (`make codegraph-sync`)**:
      - After creating, moving, renaming, deleting files, or making significant code modifications, agents **MUST run `make codegraph-sync`** (or `pnpm run codegraph:sync` / `codegraph sync`) to synchronize and refresh the local knowledge graph.
      - Always ensure the graph is synchronized before performing blast-radius impact analysis or handing over completed tasks.
   - **Strictly Prohibited Anti-Patterns**:
      - **DO NOT** run recursive `grep -rn`, `find .`, or sequentially read dozens of files across `apps/*` and `libs/*` without querying CodeGraph first.
      - Grep/read_file should ONLY be used as a secondary fallback for non-code assets (e.g., `.env`, `.yaml`, raw configs) or when CodeGraph specifically returns no matches.
   - For detailed setup, CLI commands, and workflows, see [.agents/rules/codegraph-guidelines.md](.agents/rules/codegraph-guidelines.md).

6. **Swagger & OpenAPI 3.0 Documentation Standards**:
   - All Swagger annotations and descriptions **MUST be 100% in professional English**.
   - Every API endpoint that can throw exceptions must be documented with `@ApiErrorResponse` or `@ApiErrorResponses` from `@common`.
   - Multi-step workflows (OTP registration, password change, etc.) must define explicit `operationId` and OpenAPI 3.0 `links`.
   - For detailed rules and code examples, see [swagger-openapi-guidelines.md](.agents/rules/swagger-openapi-guidelines.md).

7. **gRPC & Proto File Versioning Strategy**:
   - All `.proto` files must be organized under version subdirectories (e.g., `proto/v1/auth.proto`).
   - Package declarations must explicitly include the version (`package auth.v1;`).
   - Constants must be dynamically composed using domain and version tokens (`buildGrpcPackageName(domain, version)`). Do not hardcode package name strings.
   - For detailed rules and evolution lifecycle, see [grpc-proto-versioning-guidelines.md](.agents/rules/grpc-proto-versioning-guidelines.md).

8. **MCP Todo Task Management**:
   - When receiving a request to handle or process a task on MCP Todo formatted like `todo-99377` (e.g. `todo-<id>`), use the command `omni-todo --help` to learn how to interact with and manage tasks on MCP Todo.

---

## Agent Skills Catalog (`.agents/skills/`)

Agents should leverage installed skills in `.agents/skills/` when executing domain-specific tasks:

- **Mermaid Diagram Generator** ([.agents/skills/mermaid](.agents/skills/mermaid/SKILL.md)):
   - Generates verified, high-quality Mermaid diagrams across 23+ diagram types (Architecture, Sequence, C4, Flowchart, ER, Class, Gantt, State, etc.).
   - Whenever designing or explaining architecture, data models, or service interactions, agents should reference the syntax specs in `.agents/skills/mermaid/references/` to produce accurate visual diagrams.

- **Security Audit** ([.agents/skills/security-audit](.agents/skills/security-audit/SKILL.md)):
   - Defensive, source-first security audit harness developed by Cloudflare.
   - Orchestrates reconnaissance, coverage-led vulnerability hunting, candidate validation, structured output (`findings.json`), and target-neutral reporting.
   - Use for security questions, focused vulnerability reviews, security audits, or penetration testing requests.
