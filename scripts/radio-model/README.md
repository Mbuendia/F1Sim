# Modelo propio de la radio: ciclo de mejora (IA7)

El modelo de la radio es un Qwen2.5-0.5B ajustado con el dataset que genera `build-dataset.mjs`. Se convierte a WebLLM sin
MLC con `quantize_mlc.py`, en `C:\Users\Usuario\f1_dataset\radio`. Se publica en Hugging Face en dos versiones:
`gooday89/Radio-Muro-0.5B-q0f16-MLC` (completa) y `gooday89/Radio-Muro-0.5B-q4f16_1-MLC` (ligera). El juego las usa
desde `src/radio/model/manifest.ts` con el commit fijado (IA10).

## El ciclo

1. **Jugar y corregir.** Cuando el piloto pide repetir, el panel de la radio ofrece «¿Era esto?». Al elegir la orden,
   se aplica y la frase se guarda en el navegador con su clase, el JSON que debería haber contestado el modelo y el
   contexto de la carrera. Nada sale del equipo.
2. **Exportar.** En el menú de la carrera, «Radio del muro», pulsa «Exportar correcciones». Se descarga
   `radio-correcciones-AAAA-MM-DD.json`. Las frases con nombres reales o palabras vetadas no salen.
3. **Generar el dataset nuevo** (versión 4, por ejemplo) con las correcciones:
   ```
   node scripts/radio-model/build-dataset.mjs C:/Users/Usuario/f1_dataset/radio --correcciones ruta/radio-correcciones.json
   ```
   Las correcciones entran en `train.jsonl`, sin repetidas. Las que coinciden con una frase de las reservas
   (`tests/fixtures/radio-reserva.json`, `reserva-v2.json` y `reserva-v3.json`) se quedan fuera, para que la medición
   siga limpia. El recuento queda en `stats.json` → `correcciones`.
4. **Entrenar** en tu gráfica, como la v3. Guarda antes la v3 en otra carpeta.
   ```
   ..\venv\Scripts\python.exe train_radio.py
   ..\venv\Scripts\python.exe eval_radio.py f1-radio-lora test3.jsonl
   ```
5. **Fusionar y convertir** a WebLLM, las dos versiones:
   ```
   ..\venv\Scripts\python.exe merge_radio.py
   ..\venv\Scripts\python.exe quantize_mlc.py
   ..\venv\Scripts\python.exe quantize_mlc.py --q0f16
   ```
6. **Medir en el navegador** sin publicar nada (página de prueba con `?local`), o en el juego con
   `?revision=radio-eval&motor=propio&version=q0f16` (y `q4`).
7. **Publicar solo si mejora:** la reserva v3 dentro del juego tiene que superar la versión anterior (hoy 94,1 % la
   completa y 87,1 % la ligera) **sin inventar más órdenes en la charla**. Si no mejora, no se publica.
8. **Subir y fijar.** Sube cada versión a su repositorio de Hugging Face con tu propio inicio de sesión (nunca pegues el
   token en el chat). Después, en `manifest.ts`:
   - pasa el commit anterior de cada versión a `previousRevisions`;
   - pon el commit nuevo en `revision` y su tamaño en `bytes`;
   - si el catálogo de órdenes ha cambiado, actualiza `catalogVersion`.

## Cambio de versión en el juego

- **El jugador que tenía la versión anterior la sigue usando** mientras no descargue la nueva. Ajustes le avisa de que
  hay una versión nueva.
- **La nueva se descarga entera antes de borrar la vieja.** Si la descarga falla, no se pierde nada.
- **Si un modelo es de un catálogo de órdenes anterior al del juego**, las palabras clave van primero y el modelo solo
  ve lo que ellas no entienden.
