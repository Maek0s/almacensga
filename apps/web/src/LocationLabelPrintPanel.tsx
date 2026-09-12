import { CheckCircle2, Download, Eye, FileCode2, Printer, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { WorkspaceRow } from "./workspace";
import { useI18n } from "./i18n";

type LabelOutput = "prn" | "preview";
type LabelSize = "100x50" | "60x40";

const demoRows: WorkspaceRow[] = [
  { id: "demo-w1a01p001s0", code: "W1A01P001S0", locationCode: "W1A01P001S0", warehouse: "MADRID01_MAIN", zone: "Picking", type: "Estantería", capacity: 120, occupied: 84, status: "Disponible" },
  { id: "demo-w1a02p007s2", code: "W1A02P007S2", locationCode: "W1A02P007S2", warehouse: "MADRID01_MAIN", zone: "Reserva", type: "Palet", capacity: 24, occupied: 18, status: "Ocupada" },
  { id: "demo-w2a01p003s1", code: "W2A01P003S1", locationCode: "W2A01P003S1", warehouse: "MADRID01_FRIO", zone: "Frío", type: "Cámara", capacity: 60, occupied: 42, status: "Controlada" },
];

const textValue = (row: WorkspaceRow, key: string, fallback: string) => String(row[key] ?? fallback);

const CODE128_WIDTHS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", "114131", "311141", "411131", "211412", "211214", "211232", "233111",
];

const locationCode = (row: WorkspaceRow, fallbackIndex = 0) => {
  const provided = String(row.locationCode ?? "").trim() || String(row.code ?? "").trim();
  if (/^W\d+A\d{2}P\d{3}S\d+$/.test(provided)) return provided;
  const warehouse = textValue(row, "warehouse", "MADRID01_MAIN");
  const warehouseNumber = /FRIO/i.test(warehouse) ? 2 : 1;
  const aisle = textValue(row, "aisle", "A-01").match(/([A-Z])[- ]?(\d+)/i);
  const aisleCode = `${aisle?.[1]?.toUpperCase() ?? "A"}${String(Number(aisle?.[2] ?? fallbackIndex + 1)).padStart(2, "0")}`;
  const bay = Number.parseInt(textValue(row, "bay", String(fallbackIndex + 1)), 10);
  const level = Number.parseInt(textValue(row, "level", "0"), 10);
  return `W${warehouseNumber}${aisleCode}P${String(Number.isFinite(bay) ? bay : fallbackIndex + 1).padStart(3, "0")}S${Number.isFinite(level) ? level : 0}`;
};

const code128Svg = (value: string) => {
  const cleanValue = value.replace(/[^\x20-\x7e]/g, "");
  const data = Array.from(cleanValue).map((character) => character.charCodeAt(0) - 32);
  const checksum = (104 + data.reduce((sum, item, index) => sum + item * (index + 1), 0)) % 103;
  const symbols = [104, ...data, checksum, 106];
  const modules = symbols.reduce((sum, symbol) => sum + CODE128_WIDTHS[symbol].split("").reduce((width, value) => width + Number(value), 0), 0) + 2;
  let x = 10;
  let isBar = true;
  const bars: string[] = [];
  for (const symbol of symbols) {
    for (const width of CODE128_WIDTHS[symbol]) {
      const unit = Number(width);
      if (isBar) bars.push(`<rect x="${x}" y="0" width="${unit}" height="58"/>`);
      x += unit;
      isBar = !isBar;
    }
  }
  bars.push(`<rect x="${x}" y="0" width="2" height="58"/>`);
  return `<svg class="barcode-svg" role="img" aria-label="Código Code 128 de ${escapeHtml(cleanValue)}" viewBox="0 0 ${modules + 10} 58" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><g fill="#111827">${bars.join("")}</g></svg>`;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}

function buildZpl(rows: WorkspaceRow[], size: LabelSize) {
  const [width, height] = size.split("x").map(Number);
  const dotsPerMm = 8;
  const labelWidth = width * dotsPerMm;
  const labelHeight = height * dotsPerMm;
  return rows.map((row, index) => {
    const code = locationCode(row, index);
    const warehouse = textValue(row, "warehouse", "MADRID01_MAIN");
    const zone = textValue(row, "zone", "Picking");
    const type = textValue(row, "type", "Estantería");
    return [
      "^XA",
      "^CI28",
      `^PW${labelWidth}`,
      `^LL${labelHeight}`,
      "^FO32,24^A0N,28,28^FDNORTELOG · UBICACION^FS",
      `^FO32,68^A0N,48,48^FD${code}^FS`,
      `^FO32,126^A0N,22,22^FD${warehouse} · ${zone}^FS`,
      `^FO32,160^A0N,20,20^FD${type}^FS`,
      `^FO32,198^BY2,2,54^BCN,54,Y,N,N^FD${code}^FS`,
      "^XZ",
    ].join("\n");
  }).join("\n");
}

