# Autonomous Execution Priority

1. **Bypass Planning Mode Approval**: Cuando el usuario solicite explícitamente trabajar de forma autónoma, usar el comando `/goal`, o pedir que no se le pregunte en cada paso, el agente DEBE omitir la fase de "Obtain User Approval" del Planning Mode.
2. **Artefactos sin feedback**: Si se crea un `implementation_plan.md`, se debe establecer `RequestFeedback: false` en los metadatos del artefacto para no bloquear la ejecución.
3. **Flujo Continuo**: Encadenar las tareas de investigación, planificación, delegación y ejecución directamente sin detenerse a esperar un mensaje del usuario. El agente solo debe detenerse al terminar completamente el objetivo o en caso de un error crítico.
