# PROPUESTA · CRM PRO — Satori OS — 25/08/2026

> Research destilado de 10 CRMs + 3 vertientes cross-industria, filtrado contra los 8 gates
> Satori. Base: CRM ya construido en `/dev` (tanda madrugada 25-ago, harness 676/0). Esta
> propuesta define la tanda SIGUIENTE — no toca lo hecho. Sin código, sin ENCARGO todavía.
> Fuentes primarias/secundarias citadas inline; afirmaciones sin doble fuente marcadas.
> Generado por Cowork (Satori) · research por 5 agentes paralelos, escalera de costo cero.

---

## §0 · BLUF

**Si hacés UNA sola cosa de esta propuesta: M1 — "último contacto" auto-sellado con días-sin-contacto en cada card.** El hallazgo más sólido de todo el research (HBR, auditoría de 2.241 empresas) es que el gap más grande y más arreglable de la venta no es responder rápido: es que **el 23% de los leads no recibe respuesta NUNCA**. Todo lo demás — scoring, secuencias, señales — es especulativo al lado de eso. Y el diferencial estructural de Satori ya existe y ningún CRM del mercado lo puede copiar: **el pipeline al lado del SGIC del cliente** — Salesforce ve el deal; vos ves el negocio real del cliente. La tanda Pro no agrega features de moda: cierra el lazo captación + retención con tres piezas que reusan módulos ya construidos (`Actividad`, `30_correo`, `29_vigilancia`).

---

## §1 · Ranking MoSCoW final (máx 8 · ordenado por palanca)

