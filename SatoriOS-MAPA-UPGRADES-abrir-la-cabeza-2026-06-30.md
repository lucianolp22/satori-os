# Satori OS — Mapa de upgrades + "abrir la cabeza" · 30/06/2026

> Ideación grounded en el estado real (MOC + handoffs al 29/06). No repite el backlog: lo **reorganiza por valor** y suma lo que nadie marcó. Lente Satori: estructura + espíritu, y el sistema debe **liberarte**, no atarte.

## BLUF

Satori OS está **sorprendentemente completo** para ser interno (aprobaciones, agentes, orquestación, cerebro, conectores, ruteo de costo, orbe, voz — todo en prod). Por eso el riesgo hoy NO es "le falta". Es **"feature-rich, results-thin"**: muchas capas impresionantes y el lazo a **resultados** todavía abierto, todo colgando de **tu cuenta personal**, y con el "wow" (voz/orbe) adelante de lo que mueve plata. El **20% que da el 80%** no es nuevo brillo: es **medir si sirve, no romperse, y depender menos de vos**. Confianza global del diagnóstico: **8/10**.

## 0. Dónde está parado (síntesis honesta)

Ya en producción: E1 (clientes/proyectos/tareas) · E2+ (aprobaciones default-deny + tope API $25/mes + cola + 13 agentes) · E8a (Director + Cerebro + Salud) · Bandeja · Capa de Dirección (North Star + brief) · Capa de Conectores (lee SGIC de Vehemence sin credenciales) · ruteo Sonnet/Haiku · orbe 3D · **voz en el Command Center**. Triggers 07:00 + cada 5 min.

La incomodidad: es **mucha máquina** para validar todavía si **cambia decisiones y mueve KPIs**. Y depende de `luciano@` (single point of failure + el sistema te necesita).

## 1. La pregunta correcta antes de upgradear

"Mejor / funciona mejor / mejores resultados" se descompone en **3 ejes** — y todo upgrade se prioriza por estos, no por novedad:

| Eje | Pregunta | Hoy |
|---|---|---|
| **Confiable** | ¿No se rompe, no se va de costo, no alucina sobre datos de cliente? | parcial (hay tope + Salud, falta visibilidad/telemetría) |
| **Útil** | ¿Sus salidas cambian decisiones y mueven plata? | **sin medir** (el gran hueco) |
| **Sostenible / autónomo** | ¿Depende menos de vos? ¿Protege tu foco/paz? | débil (cuelga de tu cuenta y tu atención) |

## 2. Quick wins — bajo riesgo, alto retorno (el 20%)

| Upgrade | Por qué | Esfuerzo | Conf |
|---|---|---|---|
| **Telemetría costo/token/errores** en `llamadaAPI` + tira en Salud | ves el gasto y los fallos antes de que duelan (ya hay HANDOFF-retrofit-costo) | S | 9 |
| **`CAPABILITIES.md` autogenerado** legible por el agente en runtime | cierra el gap "self-knowledge" (Trillion): el agente sabe qué puede y deja de alucinar capacidades | S | 8 |
| **Feedback "¿sirvió?" de 1 clic** en cada brief/aviso | semilla del lazo de resultados; empezás a medir utilidad real **hoy** | S | 8 |
| **Command palette ⌘K** (ninja-keys, GAS-ok) | velocidad de operación; menos clics | S | 8 |
| **Seguridad pendiente**: `drive`→`drive.file` · blindaje prompt-injection runners · token fuera de query | ya están en backlog/ENCARGO; cierran superficie sobre datos de cliente | S–M | 9 |
| **Degradado honesto de la voz** (los ~13s) + estados de carga | la latencia GAS no se va; que la espera no se sienta rota | S | 7 |

## 3. "Funciona mejor" — confiabilidad y observabilidad

