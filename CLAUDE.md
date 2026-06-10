# Satori OS — instrucciones de proyecto

Sistema interno de gestión (clientes, proyectos, tareas, avisos, aprobaciones) sobre **GAS + Google Sheets**.
Topología: un Sheet por cliente + un Sheet MAESTRO agregador. Un solo proyecto GAS (el MAESTRO).

## Mapa antes que relectura
- Índice de archivos, funciones y flujos: **`ARCHITECTURE.md`** (este repo). Leerlo primero.
- Specs aprobadas (fuente de verdad del diseño), en `../Videos analizados/`:
  `ETAPA 0.2 - Spec capa de aprobaciones.md`, `ETAPA 0.3 - Modelo de datos Satori OS.md`,
  `ETAPA 0.4 - Fit-check GAS y decisiones técnicas.md`, `HANDOFF ETAPA 1 - Claude Code.md`.
- Docs por flujo (qué hace / trigger / dependencias / recuperación): `docs/`.

## Innegociables
- Verificar antes de declarar hecho (ejecutar, no asumir).
- AREL: crear Sheets/código = avanzar; envío externo (emails reales) o borrado = frenar y pedir OK.
- Secretos en Script Properties, jamás en código ni Sheets.
- Append-only en registros decididos/históricos (Aprobaciones, Bitácora, Excepciones, Costos).
- Commits chicos, solo el código que cambia.

## clasp
- `clasp push -f` sube `src/` · `clasp pull` baja del editor. scriptId en `.clasp.json`.
- Funciones de arranque manual en el editor: ver `ARCHITECTURE.md` (setup / cargaInicialClientes).
