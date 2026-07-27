import Link from "next/link";
import { Library, Plus } from "lucide-react";
import { requireUser, isSecretary } from "@/lib/session";
import { queryAsUser } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { PoliticasView, type PoliticaRow } from "./politicas-view";

export const metadata = { title: "Políticas" };

export default async function PoliticasPage() {
  const user = await requireUser();

  const politicas = await queryAsUser<PoliticaRow>(
    user.id,
    `SELECT p.id, p.public_ref, p.titulo, p.resumen, p.estado, a.name AS area_name,
            (SELECT count(*) FROM politica_acuerdos pa WHERE pa.politica_id = p.id)::int AS n_acuerdos
     FROM politicas p
     LEFT JOIN areas a ON a.id = p.primary_area_id
     ORDER BY p.updated_at DESC
     LIMIT 300`,
    []
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Políticas"
        description="Documentos vivos que consolidan la postura de la Asamblea sobre cada asunto, agrupando sus acuerdos."
        action={
          isSecretary(user) ? (
            <Button asChild>
              <Link href="/politicas/nueva">
                <Plus className="size-4" aria-hidden /> Nueva política
              </Link>
            </Button>
          ) : undefined
        }
      />

      {politicas.length === 0 ? (
        <EmptyState
          icon={Library}
          title="No hay políticas"
          description="Una política reúne los acuerdos sobre una misma temática y añade un texto que consolida la postura general."
        />
      ) : (
        <PoliticasView rows={politicas} />
      )}
    </div>
  );
}
