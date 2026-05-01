import express, { type Express, type Request, type Response, type NextFunction } from "express";
import zlib from "node:zlib";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import vysRouter from "./routes/vys";
import { logger } from "./lib/logger";
import { apiKeyAuth, adminKeyAuth } from "./middleware/auth";
import { vysApiKeyAuth } from "./middleware/vys-auth";
import { errorHandler } from "./middleware/error-handler";
import { sanitizeRequestId } from "./lib/signed-url";

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

function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = sanitizeRequestId(req.headers["x-request-id"] as string | undefined);
  req.headers["x-request-id"] = requestId;
  res.setHeader("X-Request-ID", requestId);
  next();
}

const app: Express = express();

app.set("trust proxy", 1);

app.use(requestIdMiddleware);

app.use(compressionMiddleware);

app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.headers["x-request-id"] as string,
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

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        scriptSrc: ["'none'"],
        styleSrc: ["'none'"],
        imgSrc: ["'none'"],
        fontSrc: ["'none'"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 200,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Çok fazla istek gönderildi. Lütfen bir süre bekleyip tekrar deneyin.",
  },
});

const trackingLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Takip sayfası için çok fazla istek. Lütfen bekleyin.",
  },
});

app.use(globalLimiter);

const IS_DEV = process.env.NODE_ENV === "development";
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : [];

if (allowedOrigins.length > 0) {
  logger.info({ origins: allowedOrigins }, "CORS allowed origins configured");
} else if (IS_DEV) {
  logger.info("CORS: development mode — all origins allowed");
} else {
  logger.warn("CORS: ALLOWED_ORIGINS not set in production — only same-origin requests allowed");
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    if (allowedOrigins.length === 0 && IS_DEV) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin ${origin} not allowed by CORS`), false);
  },
  credentials: true,
}));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

const aiClassifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "AI sınıflandırma için çok fazla istek. Lütfen bir dakika bekleyin.",
  },
});

const bulkImportLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 3,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Toplu import için çok fazla istek. Lütfen bir dakika bekleyin.",
  },
});

const vysLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "VYS API için çok fazla istek gönderildi. Lütfen bir dakika bekleyin.",
  },
});

app.use("/api/v1/tracking", trackingLimiter);
app.use("/api/v1/ai-notes/classify-async", aiClassifyLimiter);
app.use("/api/v1/ai-notes/classify", aiClassifyLimiter);
app.use("/api/v1/backup/import", bulkImportLimiter);

app.use("/api/tracking", trackingLimiter);
app.use("/api/ai-notes/classify-async", aiClassifyLimiter);
app.use("/api/ai-notes/classify", aiClassifyLimiter);
app.use("/api/backup/import", bulkImportLimiter);

app.use("/api/vys", vysLimiter, vysApiKeyAuth, vysRouter);

app.use("/api/v1", apiKeyAuth, adminKeyAuth, router);

app.use("/api", apiKeyAuth, adminKeyAuth, router);

app.use(errorHandler);

export default app;