function openPrintablePreview(rows: WorkspaceRow[], size: LabelSize) {
  const [width, height] = size.split("x").map(Number);
  const popup = window.open("", "_blank", "width=960,height=720");
  if (!popup) return false;
  const labels = rows.map((row, index) => {
    const code = locationCode(row, index);
    const warehouse = textValue(row, "warehouse", "MADRID01_MAIN");
    const zone = textValue(row, "zone", "Picking");
    const type = textValue(row, "type", "Estantería");
    return `<article class="label"><div class="label-top"><strong>NORTELOG</strong><span>UBICACIÓN</span></div><h2>${escapeHtml(code)}</h2><p>${escapeHtml(warehouse)} · ${escapeHtml(zone)}</p><small>${escapeHtml(type)}</small>${code128Svg(code)}<footer>Code 128 · ${escapeHtml(code)}</footer></article>`;
  }).join("");
  popup.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Ejemplo de etiquetas · NORTELOG</title><style>@page{size:${width}mm ${height}mm;margin:8mm}*{box-sizing:border-box}body{margin:0;padding:24px;background:#eef2f7;color:#13213a;font-family:Arial,sans-serif}.sheet{display:flex;flex-wrap:wrap;gap:16px}.label{width:${width}mm;height:${height}mm;padding:5mm;border:1px solid #cbd5e1;border-radius:2mm;background:white;box-shadow:0 8px 24px rgba(15,35,65,.12);page-break-inside:avoid}.label-top{display:flex;justify-content:space-between;color:#175dbe;font-size:10px;font-weight:700;letter-spacing:.1em}.label-top span{color:#64748b;font-size:8px}.label h2{margin:7mm 0 2mm;font-size:${width > 60 ? 23 : 18}px;letter-spacing:.04em}.label p{margin:0 0 2mm;font-size:11px;font-weight:700}.label small{color:#64748b;font-size:10px}.barcode-svg{display:block;width:100%;height:${width > 60 ? 18 : 14}mm;margin:5mm 0 2mm}.label footer{font-size:8px;color:#64748b}@media print{body{padding:0;background:white}.label{box-shadow:none;border-color:#111}}</style></head><body><main><h1>Ejemplo de etiquetas de ubicación</h1><p>Vista previa local · Code 128 · no hay impresora conectada</p><section class="sheet">${labels}</section></main></body></html>`);
  popup.document.close();
  popup.focus();
  return true;
}

export function LocationLabelPrintPanel({ rows, onClose }: { rows: WorkspaceRow[]; onClose: () => void }) {
  const { t } = useI18n();
  const availableRows = useMemo(() => rows.length > 0 ? rows.slice(0, 8) : demoRows, [rows]);
  const [selectedIds, setSelectedIds] = useState<string[]>(() => availableRows.slice(0, 3).map((row) => row.id));
  const [output, setOutput] = useState<LabelOutput>("prn");
  const [size, setSize] = useState<LabelSize>("100x50");
  const [outputMessage, setOutputMessage] = useState("");
  const selectedRows = availableRows.filter((row) => selectedIds.includes(row.id));
  const previewRows = selectedRows.length > 0 ? selectedRows.slice(0, 3) : availableRows.slice(0, 1);

  const toggleRow = (id: string) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const handleOutput = () => {
    setOutputMessage("");
    if (output === "preview") {
      setOutputMessage(openPrintablePreview(previewRows, size) ? t("Vista imprimible abierta en otra pestaña.") : t("El navegador bloqueó la pestaña. La vista previa de esta ventana sigue disponible."));
      return;
    }
    const content = buildZpl(selectedRows.length > 0 ? selectedRows : previewRows, size);
    const blob = new Blob([content], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `etiquetas-ubicacion-${size.replace("x", "-")}.prn`;
    link.click();
    URL.revokeObjectURL(url);
    setOutputMessage(t("Ejemplo PRN descargado. Contiene comandos ZPL y no se ha enviado a ninguna impresora."));
  };

  return <div className="fixed inset-0 z-50 !mt-0 flex items-center justify-center bg-slate-950/35 p-4 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="max-h-[calc(100vh-2rem)] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="location-label-title">
      <header className="flex items-start justify-between border-b border-slate-100 px-6 py-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">{t("Salida de almacén · Demo")}</p><h2 id="location-label-title" className="mt-1 text-xl font-bold text-ink">{t("Imprimir etiquetas de ubicación")}</h2><p className="mt-1 max-w-2xl text-sm text-slate-500">{t("Selecciona ubicaciones y revisa cómo quedaría una etiqueta térmica antes de conectarla a una impresora.")}</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label={t("Cerrar impresión de etiquetas")}><X size={19} /></button></header>
      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1"><label className="block text-sm font-semibold text-slate-700">{t("Salida")}<select value={output} onChange={(event) => setOutput(event.target.value as LabelOutput)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 font-normal outline-none focus:border-brand focus:ring-4 focus:ring-blue-100"><option value="prn">PRN / ZPL · {t("impresora Zebra")}</option><option value="preview">{t("Vista imprimible · ejemplo visual")}</option></select></label><label className="block text-sm font-semibold text-slate-700">{t("Tamaño")}<select value={size} onChange={(event) => setSize(event.target.value as LabelSize)} className="mt-2 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 font-normal outline-none focus:border-brand focus:ring-4 focus:ring-blue-100"><option value="100x50">100 × 50 mm · {t("estándar")}</option><option value="60x40">60 × 40 mm · {t("compacta")}</option></select></label></div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><div className="flex items-start gap-3"><FileCode2 size={18} className="mt-0.5 shrink-0 text-brand" /><p><strong>{t("Modo demostración.")}</strong> {t("PRN es el archivo raw; el contenido de este ejemplo usa comandos ZPL (`^XA` / `^XZ`) habituales en impresoras Zebra. No se envía nada a una impresora.")}</p></div></div>
          <div><div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-sm font-bold text-slate-700">Ubicaciones ({selectedRows.length})</h3><button type="button" onClick={() => setSelectedIds(selectedIds.length === availableRows.length ? [] : availableRows.map((row) => row.id))} className="text-xs font-semibold text-brand hover:text-blue-700">{selectedIds.length === availableRows.length ? "Quitar todas" : "Seleccionar todas"}</button></div><div className="space-y-2">{availableRows.map((row, index) => <label key={row.id} className="flex items-start gap-3 rounded-lg border border-slate-200 px-3 py-3 text-sm hover:border-blue-200 hover:bg-blue-50/40"><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleRow(row.id)} className="mt-0.5" /><span className="min-w-0 flex-1"><strong className="block font-mono text-sm text-slate-800">{locationCode(row, index)}</strong><span className="block truncate text-xs text-slate-500">{textValue(row, "warehouse", "MADRID01_MAIN")} · {textValue(row, "zone", "Picking")}</span></span><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">{textValue(row, "status", "Disponible")}</span></label>)}</div></div>
        </div>
        <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-5"><div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Vista previa</p><h3 className="mt-1 font-semibold text-ink">Así se vería la etiqueta</h3></div><Eye size={19} className="text-slate-400" /></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{previewRows.map((row, index) => { const code = locationCode(row, index); return <div key={row.id} className={`aspect-[2/1] rounded-lg border-2 border-slate-900 bg-white p-3 shadow-sm ${size === "60x40" ? "sm:aspect-[1.5/1]" : ""}`}><div className="flex items-center justify-between text-[9px] font-bold tracking-[0.16em] text-brand"><span>NORTELOG</span><span className="text-slate-500">UBICACIÓN</span></div><div className="mt-3 font-mono text-xl font-black tracking-wide text-slate-900">{code}</div><div className="mt-1 truncate text-[10px] font-bold text-slate-700">{textValue(row, "warehouse", "MADRID01_MAIN")} · {textValue(row, "zone", "Picking")}</div><div className="mt-1 text-[10px] text-slate-500">{textValue(row, "type", "Estantería")}</div><div className="mt-3 overflow-hidden rounded bg-white" dangerouslySetInnerHTML={{ __html: code128Svg(code) }} /><div className="mt-1 truncate font-mono text-[8px] text-slate-500">Code 128 · {code}</div></div>; })}</div>{selectedRows.length === 0 && <p className="mt-4 flex items-center gap-2 text-xs text-amber-700"><CheckCircle2 size={15} />Se muestra un ejemplo; selecciona ubicaciones para generar sus etiquetas.</p>}<div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-xs text-slate-500"><span>{previewRows.length} etiqueta(s) en vista previa · {size.replace("x", " × ")} mm</span><span className="inline-flex items-center gap-1.5"><Printer size={14} />Sin impresora conectada</span></div></div>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-4"><div className="min-w-0 text-xs text-slate-400"><p>La impresión real se conectará cuando se defina el modelo de impresora y el canal de salida.</p>{outputMessage && <p className="mt-1 font-semibold text-emerald-700" role="status">{outputMessage}</p>}</div><div className="flex gap-3"><button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cerrar</button><button type="button" onClick={handleOutput} className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">{output === "prn" ? <Download size={16} /> : <Printer size={16} />}{output === "prn" ? "Descargar ejemplo PRN" : "Abrir vista imprimible"}</button></div></footer>
    </section>
  </div>;
}
