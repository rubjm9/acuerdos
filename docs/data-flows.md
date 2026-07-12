# Flujos de datos (documentación para el DPO)

Todo tratamiento ocurre en servidores de la UE bajo nuestro control, salvo la
única excepción señalada (§4). Ningún contenido de actas, acuerdos o tareas se
envía nunca a servicios de terceros ni a APIs de IA externas.

## 1. Alta y consulta de contenido

```
Usuario (navegador, TLS) → Next.js → Postgres (RLS con la identidad del usuario)
```
- Cada petición fija `app.user_id`; las políticas RLS filtran por rol y por
  acceso a área (`user_area_access`).
- Acuerdos con área restringida: texto cifrado AES-256-GCM en `full_text_enc`;
  el descifrado ocurre solo tras pasar RLS, y la lectura queda auditada.

## 2. Archivos de actas

```
Subida: navegador → Next.js → MinIO (bucket actas, versionado, UE)
Descarga: Next.js verifica rol (admin/secretaría/miembro) → audita → URL firmada 5 min
```
El PDF de un acta puede contener contenido restringido; por eso la descarga del
original se limita por rol y se registra siempre.

## 3. Ingesta asistida

```
PDF → MinIO → Worker Python → (opcional) OCR local → segmentación →
LLM AUTOALOJADO (vLLM, nodo GPU propio) → candidatos → revisión humana → BD
```
- El LLM y los embeddings (TEI) corren en nuestra GPU; el tráfico es HTTP
  interno entre contenedores. Sin conexión saliente.
- El extractor determinista (sin LLM) nunca sugiere áreas restringidas.

## 4. Única excepción: autenticación (Google Workspace OIDC)

```
Navegador ⇄ Google (OIDC) → Next.js recibe: email, nombre, sub
```
- **Qué sale**: únicamente metadatos de identidad (email del dominio bahai.es).
- **Qué NO sale**: ningún contenido de la plataforma.
- Mitigaciones: restricción de dominio (`hd`), verificación en servidor,
  usuarios pre-aprovisionados por Administración, DPA/SCC de Google Workspace.
- Alternativa aprobable sin cambio de arquitectura: IdP autoalojado
  (Keycloak/Authentik); Auth.js lo soporta como proveedor OIDC genérico.

## 5. Notificaciones

- **In-app**: solo en nuestra BD.
- **Email**: SMTP de proveedor UE; contiene título de la tarea y enlace, nunca
  contenido restringido.
- **Web Push**: el payload viaja cifrado (estándar Web Push) al push service
  del navegador del usuario (Apple/Google/Mozilla); contiene solo título breve
  y URL interna. No se envía contenido de áreas restringidas por este canal.

## 6. Auditoría y retención

- `audit_log` es append-only (trigger + revocación de UPDATE/DELETE).
- Eventos sobre áreas restringidas se marcan `restricted=true` e incluyen las
  **lecturas** y **descargas**, no solo escrituras.
- Copias de seguridad cifradas en una segunda región UE (ver backups.md);
  la retención de copias es de 30 días diarios + 12 meses mensuales
  (configurable). El borrado definitivo (derecho de supresión) se propaga en el
  siguiente ciclo de rotación completo.

## 7. Inventario de encargados de tratamiento

| Encargado | Datos | Base |
|---|---|---|
| Proveedor IaaS UE (Hetzner/OVH/Scaleway) | Todos (cifrados en reposo) | DPA del proveedor, servidores UE |
| Google Ireland Ltd. (solo login) | email, nombre, id de cuenta | DPA Google Workspace |
| Proveedor SMTP UE | email del destinatario + título de aviso | DPA del proveedor |
