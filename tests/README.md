# Tests por funcionalidad

Desde la raíz del repositorio, con las dependencias existentes instaladas:

```sh
node test-suite.mjs --list
node test-suite.mjs --module box-orders
node test-suite.mjs --task Q8
node test-suite.mjs --task Q9,Q10
node test-suite.mjs --module scenario-monza
node test-suite.mjs --sprint 2.8 --json tests/results/sprint-2.8.json
node test-suite.mjs --regression
node test-suite.mjs --all --json tests/results/latest.json
```

Para una modificación localizada, seleccionar el módulo afectado y los consumidores relevantes. Por ejemplo, una modificación de posición afecta a `world-position`, `geometry-rendering` y la funcionalidad que la modifica; una orden de boxes afecta a `box-orders`, `double-stack` y `box-ui`. No hace falta ejecutar todos los módulos en cada cambio.

Sin argumentos se conserva la ejecución completa de la entrada antigua por compatibilidad. `--all` expresa esa intención explícitamente. No se han cambiado scripts npm, compilación, CI ni checks del dashboard. Los filtros se intersectan; los valores separados por comas se unen dentro de cada filtro. `--task Q6` selecciona la tarea base; las ampliaciones tienen sus propios identificadores `Q6.1`–`Q6.21`.

Cada módulo se ejecuta en un proceso independiente y puede correrse solo. Una excepción, un timeout, un módulo vacío o una selección desconocida terminan con código distinto de cero. Un fallo no impide evaluar los módulos siguientes. Los módulos nuevos aíslan casos con `test(...)`; los bloques históricos conservan sus aserciones originales y una excepción aborta ese módulo con FAIL. El JSON distingue aserciones y errores del ejecutor. No hay `skip`, `todo` ni fallos convertidos en PASS.

| Área | Módulos principales |
| --- | --- |
| Neutralización y estado de carrera | `safety-car`, `race-state`, `neutralization-motion`, `reset-lifecycle` |
| Neumáticos, combustible y motor | `tires-strategy`, `resources`, `pace`, `pace-contract` |
| Boxes y estrategia | `pit-stop`, `pit-lane`, `pit-route`, `box-orders`, `double-stack`, `rejoin`, `rejoin-contract`, `box-ui` |
| Geometría, coches, cámara y selección | `track-geometry`, `geometry-rendering`, `world-position`, `car-rendering`, `track-width`, `finish-line` |
| Trazada y engomado | `racing-line`, `racing-line-geometry` |
| Circuitos y escenario | `teams-sectors`, `scenarios`, `scenario-rendering`, `scenario-<circuito>` |
| Banderas, DRS y eventos | `blue-flags`, `drs-permissions`, `luck-rewards` |
| Presentación React | `box-ui`, `race-ui` |
| Regresiones de robustez/documentación | `robustness`, `documentation` |

La migración preservó las 327 aserciones que pasaban antes de esta revisión, incluidos los cambios locales previos. Se corrigió el `catch` vacío del predictor Q13 y se eliminaron rutas absolutas de la máquina. Las comprobaciones antiguas basadas en comentarios/colores del código se conservan como regresiones estructurales, no como prueba de comportamiento completo. La nueva comparación Q12 usa el mismo piloto y cinco vueltas reales; la antigua comparación entre pilotos distintos no sirve por sí sola para atribuir el efecto al ritmo.

`AUDIT.md` documenta presencia de funcionalidades, resultados y límites. Un módulo verde acredita sus casos ejecutados, no una certificación completa de la tarea, del reglamento ni de la interfaz. Los tests de React son renderizado SSR: no simulan clics, timers, desmontaje o StrictMode. Los tests Canvas registran operaciones reales, pero no sustituyen una revisión visual de edificios/arte ni un benchmark. No se han inventado puntos oficiales de detección DRS, contratos de un libro ERS inexistente ni cronómetros meteorológicos.

Las tres reglas vinculantes están en `../AGENTS.md`: primero test acordado; después implementación sin alterar ese test para hacerla pasar; verificación y resultados por módulos. Esta entrega es una revisión de tests autorizada, no una implementación de las funcionalidades que sus fallos revelan.
