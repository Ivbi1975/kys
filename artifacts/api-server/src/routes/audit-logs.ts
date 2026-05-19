import { Router, type IRouter } from "express";
import { asyncHandler } from "../middleware/error-handler";
import { listAuditLogs } from "../services/audit-log.service";

const router: IRouter = Router();

router.get("/audit-logs", asyncHandler(async (req, res) => {
  const filters = {
    entityType: typeof req.query.entityType === "string" ? req.query.entityType : undefined,
    action: typeof req.query.action === "string" ? req.query.action : undefined,
    entityId: typeof req.query.entityId === "string" ? req.query.entityId : undefined,
    startDate: typeof req.query.startDate === "string" ? req.query.startDate : undefined,
    endDate: typeof req.query.endDate === "string" ? req.query.endDate : undefined,
    limit: Number(req.query.limit) || 50,
    cursor: req.query.cursor ? Number(req.query.cursor) : undefined,
    projectId: typeof req.query.projectId === "string" ? req.query.projectId : undefined,
    kesimAlaniId: typeof req.query.kesimAlaniId === "string" ? req.query.kesimAlaniId : undefined,
    poolScope: req.query.poolScope === "1" || req.query.poolScope === "true",
  };

  const result = await listAuditLogs(filters);
  res.json(result);
}));

export default router;
