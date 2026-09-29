# Q12 — entrega local

Contrato confirmado por el usuario: órdenes Push/Balanced/Save independientes, persistentes en boxes/pausa, pedido/efectivo/motivo visibles; rechazo para retirados/finalizados y sin sustitución por entrada a boxes del rival.

Antes: 17 PASS, 9 FAIL en los cuatro módulos Q12. Después: Q12, boxes UI y recursos suman 48 PASS, 0 FAIL. Tests nuevos pace-orders y pace-ui añadidos antes de implementación; tests acordados sin modificar durante implementación.

Build correcto (aviso de tamaño de bundle >500 kB). Interacción real en navegador: paddock → formación → salida; seleccionar ALO Push y STR Save; pausar mantiene ambas órdenes; activar SC muestra Pedido Push / Efectivo Save / Safety Car para ALO. Captura visual inspeccionada. Los fallos de distribución ya planificados en 2.9 siguen fuera de este cambio.

La calibración exacta de -0.3/+0.4 segundos por vuelta continúa siendo un objetivo aproximado, no un resultado acreditado ni una constante nueva. No se han cambiado los checks ni la planificación del sprint 2.8, ni hecho commit/push.
