# Registro de actividades de tratamiento — Satori OS

> ## ⚠ BORRADOR — NO ES UN DICTAMEN LEGAL
> Escrito el **21-jul-2026** por Claude Code (cadena integral, fase F6) a partir de lo que hace el
> código, no de lo que dice una norma. Es un **inventario honesto para llevarle a un asesor**, no un
> registro conforme al art. 30 RGPD. Las bases de legitimación y los plazos de retención de acá
> abajo son **propuestas a validar**, no decisiones tomadas. Nadie debe presentarlo ante una
> autoridad ni tratarlo como cumplimiento hasta que un profesional lo revise.

## 0. Contexto que condiciona todo lo demás

Al 21-jul-2026 el sistema está en **piloto, sin datos reales de clientes cargados** (decisión firme:
*"datos reales + RGPD + puesta en marcha = AL FINAL, B8"*). Este registro describe **qué pasaría**
cuando entren, y por eso su valor es que se lea **antes** de que entren — no después.

- **Responsable del tratamiento:** Luciano Lopriore / Satori (consultoría). Datos de contacto y forma
  jurídica: **a completar**.
- **Encargados (sub-encargados) que ya intervienen:**
  | Encargado | Qué recibe | Dónde |
  |---|---|---|
  | **Google Workspace** (Sheets, Apps Script, Drive, Gmail) | todos los datos, en reposo y en proceso | UE/EEUU según config de Workspace — **a verificar** |
  | **Anthropic** (API Claude) | fragmentos de texto para análisis y clasificación | EEUU — **transferencia internacional, a documentar** |
  | **Deepgram · OpenAI · ElevenLabs** (pipeline de voz) | audio y transcripción de lo que dicta Luciano | EEUU — ídem |
  | **Tailscale** | tránsito de red del CM/PWA | — |
- **DPA firmados:** **NO VERIFICADO.** Es probablemente el hueco más grande de este borrador: hay
  cuatro encargados recibiendo datos y ningún acuerdo de encargo de tratamiento confirmado.

## 1. Dónde viven los datos

| Soporte | Qué guarda | Datos personales |
|---|---|---|
| **Sheet MAESTRO** | cartera, proyectos, tareas, avisos, aprobaciones agregadas, costos, Bandeja, agenda, recomendaciones | **Sí** — nombres de clientes, `responsable_lado_cliente`, texto libre de Bandeja y Bitácora |
| **Sheet por cliente** (1 por tenant) | `Datos_operativos`, `KPIs`, `Aprobaciones`, `Umbrales`, `Reglas`, cerebro (`nodos`/`aristas`/`cerebro_log`/`estado_actual`/`objetivos`), `hilo` | **Sí** — según qué cargue el cliente: proveedores, importes, referencias a personas |
| **`Bandeja` (MAESTRO)** | capturas personales de Luciano por voz/CM | **Sí, y de la peor clase**: texto libre sin estructura, puede contener cualquier cosa |
| **Script Properties** | `MAESTRO_ID`, `CLAUDE_API_KEY`, `OWNER_EMAIL`, `VOZ_TOOL_SECRET`, `BACKUP_FOLDER_ID` | secretos, no PII de terceros |
| **Carpeta de backups (Drive)** | copia semanal completa | **Sí — hereda todo lo anterior** |
| **SGIC de cada cliente** (Vehemence, LC Travel, MesaQuince, DAM) | sistema del cliente, **NO es nuestro** | Satori los lee **read-only**; el responsable es el cliente |

## 2. Actividades de tratamiento

| # | Actividad | Categorías de datos | Interesados | Base propuesta (a validar) |
|---|---|---|---|---|
| 1 | **Gestión de la relación con clientes** (cartera, proyectos, tareas, aprobaciones) | identificativos, de contacto, económicos | clientes y sus responsables | **Ejecución de contrato** (art. 6.1.b) |
| 2 | **Análisis operativo por agentes** (Vigía, Analista, Conciliador…) | económicos, operativos del cliente | clientes | **Ejecución de contrato** — es el servicio contratado |
| 3 | **Envío a la API de Claude** para ese análisis | fragmentos de texto y cifras del cliente | clientes | **Ejecución de contrato** + **transferencia internacional a documentar** |
| 4 | **Bandeja personal de captura** (voz/CM) | texto libre; puede incluir menciones a personas | terceros mencionados **sin saberlo** | **Interés legítimo** (art. 6.1.f) — ⚠ el más débil de todos, ver §4 |
| 5 | **Conectores a SGIC de clientes** | agregados de ventas/movimientos | clientes | **Ejecución de contrato**; lectura, nunca escritura |
| 6 | **Voz (Sato)** | audio de Luciano, transcripción | el propio Luciano; terceros que mencione | **Consentimiento del responsable** sobre sí mismo |
| 7 | **Backups semanales** | copia de todo lo anterior | todos | accesorio a 1-6 |
| 8 | **Logs** (`Actividad`, `cerebro_log`, `Access_Log`, `Voz_log`) | quién hizo qué y cuándo | Luciano | **Interés legítimo** (seguridad y auditoría) |

## 3. Retención — PROPUESTA, hoy no hay ninguna política implementada

**Estado real: no existe borrado automático de nada.** El sistema es append-only por diseño y lo que
entra se queda. Lo único que se archiva es `Cola_tareas` (a `Cola_archivo`) y `cerebro_log` (a
`cerebro_log_archivo`, T3-M3) — y **archivar no es borrar**.

