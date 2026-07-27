import Link from "next/link";
import { FolderOpen, Plus } from "lucide-react";
import { requireUser, isSecretary } from "@/lib/session";
import { queryAsUser } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { ExpedientesView, type ExpedienteRow } from "./expedientes-view";

export const metadata = { title: "Expedientes" };

export default async function ExpedientesPage() {
  const user = await requireUser();

  const expedientes = await queryAsUser<ExpedienteRow>(
    user.id,
    `SELECT e.id, e.titulo, e.descripcion, e.estado, a.name AS area_name,
            (SELECT count(*) FROM expediente_acuerdos ea WHERE ea.expediente_id = e.id)::int AS n_acuerdos,
            (SELECT min(ac.fecha_adopcion) FROM expediente_acuerdos ea
              JOIN acuerdos ac ON ac.id = ea.acuerdo_id WHERE ea.expediente_id = e.id) AS desde,
            (SELECT max(ac.fecha_adopcion) FROM expediente_acuerdos ea
              JOIN acuerdos ac ON ac.id = ea.acuerdo_id WHERE ea.expediente_id = e.id) AS hasta
     FROM expedientes e
     LEFT JOIN areas a ON a.id = e.primary_area_id
     ORDER BY e.updated_at DESC
     LIMIT 300`,
    []
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Expedientes"
        description="Hilos temáticos que agrupan acuerdos relacionados a lo largo de los años."
        action={
          isSecretary(user) ? (
            <Button asChild>
              <Link href="/expedientes/nuevo">
                <Plus className="size-4" aria-hidden /> Nuevo expediente
              </Link>
            </Button>
          ) : undefined
        }
      />

      {expedientes.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No hay expedientes"
          description="Un expediente reúne los acuerdos de un mismo asunto, aunque estén en actas de años distintos."
        />
      ) : (
        <ExpedientesView rows={expedientes} />
      )}
    </div>
  );
}
