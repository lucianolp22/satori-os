# Satori OS · PWA launcher (Netlify) — deploy

## Qué es esto (y qué NO es)
Un **sitio estático mínimo** (splash de marca + `manifest` + íconos) cuyo único trabajo es ser **la app instalable en la pantalla de inicio**: al tocarla muestra el splash de Satori y entra a tu Oficina (el web app de GAS).

**Sí resuelve:** el **ícono** de home-screen = tu isologo Satori (PNG hosteado real, no la "S"), splash de marca, y el nombre "Satori OS".

**NO resuelve (honesto):** la **barra blanca / pantalla completa de verdad**. En iOS, cuando la app instalada navega a otro dominio (`script.google.com`), el sistema **suelta el modo standalone** y abre Safari con su barra. Eso es un límite de iOS, no del launcher. La pantalla completa real + offline + push = **Opción C** (migración del front a dominio propio con GAS como API), que es un proyecto aparte y toca seguridad (Bastión).

> **Por qué el launcher es necesario para el ícono:** el web app de GAS corre en un iframe dentro de `script.google.com`; el `<head>` que lee iOS es el de Google, no el nuestro → por eso hoy sale la "S". Este launcher, servido desde **tu** dominio, sí controla el `<head>`.

## Deploy (elegí uno) — runbook canónico: skill `deploy-gas` (bloque Netlify)
**A. Drag & drop (recomendado — nada que configurar):**
1. Entrá a https://app.netlify.com/drop
2. Arrastrá **la carpeta `satori-pwa` entera** (no los archivos sueltos).
3. Netlify te da una URL `https://<algo>.netlify.app`. Listo.

**B. CLI (si querés dominio propio / re-deploys):**
```bash
cd satori-pwa
npx netlify-cli deploy --prod --dir .
# seguí el login; al final te da la URL de producción
```
Dominio propio (opcional): en Netlify → Domain settings → agregar `app.satoriconsultoria.com` (o el que quieras) y apuntar el DNS.

## Instalar en el iPhone
1. Abrí la URL de Netlify en **Safari**.
2. **Compartir → «Agregar a inicio»**. Ahora el ícono es el isologo Satori.
3. Tocá el ícono → splash → entra a la Oficina.

## Seguridad (Bastión)
Launcher **estático**, sin secretos, sin credenciales, sin cambio de auth. La `APP_URL` no es secreta (igual exige login del dominio). No toca el MAESTRO. Safe.

## Archivos
- `index.html` — splash + redirect (editá `APP_URL`).
- `manifest.webmanifest` — nombre, íconos, `display:standalone`, colores.
- `apple-touch-icon.png` (180) · `icon-192.png` · `icon-512.png` · `icon-512-maskable.png` — isologo Satori.