| # | Función | De dónde sale | Por qué pasa el gate | North Star | Costo |
|---|---|---|---|---|---|
| **M1** | **Último contacto + días-sin-contacto** por card, auto-sellado desde `Actividad` (reunión, tablero, movimiento, dossier = contacto) | Patrón mínimo que sobrevive en CRMs caseros ([Capsule](https://capsulecrm.com/blog/customer-tracking-spreadsheet/), [Zapier](https://zapier.com/blog/spreadsheet-crm/)) + el 23%-nunca-respondió de [HBR 2011](https://hbr.org/2011/03/the-short-life-of-online-sales-leads) + activity-based selling de Pipedrive | Anti-rollup: «40 días sin contacto con SIP» → lo llamo esta semana. Complementa `prox_accion` (lo planeado) con lo OCURRIDO — juntas cierran el lazo | `retenciones` (ningún candidato se enfría en silencio) | **S** |
| **M2** | **Timeline Gmail por cliente** en la solapa Comercial: threads del candidato/cliente LINKEADOS (no copiados), vía el módulo `30_correo` ya construido (T7, `gmail.readonly`, hoy apagado). Staging + confirmación humana para asociar thread→cliente | El "box" de Streak + timeline de HubSpot (lo más elogiado de ambos) + la lección Copper: auto-capture SIN confirmación = asociaciones erradas + cementerio ([efficient.app](https://efficient.app/apps/copper)) | Anti-rollup: antes de la reunión veo la última conversación real sin buscar en Gmail. GAS lee Gmail por API — sin extensión frágil (el punto de falla documentado de Streak/Copper). Bastión: scope `gmail.readonly` ya aprobado, 0 escritura, links no contenido | `retenciones` (mejor conversación → mejor cierre) | **M** |
| **M3** | **Señal de retención en cards de activos**: semáforo del "camino de éxito" KAIROS del mes (¿entregó datos? ¿hubo reunión mensual? ¿compromisos al día?) reusando `29_vigilancia` + SGIC. NO un score numérico | El anti-health-score de [Lincoln Murphy](https://www.sixteenventures.com/health-scores-are-destroying-your-signal/): los scores agregados promedian la señal; medir contra el camino de éxito por etapa. El CRM hoy solo mira captación — la retención ES la otra mitad de `ingresos_recurrentes` | Anti-rollup: «LC Travel sin datos del mes y sin reunión agendada» → priorizo ESA reunión antes de que la retención se caiga. Churn prevenido = ingreso protegido | `ingresos_recurrentes` (protege lo firmado) | **M** |
| **S4** | **Todas las oportunidades visibles por cliente** (no solo "la propuesta viva"): `recurrentes_propios` ya soporta N filas por cliente; la card y la solapa muestran la lista completa (S1 ganado · S2 activo · S4 en propuesta) | Vertiente 1: deal ≠ cuenta ([HubSpot data model](https://blog.hubspot.com/marketing/crm-data-model), [Attio](https://attio.com/help/reference/attio-101/attios-data-model/understanding-attio-data-model)). El camino KAIROS ES multi-deal: S1→S2→S3 con S4 en cualquier punto | Anti-rollup: veo que DAM tiene S2 activo pero nunca le propuse S4 → la puerta de evolución (Paso 4.5 de la Guía) se vuelve visible | ambas (upsell = más recurrente por cliente ya ganado) | **S** |
| **S5** | **Motivo de pérdida obligatorio** al mover a `perdido` (+1 columna `motivo_perdido`, 1 línea, y una vista simple de motivos) | Práctica estándar de todos los CRMs serios; a 20 candidatos cada pérdida es el 5% del universo — el aprendizaje por unidad es altísimo | Anti-rollup: 3 pérdidas por «precio» → reviso el empaquetado del Nivel 1; 3 por «timing» → cadencia de recontacto a 90 días | `retenciones` (mejora la tasa de cierre futura) | **S** |
| **S6** | **Recontacto programado para perdidos/en_pausa**: al perder por timing, un tap → `prox_accion_fecha` a +90 días. El brief ya canta vencidas — los "muertos" reviven solos | Filosofía Close/Efti: "never stop following up", check-ins trimestrales a calificados no convertidos ([Mixergy](https://mixergy.com/interviews/close-the-50-million-year-crm/)) | Anti-rollup: `perdido` deja de ser un cementerio — es una cola fría con fecha. Cero código nuevo casi: reusa columnas y brief existentes | `retenciones` (el no-de-hoy es el sí-de-marzo) | **S** |
| **C7** | **Dossier enriquecido**: el dossier de reunión suma automáticamente los últimos 3 contactos (M1) + threads recientes (M2) + oportunidades abiertas (S4) | Composición de lo anterior; el dossier ya existe | Solo si M1+M2+S4 entran — es su consolidación natural | ambas | **S** |
| **C8** | **Export/backup del pipeline** a `.md` mensual al Cerebro (la cartera como snapshot versionado) | Lección Streak: la data debe ser tuya y exportable SIEMPRE ([saascrmreview](https://saascrmreview.com/streak-crm-review/)) — en Sheets ya casi lo es; esto lo hace explícito | Gate 8 (sostenibilidad): si el OS muriera mañana, la cartera vive en texto plano | indirecto | **S** |

**El 20/80:** M1 + M3. Uno protege la captación (nada se enfría en silencio), el otro protege la retención (nada se cae en silencio). Los dos son señal pasiva — el OS muestra, vos movés — y los dos reusan datos que el sistema YA registra.

---

## §2 · Steelman por MUST

**M1 · Último contacto**
- **A FAVOR (el más fuerte):** es la única feature de toda la industria con evidencia académica directa (HBR: el 23% sin respuesta es el mayor destructor de pipeline) y cuesta una columna + un sello en funciones que ya escriben en `Actividad`. Ratio evidencia/costo imbatible.
- **EN CONTRA (el más fuerte):** con 20 candidatos y memoria fresca, vos YA sabés a quién no llamaste hace un mes — el dato podría ser redundante con tu propia cabeza, y una card más cargada es ruido visual. **Réplica:** la memoria funciona hoy con 20; el sistema se construye para 40, y el costo del falso negativo (un candidato enfriado) es una retención perdida. Además el sello es pasivo: si no lo mirás, no molesta.

**M2 · Timeline Gmail**
- **A FAVOR:** es la feature más elogiada de los dos CRMs Google-nativos estudiados (Streak, Copper) y tu stack la obtiene por API sin heredar su punto de falla documentado (la extensión de Chrome). El módulo `30_correo` ya pasó Bastión y re-consent — el costo marginal de seguridad es cero.
- **EN CONTRA:** es la pieza más cara (M) de la tanda, requiere encender `correo_on` (decisión aparte que venís posponiendo desde TC-6), y el caso Copper advierte: la asociación automática thread→cliente se equivoca. Si el staging de confirmación te resulta tedioso, se abandona y queda medio muerto. **Réplica:** por eso staging con confirmación es parte del diseño y no un opcional; y si a las 4 semanas no confirmás threads, la feature se apaga sola (gate honesto, patrón build-in-public).

**M3 · Señal de retención**
- **A FAVOR:** el CRM que solo mira captación es medio CRM — tu North Star es ingreso RECURRENTE, y el recurrente se defiende en la Fase 6 (SOSTENER), no en la venta. Murphy da el diseño exacto anti-ruido: señal por camino de éxito, no score. Y la infraestructura (vigilancia, SGIC, informe mensual) ya existe — es un render nuevo de datos viejos.
- **EN CONTRA:** riesgo de duplicar la vigilancia (29_vigilancia ya semaforiza) y de violar el anti-rollup si el semáforo comercial dice lo mismo que el operativo. **Réplica:** la señal es distinta — vigilancia mira el negocio del cliente (¿sus ventas caen?); esto mira la RELACIÓN (¿me entregó datos? ¿nos reunimos?). Si en el diseño fino resultan iguales, M3 se reduce a mostrar el semáforo existente en la card — y eso cuesta casi nada.

---

## §3 · Pre-mortem (3 meses después, fracasó — ¿qué pasó?)

1. **Murió por staging.** M2 pedía confirmar threads y nunca hubo 5 minutos; la cola de staging creció, la timeline quedó vacía, la solapa Comercial perdió credibilidad ("esto está siempre desactualizado"). **Contramedida:** M2 entra ÚLTIMO, solo tras 4 semanas de M1+M3 vivos; staging con tope (máx 10 pendientes, después deja de capturar y avisa).
2. **Ruido de semáforos.** Entre etapa, encaje, vencidas, sin-próximo-paso, retención y foco, la card tiene 6 señales — y una card con 6 señales no tiene ninguna (la lección Murphy aplicada a nosotros mismos). **Contramedida:** presupuesto de señal por card: máx 2 visibles (la más urgente de captación, la más urgente de retención); el resto vive en la solapa.
3. **El CRM mejoró y las ventas no.** 3 meses de features y `retenciones_formalizadas` sigue igual — porque el cuello nunca fue el software: fue agendar las conversaciones (F3 §7: la tabla y las 3 letras siguen sin completarse). **Contramedida:** regla de prelación — esta tanda NO se construye hasta que la tanda actual esté promovida a prod Y haya al menos 1 propuesta presentada usando el CRM. El software sigue a la venta, no al revés.

---

## §4 · Second-order effects

- **Ficha 360:** la solapa Comercial crece (timeline + oportunidades + señal). Riesgo de solapa-monstruo → mantener el orden Oportunidad→Señal→Timeline y colapsar la timeline por defecto.
- **Brief:** M1 agrega potencialmente una línea ("N candidatos >30 días sin contacto"). Misma disciplina que `_carteraLineasBrief_`: solo si hay algo, tope de 3 nombrados.
- **Sato:** la fuente `cartera` devuelve más campos (último contacto, oportunidades) — gratis para el modo comercial de Sato; cuidar que `anonimizar()` cubra los campos nuevos.
- **HQ/Números:** S4 no cambia `hqNumeros` (ya suma por moneda); solo se re-renderiza la misma hoja.
- **`30_correo`:** M2 lo reutiliza pero con destino nuevo (vínculo a cliente, no Bandeja) → revisar que el dedupe `Correo_visto` no colisione entre ambos usos.
- **selfTest:** cada columna nueva toca los asserts de cola de `Clientes` (D44a2 otra vez) y D19c si hay endpoints nuevos. La deuda D45-live YA existente crece si no se salda antes.

---

## §5 · Lo obvio + lo NO obvio

**Lo obvio** (lo que cualquier consultor de CRMs te diría): agregar email tracking, secuencias de follow-up automáticas, lead scoring y un dashboard de forecast. Las cuatro están en §6 — rechazadas con razones.

**Lo NO obvio** (solo se ve leyendo tus valores y tu escala): el CRM de Satori no compite en captación — compite en **profundidad de relación por cliente**. Los CRMs del mercado optimizan el embudo porque sus usuarios tienen miles de leads y minutos por lead; vos tenés 20 candidatos y AÑOS por cliente. Por eso las piezas ganadoras son las de memoria y continuidad (último contacto, timeline, recontacto a 90 días, señal de retención) y no las de velocidad y volumen. Y la segunda no-obviedad: **tu mejor feature de CRM ya está construida y no es del CRM** — es el SGIC. "Te muestro TU negocio ordenado" es el pitch que ningún Salesforce puede dar en la Etapa 2 de recepción. El CRM Pro no es más software: es el guion que conecta lo que el OS ya sabe con la conversación que tenés que tener.

---

## §6 · Lo que RECHAZO explícitamente (features de moda que NO entran)

| Feature | Quién la tiene | Por qué NO entra (gate violado) |
|---|---|---|
| **Email open/click tracking** | HubSpot, Streak, Close | **Bastión + legal:** CNIL ([jul 2026](https://www.uniconsent.com/blog/cnil-email-tracking-pixels-recommendation)) y Garante ([abr 2026](https://www.aoshearman.com/en/insights/tracking-pixels-in-emails-the-garantes-new-guidelines-and-requirements-for-businesses)) exigen consentimiento previo bajo ePrivacy — misma base legal en España. Y la señal está rota: Apple MPP infla opens 35-60% ([Validity](https://www.validity.com/blog/case-closed-the-mystery-of-declining-email-open-rates/)). Ilegal sin consentimiento E inútil. Doble no. |
| **LinkedIn scraping / auto-enrichment** | Clay, Folk (extensión), Apollo | **Bastión + valores:** en la UE el perfil público sigue siendo dato personal (Art. 14 RGPD, deber de información que nadie cumple); LinkedIn multada €310M ([DPC](https://phonearena.com/news/linkedin-334-million-fine-eu-gdpr-violations_id164121)); ToS prohíben. Mirar el perfil a mano y anotar: lícito y suficiente a tu escala. |
| **Lead scoring ML / forecast ponderado** | Salesforce, HubSpot, Pipedrive | **Escala:** con 20 candidatos y 1-2 propuestas vivas es teatro estadístico. Tu criterio + encaje KAIROS de 4 checks le gana con menos mantenimiento. |
| **Secuencias automáticas multicanal** | Close, HubSpot, Attio | **Nivel-0 + valores:** "el CRM te vende por vos" es exactamente la dependencia que KAIROS le saca a sus clientes — sería incoherencia doctrinal venderla puertas adentro. La evidencia además muestra que el freno humano se termina agregando igual: Clay tuvo que construir Sandbox, aprobaciones Slack y delays DESPUÉS de quemar créditos de sus usuarios ([changelog](https://www.clay.com/changelog)). |
| **Health score numérico** | Gainsight, Attio, Copper | **Anti-rollup:** los scores agregados promedian la señal y avisan tarde ([Murphy](https://www.sixteenventures.com/health-scores-are-destroying-your-signal/)). M3 es su reemplazo correcto: señal por camino de éxito, binaria y accionable. |
| **Website visitor identification** | Leadfeeder, HubSpot | **Escala + Bastión:** identifica empresas que visitan tu web — tus candidatos son cafeterías de Barcelona que conocés en persona. Resuelve un problema que no tenés, con costo de consentimiento ePrivacy. |
| **Extensión de Chrome sobre Gmail UI** | Streak, Copper | **Sostenibilidad:** el punto de falla #1 documentado de ambos (performance, bugs de años sin arreglar, rompe Gmail — [Capterra Streak](https://www.capterra.com/p/124465/streak/), [Capterra Copper](https://www.capterra.com/p/141642/Copper/reviews?page=2)). GAS lee Gmail por API en batch: mismo valor, cero fragilidad. |
| **Objeto Lead separado de Contacto** | Salesforce, Zoho | **Escala:** el patrón "lead conversion" duplica entidades y es criticado hasta dentro de sus ecosistemas ([Zoho community](https://help.zoho.com/portal/en/community/topic/why-is-leads-treated-separately-to-contacts-and-companies?page=138)). El roster con `etapa_comercial` ya resuelve la distinción sin segunda tabla. |

---

## §7 · Mapeo al stack existente (cero módulos nuevos)

| Pieza | Se apoya en | Qué se toca |
|---|---|---|
| M1 último contacto | hoja `Actividad` (`feed_` ya registra) + `Clientes` | +1 col `ultimo_contacto` (o derivada de Actividad sin columna — decidir en diseño fino); sello en `moverEtapaComercial`/`propuestaRegistrar`/ingesta de tableros; render en `carteraPipeline` + card |
| M2 timeline Gmail | `30_correo.js` (T7, construido, apagado) + `Correo_visto` | destino nuevo thread→cliente con staging; render en solapa Comercial; **gate previo: decisión de encender `correo_on`** |
| M3 señal retención | `29_vigilancia.js` + SGIC + Informe Mensual F2 | función pura que evalúa el "camino de éxito" del mes por cliente activo; render en card + solapa |
| S4 oportunidades | `recurrentes_propios` (N filas por cliente YA soportadas) | solo render: card + solapa listan todas |
| S5 motivo pérdida | `Clientes` + `moverEtapaComercial` | +1 col `motivo_perdido`; prompt de 1 línea al mover a perdido |
| S6 recontacto 90d | `prox_accion_fecha` + brief (todo existente) | un botón "recontactar en 90d" al perder por timing |
| C8 export mensual | Cerebro + trigger existente de briefs | un `.md` snapshot de cartera al mes |

Ningún módulo nuevo. Un solo gate externo real: `correo_on` (M2).

---

## §8 · Riesgo si NO se hace nada (steelman del status quo)

Honesto: **el CRM base que está en `/dev` ya es suficiente para mover las 2 métricas North Star a tu escala actual.** Tiene pipeline, próxima acción con fecha, foco semanal, propuesta→firma con ciclo medido, y el brief cantando vencidas. La evidencia del research sobre CRMs caseros es unánime: a 20 cuentas **ningún límite es técnico — todos son conductuales** (el sistema muere cuando nadie lo actualiza, no cuando le falta una feature). La retención Vehemence USD 250 se cierra con una conversación, no con esta tanda. Por eso la regla de prelación del §3.3: primero promover lo construido y presentar 1 propuesta real con él; esta tanda Pro entra después, como consolidación. Si no se hace nunca, el costo real es acotado: se pierde M1/M3 (la protección contra el enfriamiento silencioso), que es exactamente el riesgo que crece cuando la cartera pase de 20 a 40. No urgente hoy; valioso en 6 meses.

---

## §9 · Confianza y supuestos

| Función | Confianza | Nota |
|---|---|---|
| M1 último contacto | **9/10** | Evidencia más sólida del research; costo mínimo |
| M3 señal retención | **8/10** | El diseño fino debe evitar duplicar vigilancia |
| S5 motivo pérdida · S6 recontacto | **8/10** | Baratas, estándar, alineadas a Close/Efti |
| S4 oportunidades múltiples | **7/10** | Depende de cuánto upsell real haya en 2026 |
| M2 timeline Gmail | **6/10** | La más valiosa Y la más riesgosa (staging + gate correo_on) |
| C7/C8 | **7/10** | Consolidaciones, sin riesgo |

**Supuestos (máx 3):** (1) la tanda actual de `/dev` se promueve a prod tal como está — esta propuesta la asume viva; (2) `correo_on` es una decisión que tomás vos aparte — M2 no la fuerza; (3) los hallazgos de reviews (G2/Capterra) representan razonablemente a usuarios reales — Reddit no fue accesible desde el entorno de research (limitación declarada por 3 de los 5 agentes).

**Limitaciones declaradas del research:** r/CRM y r/sales inaccesibles (403) — compensado con HN de primera mano, G2/Capterra y founders; tesis First Round/a16z específicas de sales-stack boutique: no encontradas; "70% de CRMs fracasan" rastreado hasta su origen: **folklore** (Butler Group 2002, enterprise) — el rango defendible es ⅓ a ½ y el fracaso es de adopción (~60%), no de plataforma.

---

## Preguntas para Luciano (desbloquean la próxima tanda)

1. **¿Encendemos `correo_on`?** Es el gate real de M2 (timeline Gmail). Si la respuesta es "todavía no", M2 sale de la tanda y queda M1+M3+S4+S5+S6 — una tanda 100% sin decisiones externas.
2. **¿La regla de prelación va?** Propongo: esta tanda NO se construye hasta que (a) la actual esté en prod y (b) hayas presentado ≥1 propuesta real usando el CRM. ¿Confirmás, o preferís construir ya?
3. **M3, ¿semáforo propio o reusar el de vigilancia?** Si te alcanza con VER el semáforo operativo existente en la card comercial (opción barata), M3 baja de M a S y la tanda entera queda en costo S+S+S+S+S.

---
*Fuentes completas inline. Research: 5 agentes paralelos (Salesforce/HubSpot/Pipedrive · Close/Streak/Copper · Attio/Folk/Clay · low-code caseros · vertientes cross), escalera costo cero (WebSearch+WebFetch), triangulación ≥2 fuentes salvo marca [single-source]. Purga adversarial aplicada antes de entrega.*
