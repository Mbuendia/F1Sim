# ES9 — Undercut y overcut contra un rival

*Sprint 16 · 26/11/2026*

## El cálculo

`src/simulation/Undercut.ts` (`undercutGain`, `undercutTable`), con las curvas de neumáticos medidas en el motor (ES1).

- **Undercut de N vueltas:** paro en la vuelta L y el rival en la L + N. Desde L, yo hago N + 1 vueltas con neumáticos
  nuevos y él N vueltas con los usados y luego su primera con los nuevos. Los dos pagamos una parada, así que lo que gano
  es la suma de sus vueltas menos la de las mías, hasta que él sale de boxes.
- **Overcut de N vueltas:** es el undercut que me hace él, cambiado de signo. Si al esperar paso de la caída de mi
  neumático, no se puede.
- La vuelta de salida con el neumático frío la pagamos los dos y se anula (las curvas de ES1 no la incluyen). No se
  cuenta salir a aire limpio o con tráfico.
- La comparación es hasta que el rival sale de boxes, no hasta el final de la carrera: parar antes también alarga la
  tanda siguiente.

## Dónde se ve

- **Plan de carrera:** por cada coche, el rival de referencia (el de delante en parrilla, o el de detrás si se sale
  primero; se puede cambiar), que se supone con su estrategia óptima. Se enseña cuánto se gana o se pierde parando de 1 a
  5 vueltas antes o después que él, con la mejor marcada, y un botón «Parar N vueltas antes que X» que pone la primera
  parada en esa vuelta (sin cruzarse con la siguiente).
- **En carrera:** el aviso de undercut del muro añade cuánto ganaría el de detrás si para ahora y tú a la vuelta
  siguiente («… te gana 0,6 s»).

## Lo que sale con las curvas de ahora

En Barcelona, con el rival parando en la vuelta 21 (medio → blando), parar 2 vueltas antes gana unos 3,6 s y esperar 2
vueltas pierde unos 3,7 s: el blando nuevo es más de 1 s por vuelta más rápido que el medio usado. Con el mismo
compuesto y los dos neumáticos aún en su fase plana, el undercut casi no gana nada. Cuanto antes se para, más se gana
hasta que el rival sale, así que la mejor opción suele ser la de más vueltas antes.