- **Estado del sistema (para humano):** una vista "salud" real — última corrida, triggers vivos, errores de la semana, costo del mes vs tope, agentes que fallaron. El Health loop existe; falta **que vos lo veas de un vistazo**. (M · 8)
- **Memoria caliente/fría acotada + security-scan del Cerebro** (Hermes #1-2): el Cerebro crece; sin gestión se ensucia, encarece y puede filtrar. Acotar ventana + escanear lo que entra. (M · 8)
- **Resiliencia de cuenta (pre-mortem):** hoy todo cuelga de `luciano@` (Advanced Protection ya te pegó una vez). Si esa cuenta se bloquea, ¿qué pasa con los clientes? → plan de continuidad: `os@` multi-tenant (diferido), backup del MAESTRO fuera de tu Drive, `SISTEMA_PAUSADO` documentado como kill-switch operativo. (M · 8)

## 4. "Mejores resultados" — lo que mueve plata (UI/UX + producto)

- **El lazo de resultados (lo más importante y lo menos obvio).** Hoy los agentes **opinan al vacío**: recomiendan y nadie sabe si funcionó. Cerrar: *recomendó → se hizo (sí/no) → el KPS se movió (sí/no)*. Con eso el sistema **aprende qué consejo sirve** y deja de ser "asistente que habla" para ser "sistema que mejora el negocio". Los datos ya están (North Star + KPIs en Capa de Dirección); falta el lazo. **Esta es la respuesta no obvia.** (M–L · 7)
- **Briefs que deciden, no que informan:** cada brief termina en 1-3 acciones con **botón de aprobación** (ya tenés el motor). Cierra idea→ejecución dentro del propio sistema. (M · 8)
- **UI/UX zen-futurista del Command Center** (DESIGN v2): jerarquía "lo accionable primero", brief diario como hero, **semáforo de negocio por cliente**, drill-down, estados completos, claro/oscuro, PWA mobile-first. El **orbe como estado del sistema** (latiendo distinto si hay alerta), no como decoración. El "wow" dosificado. (M · 8)
- **Productizar:** el sistema bien hecho **es** tu demo de ventas. El "Diagnóstico Satori" + un cockpit por cliente = oferta recurrente, no solo interno. (estratégico)

## 5. "Abrir la cabeza" — apuestas grandes (con el costo dicho)

| Apuesta | Qué suma | El riesgo honesto |
|---|---|---|
| **Lazo de auto-mejora con consentimiento** (Hermes #3) | el sistema propone mejoras a sus propios prompts/criterios y vos aprobás | poderoso y peligroso; exige el motor de aprobaciones + Bastión sí o sí |
| **Observatorio multiagente** (Etapa 0, ya blueprinted) | lecturas puras 0-API: mercado/competencia/oportunidades por cliente | scope creep; arrancar mínimo (lecturas, sin actuar) |
| **SOUL / alma Satori** (Hermes #4) | valores/identidad como capa que modula tono y criterio de los agentes (coherencia de marca) | misticismo inflado; mantener aterrizado y medible |
| **Voz 24/7 en la nube** (ya en roadmap) | disponibilidad real, no "encenderla a mano" | es **wow antes que resultado**; hacela cuando el uso lo pida |
| **Multi-tenant `os@`** (diferido) | habilita voz/sistema multi-cliente | recién cuando escales fuera de vos |
| **Canal Telegram** (puerta remota) | capturar/consultar desde el teléfono | webhook público = Bastión obligatorio |

## 6. La verdad incómoda (lente Satori + pre-mortem)

**Pre-mortem — el sistema fracasa si:** (a) se vuelve un juguete que impresiona pero no cambia decisiones; (b) el costo/complejidad supera el valor; (c) depende tanto de vos que **no te libera** — y eso **contradice la tesis Satori** (el sistema debería bajar el techo-del-líder, no subirlo); (d) un agente actúa mal sobre datos de un cliente (reputación + RGPD).

**80/20 sin vueltas:** el orbe y la voz son lo más **visible**, pero **no** lo que da resultados. Lo que da resultados es **lazo de resultados + confiabilidad + briefs accionables**. Recomiendo priorizar eso y **dosificar el wow** (que ya lo tenés).

**Sostenibilidad como métrica:** la pregunta de cierre de cada upgrade no es "¿es más potente?" sino **"¿te devuelve tiempo, foco y paz?"**. Si te demanda más de lo que te libera, está mal calibrado.

## 7. Secuencia recomendada (MoSCoW + T-shirt + confianza)

- **MUST (ahora):** telemetría costo/errores (S·9) · seguridad pendiente `drive.file`/injection/token (S–M·9) · feedback "¿sirvió?" (S·8) · `CAPABILITIES.md` (S·8).
- **SHOULD (próxima ventana):** lazo de resultados (M–L·7) · Estado del sistema visible (M·8) · UI v2 Command Center (M·8) · briefs accionables (M·8) · memoria caliente/fría + scan (M·8).
- **NICE (cuando el uso/escala lo pidan):** voz 24/7 · auto-mejora con consentimiento · Observatorio · SOUL · multi-tenant `os@` · Telegram.

## 8. Próximo paso (elegís)

1. **Construyo el norte UI** del Command Center (prototipo zen-futurista, como los de los clientes) para que **veas** los upgrades de §4.
2. **Bajo a handoff** 1-2 de los MUST (telemetría / feedback "¿sirvió?") para tu thread de desarrollo.
3. **Convoco al Consejo** para validar las apuestas grandes de §5 antes de comprometer esfuerzo.

> Nota: casi todo esto YA vive disperso en tus handoffs (Hermes→E8, retrofit-costo, Observatorio, PIPELINE). El valor de este mapa es el **orden por resultados** y marcar el hueco que nadie nombró: **el lazo de resultados**.
