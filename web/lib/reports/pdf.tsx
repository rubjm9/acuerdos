import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

/** Estilos comunes de los informes PDF (sobrios, legibles, imprimibles). */
const s = StyleSheet.create({
  page: { padding: 48, fontSize: 10, fontFamily: "Helvetica", color: "#1c2333" },
  h1: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#5b6472", marginBottom: 18 },
  h2: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 16, marginBottom: 6 },
  row: { flexDirection: "row", borderBottom: "1 solid #e5e8ee", paddingVertical: 5 },
  headRow: {
    flexDirection: "row",
    borderBottom: "1.5 solid #1c2333",
    paddingVertical: 5,
    fontFamily: "Helvetica-Bold",
  },
  cell: { paddingRight: 8 },
  muted: { color: "#5b6472" },
  item: { marginBottom: 12, paddingBottom: 10, borderBottom: "1 solid #e5e8ee" },
  itemTitle: { fontFamily: "Helvetica-Bold", fontSize: 11, marginBottom: 2 },
  badge: { fontSize: 8, color: "#5b6472" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    fontSize: 8,
    color: "#8a91a0",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

function Footer({ title }: { title: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>{title} · Documento confidencial de la Asamblea</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

export type TimelineItem = {
  fecha: string;
  titulo: string;
  public_ref: string;
  estado: string;
  cita: string; // "Acta 12/2020, pág. 4"
  texto?: string;
};

/** Informe de expediente: línea de tiempo con citas. */
export async function renderExpedientePdf(opts: {
  titulo: string;
  descripcion?: string | null;
  generadoPor: string;
  items: TimelineItem[];
}): Promise<Buffer> {
  const doc = (
    <Document title={`Expediente — ${opts.titulo}`} language="es">
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>{opts.titulo}</Text>
        <Text style={s.subtitle}>
          Informe histórico del expediente · {opts.items.length} acuerdos · generado el{" "}
          {new Date().toLocaleDateString("es-ES")} por {opts.generadoPor}
        </Text>
        {opts.descripcion ? <Text style={{ marginBottom: 14 }}>{opts.descripcion}</Text> : null}
        {opts.items.map((it, i) => (
          <View key={i} style={s.item} wrap={false}>
            <Text style={s.badge}>
              {new Date(it.fecha).toLocaleDateString("es-ES")} · {it.public_ref} · {it.cita} ·{" "}
              {it.estado}
            </Text>
            <Text style={s.itemTitle}>{it.titulo}</Text>
            {it.texto ? <Text style={s.muted}>{it.texto}</Text> : null}
          </View>
        ))}
        <Footer title={`Expediente — ${opts.titulo}`} />
      </Page>
    </Document>
  );
  return Buffer.from(await renderToBuffer(doc));
}

export type TareaReportRow = {
  responsable: string;
  titulo: string;
  acuerdo_ref: string;
  vencimiento: string | null;
  estado: string;
};

/** Informe de tareas pendientes por responsable. */
export async function renderTareasPdf(opts: {
  generadoPor: string;
  rows: TareaReportRow[];
}): Promise<Buffer> {
  const grupos = new Map<string, TareaReportRow[]>();
  for (const r of opts.rows) {
    if (!grupos.has(r.responsable)) grupos.set(r.responsable, []);
    grupos.get(r.responsable)!.push(r);
  }
  const doc = (
    <Document title="Tareas pendientes" language="es">
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Tareas pendientes</Text>
        <Text style={s.subtitle}>
          Por miembro y comité · generado el {new Date().toLocaleDateString("es-ES")} por{" "}
          {opts.generadoPor}
        </Text>
        {[...grupos.entries()].map(([resp, rows]) => (
          <View key={resp}>
            <Text style={s.h2}>
              {resp} ({rows.length})
            </Text>
            {rows.map((r, i) => (
              <View key={i} style={s.row} wrap={false}>
                <Text style={[s.cell, { width: "48%" }]}>{r.titulo}</Text>
                <Text style={[s.cell, s.muted, { width: "20%" }]}>{r.acuerdo_ref}</Text>
                <Text style={[s.cell, s.muted, { width: "18%" }]}>
                  {r.vencimiento ? new Date(r.vencimiento).toLocaleDateString("es-ES") : "—"}
                </Text>
                <Text style={[s.cell, s.muted, { width: "14%" }]}>{r.estado}</Text>
              </View>
            ))}
          </View>
        ))}
        <Footer title="Tareas pendientes" />
      </Page>
    </Document>
  );
  return Buffer.from(await renderToBuffer(doc));
}

export type AcuerdoReportRow = {
  public_ref: string;
  titulo: string;
  fecha: string;
  estado: string;
  areas: string;
  cita: string;
};

/** Informe de acuerdos por área / visión de estados. */
export async function renderAcuerdosPdf(opts: {
  titulo: string;
  generadoPor: string;
  resumen: { estado: string; n: number }[];
  rows: AcuerdoReportRow[];
}): Promise<Buffer> {
  const doc = (
    <Document title={opts.titulo} language="es">
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>{opts.titulo}</Text>
        <Text style={s.subtitle}>
          {opts.rows.length} acuerdos · generado el {new Date().toLocaleDateString("es-ES")} por{" "}
          {opts.generadoPor}
        </Text>
        <View style={{ flexDirection: "row", gap: 16, marginBottom: 12 }}>
          {opts.resumen.map((r) => (
            <Text key={r.estado} style={s.muted}>
              {r.estado}: {r.n}
            </Text>
          ))}
        </View>
        <View style={s.headRow}>
          <Text style={[s.cell, { width: "16%" }]}>Referencia</Text>
          <Text style={[s.cell, { width: "38%" }]}>Título</Text>
          <Text style={[s.cell, { width: "12%" }]}>Fecha</Text>
          <Text style={[s.cell, { width: "12%" }]}>Estado</Text>
          <Text style={[s.cell, { width: "22%" }]}>Fuente</Text>
        </View>
        {opts.rows.map((r, i) => (
          <View key={i} style={s.row} wrap={false}>
            <Text style={[s.cell, { width: "16%" }]}>{r.public_ref}</Text>
            <Text style={[s.cell, { width: "38%" }]}>{r.titulo}</Text>
            <Text style={[s.cell, s.muted, { width: "12%" }]}>
              {new Date(r.fecha).toLocaleDateString("es-ES")}
            </Text>
            <Text style={[s.cell, s.muted, { width: "12%" }]}>{r.estado}</Text>
            <Text style={[s.cell, s.muted, { width: "22%" }]}>{r.cita}</Text>
          </View>
        ))}
        <Footer title={opts.titulo} />
      </Page>
    </Document>
  );
  return Buffer.from(await renderToBuffer(doc));
}
