# WHITELIST_SATO_WEB — sitios autorizados para `web_search` + `web_fetch`

> **Editable en caliente.** El agente la relee por `mtime` con TTL de 60 s: cambiás este archivo y
> Sato cambia sin reiniciar nada (mismo patrón que `SATO-IDENTIDAD.md`, F3).
> **La fuente única es este archivo.** No hay copia en Sheets ni en el código.

## Cómo funciona

Sato no puede buscar en "internet". Puede buscar **dentro de una categoría declarada**, y la
categoría se traduce a la lista de dominios de abajo, que viaja como `allowed_domains` en la
llamada a la API de Anthropic. El filtro lo aplica **el servidor de Anthropic**, no nosotros: un
resultado de un dominio que no está en la lista no llega ni a existir.

Reglas del formato (contrato de la API, verificado 27/08/2026):

- Dominio pelado, **sin esquema**: `aeat.es`, no `https://aeat.es`.
- Los subdominios están cubiertos: `gencat.cat` alcanza a `hisenda.gencat.cat`.
- `web_search` acepta un path (`example.com/blog`); `web_fetch` quiere hostname pelado.
- Sin IPs, sin TLDs sueltos, sin nombres de una sola etiqueta (`localhost`).
- Una línea por dominio, con `- ` adelante. Todo lo que empiece con `#` es comentario.

Para agregar una categoría nueva: agregá el encabezado `nombre:` y sus dominios. No hace falta
tocar código — pero **sí hay que nombrarla en la regla N10 de `SATO-IDENTIDAD.md`**, o Sato no va
a saber que existe.

## Presupuesto

`tope_usd_mes` es el techo de gasto de búsquedas del mes corriente. Cada búsqueda cuesta **$0,01**
($10 por 1.000 búsquedas, tarifa oficial de la Claude API al 27/08/2026). **`web_fetch` no tiene
costo adicional** — sólo los tokens del contenido traído — así que no consume presupuesto.

Al 80% del tope Sato avisa. Al 100% la tool devuelve `presupuesto_agotado` y Sato lo dice tal cual
(regla N9: no inventa resultados). El contador se resetea solo el día 1 de cada mes.

```
tope_usd_mes: 10
```

## Dominios

```yaml
fiscal_es:
  - aeat.es
  - agenciatributaria.gob.es
  - boe.es
  - dogc.gencat.cat
  - hisenda.gencat.cat
  - seg-social.es
  - sepe.es
  - atencionciudadana.gencat.cat

fiscal_ar:
  - afip.gob.ar
  - arca.gob.ar
  - infoleg.gob.ar
  - boletinoficial.gob.ar
  - argentina.gob.ar

noticias_negocio:
  - expansion.com
  - cincodias.elpais.com
  - eleconomista.es
  - cronista.com
  - ambito.com

clima_utilidades:
  - aemet.es
  - smn.gob.ar
  - weather.com

cotizaciones:
  - bcra.gob.ar
  - xe.com
  - x-rates.com

tecnica_os:
  - docs.claude.com
  - docs.anthropic.com
  - platform.claude.com
  - developers.google.com
```
