# Instrucciones del proyecto

Lee AGENTS.md: es la fuente común de las tres reglas de tests y de la política de cuota. Trabaja con un agente por defecto para completar la tarea del sprint solicitada. No actives automáticamente los cuatro roles. Delega solo subtareas concretas e independientes que justifiquen el contexto adicional; los delegados no crean agentes.

Reutiliza decisiones y evidencia, lee fragmentos relevantes y valida módulos afectados. No cambies tests acordados para obtener verde ni amplíes alcance, planificación o checks sin autorización. La autonomía no elimina el contrato previo de tests. Perfiles opcionales y límites en .ai/README.md.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update src` to keep the graph current (AST-only, no API cost). The graph covers only `src/`: `graphify update .` would rebuild it over the whole repository (images, scratch, tests). A post-commit hook also rebuilds the changed files after each commit.
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
