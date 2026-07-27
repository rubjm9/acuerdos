import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, FolderOpen, Link2, Lock, Pencil, Plus } from "lucide-react";
import { requireUser, isSecretary } from "@/lib/session";
import { queryAsUser } from "@/lib/db";
import { decryptField } from "@/lib/crypto";
import {
  formatFecha,
  formatFechaLarga,
  LINK_TIPOS,
  LINK_TIPOS_INVERSO,
  type AcuerdoEstado,
  type AcuerdoTipo,
  type LinkTipo,
  type TareaEstado,
} from "@/lib/domain";
import { acuerdoTipoSql } from "@/lib/acuerdo-tipo";
import { audit } from "@/lib/audit";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { TipoBadge } from "@/components/tipo-badge";
import { Library } from "lucide-react";
import { AreaBadges, type AreaChip } from "@/components/area-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createLink, removeLink, confirmLink } from "../actions";

type AcuerdoRow = {
  id: string;
  public_ref: string;
  titulo: string;
  full_text: string | null;
  full_text_enc: Buffer | null;
  fecha_adopcion: string;
  estado: AcuerdoEstado;
  is_restricted: boolean;
  source_page: number | null;
  acta_id: string;
  acta_numero: number;
  acta_año: number;
  tipo: AcuerdoTipo;
  areas: AreaChip[] | null;
};

type ExpedienteRow = { id: string; titulo: string };
type PoliticaRow = { id: string; titulo: string; public_ref: string };

type LinkRow = {
  id: string;
  tipo: LinkTipo;
  confirmed: boolean;
  direction: "out" | "in";
  other_id: string;
  other_ref: string;
  other_titulo: string;
  other_fecha: string;
};

type TareaRow = {
  id: string;
  titulo: string;
  estado: TareaEstado;
  fecha_vencimiento: string | null;
  assignee: string | null;
};

