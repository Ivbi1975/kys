import express, { type Express, type Request, type Response, type NextFunction } from "express";
import zlib from "node:zlib";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const COMPRESSION_THRESHOLD = 1024;

function compressionMiddleware(req: Request, res: Response, next: NextFunction) {
  const acceptEncoding = req.headers["accept-encoding"] || "";

  const originalJson = res.json.bind(res);
  res.json = function (body: unknown) {
    const raw = JSON.stringify(body);
    if (!raw || raw.length < COMPRESSION_THRESHOLD) {
      return originalJson(body);
    }

    const buf = Buffer.from(raw, "utf-8");
    let encoding: string | null = null;
    let compressor: zlib.BrotliCompress | zlib.Gzip | zlib.Deflate | null = null;

    if (typeof acceptEncoding === "string" && acceptEncoding.includes("br")) {
      encoding = "br";
      compressor = zlib.createBrotliCompress({
        params: {
          [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
          [zlib.constants.BROTLI_PARAM_QUALITY]: 4,
        },
      });
    } else if (typeof acceptEncoding === "string" && acceptEncoding.includes("gzip")) {
      encoding = "gzip";
      compressor = zlib.createGzip({ level: 6 });
    } else if (typeof acceptEncoding === "string" && acceptEncoding.includes("deflate")) {
      encoding = "deflate";
      compressor = zlib.createDeflate({ level: 6 });
    }

    if (!encoding || !compressor) {
      return originalJson(body);
    }

    res.setHeader("Content-Encoding", encoding);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.removeHeader("Content-Length");
    res.setHeader("Vary", "Accept-Encoding");

    const chunks: Buffer[] = [];
    compressor.on("data", (chunk: Buffer) => chunks.push(chunk));
    compressor.on("end", () => {
      const compressed = Buffer.concat(chunks);
      res.setHeader("Content-Length", compressed.length);
      res.end(compressed);
    });
    compressor.end(buf);

    return res;
  };

  next();
}

const app: Express = express();

app.use(compressionMiddleware);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`), false);
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api", router);

export default app;
