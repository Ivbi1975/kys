import type { ExcelWorkerResponse } from "./excel.worker";

let sharedWorker: Worker | null = null;
let workerSupported: boolean | null = null;

function getExcelWorker(): Worker | null {
  if (workerSupported === false) return null;
  if (sharedWorker) return sharedWorker;

  try {
    sharedWorker = new Worker(
      new URL("./excel.worker.ts", import.meta.url),
      { type: "module" }
    );
    workerSupported = true;
    return sharedWorker;
  } catch {
    workerSupported = false;
    return null;
  }
}

export function parseExcelInWorker(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const worker = getExcelWorker();

    if (!worker) {
      fallbackParseExcel(file).then(resolve).catch(reject);
      return;
    }

    const id = crypto.randomUUID();
    const reader = new FileReader();

    reader.onload = (evt) => {
      const data = evt.target?.result;
      if (!data || !(data instanceof ArrayBuffer)) {
        reject(new Error("Dosya okunamadı"));
        return;
      }

      function handler(e: MessageEvent<ExcelWorkerResponse>) {
        const msg = e.data;
        if (msg.id !== id) return;
        worker!.removeEventListener("message", handler);

        if (msg.type === "parseResult") {
          resolve(msg.rows);
        } else if (msg.type === "error") {
          reject(new Error(msg.message));
        }
      }

      worker.addEventListener("message", handler);
      worker.postMessage({ type: "parseExcel", id, data }, [data]);
    };

    reader.onerror = () => reject(new Error("Dosya okunamadı"));
    reader.readAsArrayBuffer(file);
  });
}

export function processAiResultsInWorker(
  results: { donationId: string; categories: string[]; warnings?: string }[]
): Promise<{ donationId: string; categories: string[]; warnings: string }[]> {
  return new Promise((resolve, reject) => {
    const worker = getExcelWorker();

    if (!worker) {
      resolve(results.map(r => ({
        donationId: r.donationId,
        categories: r.categories || [],
        warnings: r.warnings || "",
      })));
      return;
    }

    const id = crypto.randomUUID();

    function handler(e: MessageEvent<ExcelWorkerResponse>) {
      const msg = e.data;
      if (msg.id !== id) return;
      worker!.removeEventListener("message", handler);

      if (msg.type === "aiProcessResult") {
        resolve(msg.classifications);
      } else if (msg.type === "error") {
        reject(new Error(msg.message));
      }
    }

    worker.addEventListener("message", handler);
    worker.postMessage({ type: "processAiResults", id, results });
  });
}

async function fallbackParseExcel(file: File): Promise<string[][]> {
  const XLSX = await import("xlsx-js-style");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Dosya okunamadı"));
    reader.readAsBinaryString(file);
  });
}
