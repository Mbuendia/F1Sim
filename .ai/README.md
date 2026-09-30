# Gestión de cuota y roles opcionales

Objetivo del usuario: terminar una tarea del sprint antes de agotar la cuota, manteniendo calidad aunque cueste más tiempo. La fuente común es AGENTS.md: un agente por defecto, tests previos acordados y validación modular.

| Herramienta | Entrada del repositorio |
| --- | --- |
| Codex y lectores de AGENTS.md | `AGENTS.md`; perfiles nativos en `.codex/agents/*.toml` |
| Claude Code | `CLAUDE.md` |
| Gemini | `GEMINI.md` |
| GitHub Copilot | `.github/copilot-instructions.md` |
| Cursor | `.cursor/rules/project.mdc` y `.cursorrules` de compatibilidad |
| Cline | `.clinerules` |
| Windsurf | `.windsurfrules` |

Los cuatro perfiles se conservan como especialidades opcionales. El principal cubre las perspectivas pertinentes sin crear agentes adicionales. Solo delega trabajo concreto e independiente cuyo valor justifique el contexto adicional; no reparte automáticamente cada petición entre cuatro procesos. No hay cascada de subagentes.

La configuración nativa .codex/config.toml conserva agentes habilitados y un máximo de tres subagentes. Es un techo de capacidad, no una orden de usarlos ni un mínimo. No cambian modelos, permisos o ajustes globales. El ahorro depende de la tarea; no se ha medido una reducción porcentual de cuota.

Para tareas de sprint: acotar una tarea, localizar contrato y módulos, implementar dentro del alcance autorizado y ejecutar la validación pertinente. No convertir cada cambio en una revisión global ni repetir tests sin nuevos cambios. Si una interrupción obliga a retomar, usar un resumen breve de avances y próximo paso.

Estas entradas requieren que cada cliente las cargue. No son un servicio en segundo plano ni interceptan peticiones fuera del repositorio. La revisión previa verificó referencias y estructura de perfiles, no su carga en todos los clientes. Para comprobar otra herramienta, pedir que identifique AGENTS.md, las reglas de tests y la política de un agente por defecto.

Referencias: [instrucciones de proyecto](https://learn.chatgpt.com/docs/agent-configuration/agents-md) y [subagentes](https://learn.chatgpt.com/docs/agent-configuration/subagents).