| Dato | Retención propuesta | Hoy |
|---|---|---|
| Datos de cliente activo | mientras dure la relación + 6 años (obligación mercantil/fiscal, **a confirmar según jurisdicción**) | indefinido |
| Datos de cliente dado de baja | ídem, después supresión o anonimización | indefinido |
| Bandeja personal | 12 meses (es material de trabajo, no un registro) | indefinido |
| Logs de actividad / cerebro | 24 meses | indefinido (se archivan, no se borran) |
| Backups | 12 semanas rotativas | **a verificar** en `21_backup.js` |
| `Voz_log` | 90 días | **a verificar** |

**Acción para el asesor:** definir plazos y jurisdicción. Después hay que implementarlos — una
política de retención escrita y no implementada es peor que ninguna, porque genera la creencia de
que se está cumpliendo.

## 4. Riesgos identificados — con nombre y apellido

### 4.1 Bandeja: el riesgo estructural (cerrado a medias el 21-jul)

La Bandeja recibe **texto libre** dictado por voz. Puede contener el nombre, el teléfono o el
problema de una persona que nunca supo que existe este sistema. Ninguna base de legitimación cubre
bien eso.

- **Mitigado el 21-jul (B8 #6):** el texto ya **no sale en claro** hacia Anthropic. Se anonimizan
  **emails y teléfonos** (tokens `CLIENTA_EMAIL_001`) antes del prompt.
- **Riesgo que QUEDA, explícito:** los **nombres propios siguen viajando en claro**. Es una decisión
  consciente, no un olvido: el clasificador linkea el item a un tenant reconociendo su nombre, y
  tokenizarlos rompería la funcionalidad. La mitigación real no es técnica — es **no dictar PII de
  terceros a la Bandeja**. Eso es una regla de uso, y las reglas de uso se incumplen.
- **Pendiente para el asesor:** ¿alcanza el interés legítimo? ¿Hace falta una nota de privacidad
  hacia los clientes que cubra las menciones incidentales?

### 4.2 Transferencias internacionales sin documentar

Cuatro proveedores en EEUU (Anthropic, OpenAI, Deepgram, ElevenLabs) reciben datos. **No hay
cláusulas contractuales tipo ni evaluación de transferencia documentadas.** Es un hueco formal, no
una fuga — pero es exactamente el tipo de hueco que se mira en una inspección.

### 4.3 Sin procedimiento de ejercicio de derechos

No hay forma implementada de responder a acceso, rectificación, supresión, portabilidad u oposición.
Con los datos repartidos en N Sheets + backups semanales, **una supresión hoy sería manual y no
verificable**. Con la cartera actual es manejable; a 30 clientes deja de serlo.

### 4.4 Backups: el punto ciego de la supresión

Los backups semanales heredan todo. Borrar un dato del sistema vivo **no lo borra de los backups**.
Cualquier política de supresión tiene que decir qué pasa con ellos, o no es una política.

### 4.5 Secretos en documentación de OTROS proyectos (hallado el 21-jul)

El barrido A3 encontró **tokens de acceso en claro dentro de documentación versionada** de dos
proyectos vecinos: `Vehemence/DOC-Vehemence-ERP-sistema.md` §13 y la tabla "Artefactos" de
`DAM Barber Shop/HANDOFF.md`. **No están en el repo de Satori OS** y no se tocaron. Se reporta acá
porque son sistemas de la misma cartera: **conviene rotarlos y purgarlos del historial.**

## 5. Medidas técnicas ya implementadas (lo que SÍ está)

Esto no es cumplimiento, pero es la parte que ya está construida y que el asesor puede dar por hecha:

- **Control de acceso:** `doGet` y los **27 endpoints** client-callable gateados contra `OWNER_EMAIL`
  (`_soloOwner_`, T3-S1). Sin owner configurado no entra nadie (fail-closed).
- **Aislamiento por tenant:** un Sheet por cliente; el índice del MAESTRO (`Cerebro_index`) guarda
  **solo conteos**, nunca PII.
- **Minimización hacia el LLM:** anonimización de email/teléfono en Bandeja (B8 #6) y `anonimizar()`
  disponible en la ruta de agentes.
- **Hojas sensibles** ocultas y protegidas en cada Sheet cliente (13 pestañas).
- **Secretos** solo en Script Properties, nunca en el repo; con **vencimiento** (T3-S2).
- **Kill switch** total (`20_killswitch.js`) — congela todo el procesamiento.
- **Auditoría:** `Actividad`, `cerebro_log`, `Access_Log`, `Voz_log`.
- **Default-deny** en escrituras (Umbrales sin fila = denegado) y matriz de riesgo (T3-S3).
- **Conectores read-only** con allowlist de hojas por adapter: Satori **nunca escribe** en el sistema
  de un cliente.

## 6. Qué preguntarle al asesor (lista corta y concreta)

1. ¿Qué base de legitimación cubre la **Bandeja** cuando menciona a terceros? ¿Alcanza el interés
   legítimo o hace falta otra cosa?
2. ¿Hacen falta **DPA** con Anthropic, OpenAI, Deepgram y ElevenLabs? ¿Y cláusulas contractuales tipo?
3. **Plazos de retención** por categoría, y jurisdicción aplicable (¿España? ¿Argentina? ¿ambas?).
4. ¿Se necesita **EIPD** (evaluación de impacto)? Hay decisiones automatizadas asistidas por IA sobre
   datos de negocio, aunque **no sobre personas** — importa la distinción.
5. ¿Qué debe decir la **nota de privacidad** hacia los clientes sobre el uso de IA con sus datos?
6. ¿Cómo se resuelve la **supresión en backups**?
7. ¿Hace falta registrar formalmente el art. 30, o el volumen exime?

---

**Próximo paso:** este borrador va al asesor **antes** de cargar el primer dato real de cliente. Ese
orden no es burocracia: es la única manera de que las respuestas cambien el diseño en vez de obligar
a una migración.
