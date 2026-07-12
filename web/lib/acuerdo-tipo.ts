/**
 * Expresión SQL de la clasificación DERIVADA de un acuerdo, con prevalencia
 * Política → Expediente → Eventual. `alias` es una constante controlada por el
 * código (nunca entrada de usuario). Bajo RLS los EXISTS solo ven asociaciones
 * a políticas/expedientes visibles por el usuario.
 */
export function acuerdoTipoSql(alias = "ac"): string {
  return `CASE
    WHEN EXISTS (SELECT 1 FROM politica_acuerdos pa WHERE pa.acuerdo_id = ${alias}.id) THEN 'politica'
    WHEN EXISTS (SELECT 1 FROM expediente_acuerdos ea WHERE ea.acuerdo_id = ${alias}.id) THEN 'expediente'
    ELSE 'eventual'
  END`;
}

/** Condición WHERE para filtrar por tipo (usa un parámetro $n con el tipo o NULL). */
export function acuerdoTipoFilterSql(paramIndex: number, alias = "ac"): string {
  return `($${paramIndex}::text IS NULL OR ${acuerdoTipoSql(alias)} = $${paramIndex})`;
}