export default async function AcuerdoPage({ params }: PageProps<"/acuerdos/[id]">) {
  const user = await requireUser();
  const { id } = await params;

  const [acuerdos, links, tareas, expedientes, politicas] = await Promise.all([
    queryAsUser<AcuerdoRow>(
      user.id,
      `SELECT ac.id, ac.public_ref, ac.titulo, ac.full_text, ac.full_text_enc,
              ac.fecha_adopcion, ac.estado, ac.is_restricted, ac.source_page,
              ac.acta_id, a.numero AS acta_numero, a.año AS acta_año,
              ${acuerdoTipoSql("ac")} AS tipo,
              (SELECT json_agg(json_build_object('id', ar.id, 'name', ar.name, 'is_restricted', ar.is_restricted) ORDER BY ar.name)
               FROM acuerdo_areas aa JOIN areas ar ON ar.id = aa.area_id
               WHERE aa.acuerdo_id = ac.id) AS areas
       FROM acuerdos ac JOIN actas a ON a.id = ac.acta_id
       WHERE ac.id = $1`,
      [id]
    ),
    queryAsUser<LinkRow>(
      user.id,
      `SELECT l.id, l.tipo, l.confirmed, 'out' AS direction,
              o.id AS other_id, o.public_ref AS other_ref, o.titulo AS other_titulo,
              o.fecha_adopcion AS other_fecha
       FROM acuerdo_links l JOIN acuerdos o ON o.id = l.to_acuerdo_id
       WHERE l.from_acuerdo_id = $1
       UNION ALL
       SELECT l.id, l.tipo, l.confirmed, 'in' AS direction,
              o.id, o.public_ref, o.titulo, o.fecha_adopcion
       FROM acuerdo_links l JOIN acuerdos o ON o.id = l.from_acuerdo_id
       WHERE l.to_acuerdo_id = $1
       ORDER BY other_fecha`,
      [id]
    ),
    queryAsUser<TareaRow>(
      user.id,
      `SELECT t.id, t.titulo, t.estado, t.fecha_vencimiento,
              COALESCE(u.name, c.name) AS assignee
       FROM tareas t
       LEFT JOIN users u ON u.id = t.assignee_user_id
       LEFT JOIN committees c ON c.id = t.assignee_committee_id
       WHERE t.acuerdo_id = $1
       ORDER BY t.created_at`,
      [id]
    ),
    queryAsUser<ExpedienteRow>(
      user.id,
      `SELECT e.id, e.titulo FROM expedientes e
       JOIN expediente_acuerdos ea ON ea.expediente_id = e.id
       WHERE ea.acuerdo_id = $1 ORDER BY e.titulo`,
      [id]
    ),
    queryAsUser<PoliticaRow>(
      user.id,
      `SELECT p.id, p.titulo, p.public_ref FROM politicas p
       JOIN politica_acuerdos pa ON pa.politica_id = p.id
       WHERE pa.acuerdo_id = $1 ORDER BY p.titulo`,
      [id]
    ),
  ]);

  const ac = acuerdos[0];
  if (!ac) notFound();

  // Texto: descifrar si es restringido (RLS ya garantizó autorización).
  // Toda lectura de contenido restringido queda en la auditoría reforzada.
  let texto = ac.full_text ?? "";
  if (ac.is_restricted && ac.full_text_enc) {
    texto = decryptField(Buffer.from(ac.full_text_enc));
    await audit(user.id, "view", "acuerdo", ac.id, { restricted: true });
  }

  const secretary = isSecretary(user);

  return (
    <div className="space-y-8">
      <PageHeader
        title={ac.titulo}
        meta={
          <>
            <StatusBadge estado={ac.estado} />
            <TipoBadge tipo={ac.tipo} />
            {ac.is_restricted ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-status-anulado-bg px-2.5 py-0.5 text-xs font-medium text-status-anulado">
                <Lock className="size-3" aria-hidden /> Contenido restringido
              </span>
            ) : null}
            <span className="font-mono text-xs text-muted-foreground">{ac.public_ref}</span>
          </>
        }
        action={
          secretary ? (
            <Button asChild variant="outline">
              <Link href={`/acuerdos/${ac.id}/editar`}>
                <Pencil className="size-4" aria-hidden /> Editar
              </Link>
            </Button>
          ) : undefined
        }
      />

      {/* Cita de origen */}
      <Link
        href={`/actas/${ac.acta_id}`}
        className="flex items-center gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:ring-ring/40"
      >
        <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="text-sm">
          <span className="font-medium">
            Acta {ac.acta_numero}/{ac.acta_año}
          </span>
          {ac.source_page ? <span>, página {ac.source_page}</span> : null}
          <span className="text-muted-foreground">
            {" "}
            · adoptado el {formatFechaLarga(ac.fecha_adopcion)}
          </span>
        </div>
      </Link>

      {/* Texto íntegro */}
      <Card>
        <CardHeader>
          <CardTitle>Texto del acuerdo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-prose whitespace-pre-wrap text-[15px] leading-relaxed">
            {texto}
          </div>
        </CardContent>
      </Card>

      <AreaBadges areas={ac.areas ?? []} />

      {/* Políticas */}
      {politicas.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Library className="size-4 text-muted-foreground" aria-hidden />
          <span className="text-muted-foreground">En políticas:</span>
          {politicas.map((p) => (
            <Link
              key={p.id}
              href={`/politicas/${p.id}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {p.titulo}
            </Link>
          ))}
        </div>
      ) : null}

      {/* Expedientes */}
      {expedientes.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <FolderOpen className="size-4 text-muted-foreground" aria-hidden />
          <span className="text-muted-foreground">En expedientes:</span>
          {expedientes.map((e) => (
            <Link
              key={e.id}
              href={`/expedientes/${e.id}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {e.titulo}
            </Link>
          ))}
        </div>
      ) : null}

      {/* Hilo histórico: enlaces tipados */}
      <Card>
        <CardHeader>
          <CardTitle>Hilo histórico</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {links.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este acuerdo aún no está enlazado con otros.
            </p>
          ) : (
            <ul className="space-y-2">
              {links.map((l) => (
                <li key={`${l.id}-${l.direction}`}>
                  <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
                    <div className="min-w-0 text-sm">
                      <span
                        className={
                          l.confirmed
                            ? "font-medium text-muted-foreground"
                            : "font-medium text-status-curso"
                        }
                      >
                        {l.direction === "out"
                          ? LINK_TIPOS[l.tipo]
                          : LINK_TIPOS_INVERSO[l.tipo]}
                        {!l.confirmed ? " (sugerido)" : ""}
                      </span>{" "}
                      <Link
                        href={`/acuerdos/${l.other_id}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {l.other_ref}
                      </Link>
                      <span className="text-muted-foreground">
                        {" "}
                        — {l.other_titulo} ({formatFecha(l.other_fecha)})
                      </span>
                    </div>
                    {secretary ? (
                      <div className="flex shrink-0 gap-1">
                        {!l.confirmed ? (
                          <form action={confirmLink}>
                            <input type="hidden" name="linkId" value={l.id} />
                            <input type="hidden" name="fromId" value={ac.id} />
                            <Button type="submit" size="sm" variant="outline">
                              Confirmar
                            </Button>
                          </form>
                        ) : null}
                        <form action={removeLink}>
                          <input type="hidden" name="linkId" value={l.id} />
                          <input type="hidden" name="fromId" value={ac.id} />
                          <Button type="submit" size="sm" variant="ghost">
                            Quitar
                          </Button>
                        </form>
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {secretary ? (
            <form
              action={createLink}
              className="flex flex-col gap-2 rounded-xl bg-muted/50 p-3 sm:flex-row sm:items-end"
            >
              <input type="hidden" name="fromId" value={ac.id} />
              <div className="space-y-1">
                <Label htmlFor="link-tipo" className="text-xs">
                  Relación
                </Label>
                <select
                  id="link-tipo"
                  name="tipo"
                  className="border-input h-9 rounded-md border bg-background px-3 text-sm shadow-xs"
                  defaultValue="relacionado_con"
                >
                  {Object.entries(LINK_TIPOS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1 space-y-1">
                <Label htmlFor="link-target" className="text-xs">
                  Acuerdo destino (referencia)
                </Label>
                <Input
                  id="link-target"
                  name="targetRef"
                  placeholder="ACU-2018-0142"
                  className="bg-background"
                  required
                />
              </div>
              <Button type="submit" variant="outline" size="sm" className="min-h-9">
                <Link2 className="size-4" aria-hidden /> Enlazar
              </Button>
            </form>
          ) : null}
        </CardContent>
      </Card>

      {/* Tareas derivadas */}
      <Card>
        <CardHeader>
          <CardTitle>Tareas derivadas ({tareas.length})</CardTitle>
          {secretary ? (
            <CardAction>
              <Button asChild size="sm" variant="outline">
                <Link href={`/tareas/nueva?acuerdo=${ac.id}`}>
                  <Plus className="size-4" aria-hidden /> Nueva tarea
                </Link>
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent>
          {tareas.length === 0 ? (
            <p className="py-2 text-center text-sm text-muted-foreground">
              Este acuerdo no tiene tareas asociadas.
            </p>
          ) : (
            <ul className="divide-y">
              {tareas.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/tareas/${t.id}`}
                    className="-mx-2 flex min-h-12 items-center justify-between gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{t.titulo}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.assignee ?? "Sin asignar"}
                        {t.fecha_vencimiento ? ` · vence ${formatFecha(t.fecha_vencimiento)}` : ""}
                      </div>
                    </div>
                    <StatusBadge estado={t.estado} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
