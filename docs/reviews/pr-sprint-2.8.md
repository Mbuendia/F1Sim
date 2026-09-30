## Sprint 2.8: calidad de simulación, boxes reales, muro táctico y DRS oficial

Integra en `main` el Sprint 2.8 completo (Q1–Q23), validado por el usuario el 30/09/2026. Suite: **1313 PASS / 0 FAIL (73 módulos)**; `npm run build` correcto; dashboard e índice alineados.

### Novedades para el jugador
- **Boxes reales (Q20):** entrada, recorrido y salida del pit lane de los 23 circuitos desde OSM y planos FIA; 8 trazados redibujados.
- **Neumáticos coherentes (Q21):** mismo icono y colores de compuesto en toda la app; nueva silueta F1.
- **Chasis cenital (Q22):** desgaste por rueda, aviso por debajo del 25 % y DRS abierto/cerrado.
- **Clasificación viva (Q23):** flechas ▲▼ de cambio de posición y pulso de boxes/cola.
- **Ritmo calibrado (Q12):** Push −0,19/−0,28/−0,37 s y Save +0,46/+0,56/+0,28 s por vuelta (Barcelona/Monza/Mónaco).
- **Reincorporación estimada (Q13):** fila fantasma en la torre y marcador en el minimapa, con fuente e intervalo; modelo de pérdida validado en 23 circuitos (error ≤ 1,05 s), consciente de SC/VSC y double stack.
- **Safety Car físico (Q14):** sale del pit lane, espera despacio al líder, que lo alcanza frenando de forma progresiva, y vuelve por el pit lane.
- **Banderas azules graduales (Q15):** el doblado cede de forma progresiva hacia el lado libre.
- **ERS visible y verificado (Q16):** batería y despliegue en el dock; límites FIA de 2/4 MJ por vuelta y 120 kW; reinicio de contadores al entrar en boxes.
- **D20 honesto (Q17/Q18):** catálogo de beneficios legales (box preparado, equipo en alerta, informe del ingeniero); la cuenta atrás del modal funciona.
- **DRS oficial (Q19):** detecciones y zonas FIA 2025 en los 23 circuitos; sin espera extra tras VSC y una vuelta tras SC.

### Notas para revisar
- Tests acordados revisados con autorización: `rejoin.mjs` (pérdida simulada y recargo double stack) y C3/C4 de `safety-car.mjs` (SC por el pit lane).
- Hallazgos de la revisión en local registrados para Sprint 2.9 (R35–R39): paradas forzadas con bandera roja, aviso azul corto, informe del ingeniero vacío con roja, animación de posición y muro que tapa el coche seguido.
- Las herramientas de análisis quedan en `scratch/`; los PDF de la FIA no se incluyen.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
