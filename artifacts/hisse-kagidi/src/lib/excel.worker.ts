export type ExcelWorkerRequest =
  | { type: "parseExcel"; id: string; data: ArrayBuffer }
  | { type: "processAiResults"; id: string; results: { donationId: string; categories: string[]; warnings?: string }[] };

export type ExcelWorkerResponse =
  | { type: "parseResult"; id: string; rows: string[][] }
  | { type: "aiProcessResult"; id: string; classifications: { donationId: string; categories: string[]; warnings: string }[] }
  | { type: "error"; id: string; message: string };

self.onmessage = async (e: MessageEvent<ExcelWorkerRequest>) => {
  const msg = e.data;

  if (msg.type === "parseExcel") {
    try {
      const XLSX = await import("xlsx-js-style");
      const workbook = XLSX.read(msg.data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      self.postMessage({ type: "parseResult", id: msg.id, rows } satisfies ExcelWorkerResponse);
    } catch (err) {
      self.postMessage({
        type: "error",
        id: msg.id,
        message: err instanceof Error ? err.message : "Excel parse hatası",
      } satisfies ExcelWorkerResponse);
    }
    return;
  }

  if (msg.type === "processAiResults") {
    try {
      const classifications = msg.results.map(r => ({
        donationId: r.donationId,
        categories: r.categories || [],
        warnings: r.warnings || "",
      }));
      self.postMessage({
        type: "aiProcessResult",
        id: msg.id,
        classifications,
      } satisfies ExcelWorkerResponse);
    } catch (err) {
      self.postMessage({
        type: "error",
        id: msg.id,
        message: err instanceof Error ? err.message : "AI sonuç işleme hatası",
      } satisfies ExcelWorkerResponse);
    }
    return;
  }
};
