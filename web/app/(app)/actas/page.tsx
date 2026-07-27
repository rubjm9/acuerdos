import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { requireUser, isSecretary } from "@/lib/session";
import { queryAsUser } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { ActasTable, type ActaRow } from "./actas-table";

export const metadata = { title: "Actas" };

export default async function ActasPage() {
  const user = await requireUser();

  const actas = await queryAsUser<ActaRow>(
    user.id,
    `SELECT a.id, a.numero, a.fecha, a.año, a.estado,
            (a.file_object_key IS NOT NULL OR a.compilation_año IS NOT NULL) AS has_file,
            (SELECT count(*) FROM acuerdos ac WHERE ac.acta_id = a.id)::int AS n_acuerdos
     FROM actas a
     ORDER BY a.fecha DESC, a.numero DESC
     LIMIT 300`,
    []
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Actas"
        description="Registro de reuniones y documento original de cada una."
        action={
          isSecretary(user) ? (
            <Button asChild>
              <Link href="/actas/nueva">
                <Plus className="size-4" aria-hidden /> Nueva acta
              </Link>
            </Button>
          ) : undefined
        }
      />

      {actas.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No hay actas registradas"
          description="Crea una acta manualmente o utiliza la ingesta de documentos para incorporar el archivo histórico."
          action={
            isSecretary(user) ? (
              <Button asChild variant="outline">
                <Link href="/ingesta">Ir a ingesta</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ActasTable rows={actas} />
      )}
    </div>
  );
}
