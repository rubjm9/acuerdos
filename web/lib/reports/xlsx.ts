import ExcelJS from "exceljs";

/** Hoja de cálculo genérica con cabecera destacada y columnas autoajustadas. */
export async function buildXlsx(
  sheetName: string,
  columns: { header: string; key: string; width?: number }[],
  rows: Record<string, unknown>[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Plataforma Acuerdos";
  const ws = wb.addWorksheet(sheetName);
  ws.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width ?? Math.max(14, c.header.length + 4),
  }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).border = { bottom: { style: "thin" } };
  for (const row of rows) ws.addRow(row);
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };
  return Buffer.from(await wb.xlsx.writeBuffer());
}
