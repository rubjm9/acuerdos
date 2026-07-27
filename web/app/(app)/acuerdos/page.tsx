import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser, isSecretary } from "@/lib/session";
import { queryAsUser } from "@/lib/db";
import { acuerdoTipoSql } from "@/lib/acuerdo-tipo";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { AcuerdosTable, type AcuerdoRow } from "./acuerdos-table";

export const metadata = { title: "Acuerdos" };

export default async function AcuerdosPage() {
  const user = await requireUser();

  const acuerdos = await queryAsUser<AcuerdoRow>(
    user.id,
    `SELECT ac.id, ac.public_ref, ac.titulo, ac.estado, ac.fecha_adopcion,
            a.numero AS acta_numero, a.año AS acta_año, ac.source_page,
            ${acuerdoTipoSql("ac")} AS tipo,
            (SELECT json_agg(json_build_object('id', ar.id, 'name', ar.name, 'is_restricted', ar.is_restricted) ORDER BY ar.name)
             FROM acuerdo_areas aa JOIN areas ar ON ar.id = aa.area_id
             WHERE aa.acuerdo_id = ac.id) AS areas
     FROM acuerdos ac
     JOIN actas a ON a.id = ac.acta_id
     ORDER BY ac.fecha_adopcion DESC, ac.public_ref DESC
     LIMIT 500`,
    []
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Acuerdos"
        description="Decisiones formales adoptadas por la Asamblea, con su acta de origen."
        action={
          isSecretary(user) ? (
            <Button asChild>
              <Link href="/acuerdos/nuevo">
                <Plus className="size-4" aria-hidden /> Nuevo acuerdo
              </Link>
            </Button>
          ) : undefined
        }
      />

      <AcuerdosTable rows={acuerdos} />
    </div>
  );
}
