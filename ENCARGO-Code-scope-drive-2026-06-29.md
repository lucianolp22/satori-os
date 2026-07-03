# ENCARGO · SatoriOS — bajar scope drive → drive.file · 2026-06-29

> Para la conversación de desarrollo de **SatoriOS**. Autocontenido. Disparado por auditoría Bastión 29/06. Es el **must #1 del ROADMAP** (ya estaba identificado en `_bastion/HANDOFF-remediacion-2026-06-22.md`, línea 121). **Ejecución supervisada + test deploy obligatorio.**

## BLUF
`appsscript.json` declara `auth/drive` (acceso a **todo** tu Drive). El código solo usa `DriveApp` en **un** lugar (`src/09_selftest.js`: manda a papelera sheets de cliente que el propio sistema creó). Si esos sheets los crea SatoriOS, **`auth/drive.file` alcanza** y reducís el privilegio drásticamente. **Requiere probar en deploy de test** antes de prod: si algún sheet a borrar NO fue creado por la app, `drive.file` no lo ve y el selftest fallaría.

## Estado
- **Deployado**, `deploymentId` `AKfycbzT5QktUHRuKosiuph5rPHU5sZbv2E5E_DNKRVy_6I`, `access: MYSELF` (solo vos) → blast radius bajo, pero menor privilegio igual aplica (y te cubre si algún día lo abrís a clientes).
- `scriptId` `1M-LYF0GO_Zgh2quGNlCzl4Okcx-DFqQxUhA_jqFqtbJNXYqnIu-2GVnO`, `rootDir: src`.
- **Bajar el scope fuerza re-autorización** (la próxima vez que entres, Google te pide consentir de nuevo). Normal.

## Diff propuesto — `src/appsscript.json`
```diff
   "oauthScopes": [
     "https://www.googleapis.com/auth/spreadsheets",
-    "https://www.googleapis.com/auth/drive",
+    "https://www.googleapis.com/auth/drive.file",
     "https://www.googleapis.com/auth/script.scriptapp",
     "https://www.googleapis.com/auth/script.external_request",
     "https://www.googleapis.com/auth/script.send_mail",
     "https://www.googleapis.com/auth/userinfo.email"
   ]
```

## Verificación previa (antes de tocar nada)
Confirmá que los sheets que borra el selftest los crea la app:
```bash
grep -n -B2 -A2 "DriveApp" src/09_selftest.js
grep -rn "SpreadsheetApp.create\|crearSheetCliente\|insertSheet\|makeCopy" src/
```
Si **todos** los `DriveApp.getFileById(...).setTrashed(true)` operan sobre sheets creados por SatoriOS (`SpreadsheetApp.create` o copia hecha por la app) → `drive.file` los cubre. Si alguno es un sheet ajeno/compartido → quedate en `auth/drive` y documentá por qué.

## Procedimiento (supervisado, con test)
1. Backup: `cp src/appsscript.json src/appsscript.json.bak-2026-06-29`.
2. Aplicar el diff.
3. `clasp push`.
4. **Nueva implementación de TEST** (NO el deployment de prod): *Implementar → Nueva implementación → App web*. Te da una URL `/exec` distinta.
5. Re-autorizar (te pedirá consentir; debe pedir **solo** Drive "archivos creados por la app", no Drive completo).
6. Correr el **selftest** en la versión de test y confirmar que la baja de cliente borra el sheet sin error `PERMISSION_DENIED`.
7. Si verde → promover a la versión de prod (`deploymentId` de arriba) y registrar en `_bastion/CHANGELOG-SEGURIDAD.md`.

## Rollback
`mv src/appsscript.json.bak-2026-06-29 src/appsscript.json && clasp push` + re-deploy. Volvés a `auth/drive`.

## Confianza
7/10 — reducción probable pero **condicionada** al test (de ahí el paso 6). No declarar "hecho" sin el selftest en verde.
