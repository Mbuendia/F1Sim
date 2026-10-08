# F1Sim

Simulador de Fórmula 1 desde la perspectiva del director de equipo. El jugador observa la carrera y gestiona las decisiones de sus dos pilotos.

## Lenguaje

**Muro**:
Puesto de gestión desde el que el jugador da órdenes de ritmo y boxes a los dos pilotos de su equipo.
_Evitar_: Controles de conducción.

**Asistencia discreta**:
Presentación de cifras esenciales acompañadas de explicaciones breves de lo relevante para el equipo, sustentadas en datos reales de la carrera.
_Evitar_: Estratega automático, recomendación garantizada.

**Información esencial de carrera**:
Situación de los dos pilotos respecto a sus rivales, estado de sus neumáticos y próxima parada, y estado general de carrera.

**Consulta de detalle**:
Información que el jugador abre cuando la necesita para profundizar, como sectores, historial de vueltas o detalle mecánico.
_Evitar_: Función eliminada.

**Propuesta del muro**:
Decisión de parada o de ritmo que el estratega sugiere para un piloto del jugador, con su motivo. No se ejecuta hasta que el jugador la acepta; si la descarta, la misma no vuelve hasta la vuelta siguiente.
_Evitar_: Orden automática.

**Delegar en el estratega**:
Interruptor por coche con el que el jugador deja que el estratega ejecute sus decisiones en ese coche, como en los de la IA. Una orden del jugador lo apaga.

**Propuesta urgente**:
Propuesta de parada por pinchazo o neumático destrozado. Sustituye a cualquier propuesta de parada pendiente. El coche del jugador no entra solo.
_Evitar_: Entrada forzada.

**Escapatoria**:
Lo que hay fuera de la pista en un punto: asfalto, grava, hierba o muro. Decide si un accidente es una salida de pista (asfalto) o un abandono, y cuántas vueltas pide el Safety Car.

**Salida de pista**:
Accidente normal en una escapatoria de asfalto: el coche pierde de 4 a 8 segundos y sigue en carrera, con amarilla local.
_Evitar_: Abandono, trompo.

**Trazada**:
Línea por la que ruedan los coches. Se seca antes que el resto del asfalto; quien se sale de ella para adelantar o defenderse pisa más agua.

**Radar**:
Previsión de lluvia hasta 20 minutos, por tramos de tiempo y sectores, con un margen que crece con la distancia. No sabe nada de lo que empieza más allá.

**Nubosidad**:
Parte del cielo cubierta (0 a 100 %). Llega antes de la lluvia o pasa sin llover, y enfría la pista.

**Aquaplaning**:
Accidente por rodar con un neumático que no evacua el agua que hay (slicks desde 1 mm, intermedios desde 3,5 mm). Sigue las reglas de la escapatoria.

**Perfil personalizado / perfil FIA 2025**:
Los dos juegos de reglas. El personalizado fija mínimos de vueltas de Safety Car según la escapatoria; el FIA no tiene mínimo.

## Estado del proyecto

El estado, el orden de tareas y las notas de cada entrega están en `DASHBOARD.md`. El punto exacto para retomar el trabajo en una conversación nueva está al final de `AGENTS.md`.
