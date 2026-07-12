# Evaluación de Impacto (DPIA) — borrador para el DPO

**Tratamiento evaluado**: gestión de acuerdos, actas históricas, expedientes y
tareas de la Asamblea, incluida la digitalización del archivo 1996–2026.

**Necesidad de DPIA**: sí. El corpus incluye categorías especiales del art. 9
RGPD (convicciones religiosas de los miembros; salud en «Salud espiritual»;
situaciones personales en «Casos personales») tratadas de forma sistemática.

## 1. Descripción del tratamiento

- Finalidad: gobernanza interna; registro fiel de decisiones y su seguimiento.
- Interesados: miembros de la comunidad y terceros mencionados en actas.
- Datos: identificativos, organizativos y, en dos áreas restringidas,
  categorías especiales (art. 9.2.d RGPD: tratamiento por organismo sin ánimo
  de lucro con finalidad religiosa relativo a sus miembros).
- Sistemas: descritos en architecture.md y data-flows.md. Todo en la UE.

## 2. Necesidad y proporcionalidad

- Minimización: el título de un acuerdo restringido debe redactarse sin datos
  personales (instrucción en la propia UI); el detalle vive cifrado.
- Limitación de acceso: por rol y por área, con lista explícita de personas
  autorizadas a las áreas restringidas mantenida por Administración.
- Limitación de plazo: retención configurable; el archivo histórico se
  conserva por interés legítimo documental de la institución.

## 3. Riesgos y medidas

| Riesgo | Prob. | Impacto | Medidas |
|---|---|---|---|
| Acceso no autorizado a áreas restringidas | Baja | Muy alto | RLS en BD (no en la app), acceso explícito por persona, cifrado de campo AES-256-GCM, exclusión total de índices de búsqueda, auditoría de lecturas |
| Exfiltración del servidor | Baja | Muy alto | Cifrado en reposo (disco + campo), TLS, servidores UE endurecidos, sin APIs de IA externas, MinIO solo interno |
| Fuga por proveedor de IA | Nula por diseño | — | Modelos open-weight en GPU propia; el compose no define credenciales de ningún proveedor externo |
| Reidentificación en informes | Media | Alto | Los informes excluyen texto de áreas restringidas; exportaciones auditadas |
| Pérdida de datos | Baja | Alto | Copias diarias cifradas a segunda región UE + prueba de restauración periódica |
| Abuso interno | Baja | Alto | Auditoría append-only visible para Administración; principio de mínimo privilegio en roles de BD |

## 4. Derechos de los interesados

- Acceso/rectificación: vía Secretaría, con búsqueda por nombre en el corpus.
- Supresión: valorada caso a caso frente al deber de registro histórico de la
  institución; técnicamente disponible (borrado + rotación de copias).

## 5. Conclusión (a validar por el DPO)

Riesgo residual bajo. Las decisiones estructurales (residencia UE, IA
autoalojada, RLS, cifrado de campo, no-indexación del contenido art. 9,
aprobación humana en ingesta y auditoría reforzada) están implementadas en el
código y son verificables, no promesas de política interna.
