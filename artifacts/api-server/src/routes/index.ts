import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import kesimAlanlariRouter from "./kesim-alanlari";
import tagsRouter from "./tags";
import settingsRouter from "./settings";
import backupRouter from "./backup";
import aiNotesRouter from "./ai-notes";
import exportRouter from "./export";
import integrityRouter from "./integrity";
import bagisHavuzuRouter from "./bagis-havuzu";
import authRouter from "./auth";
import auditLogsRouter from "./audit-logs";
import homeDataRouter from "./home-data";
import adminResetRouter from "./admin-reset";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(homeDataRouter);
router.use(projectsRouter);
router.use(bagisHavuzuRouter);
router.use(kesimAlanlariRouter);
router.use(tagsRouter);
router.use(settingsRouter);
router.use(backupRouter);
router.use(aiNotesRouter);
router.use(exportRouter);
router.use(integrityRouter);
router.use(auditLogsRouter);
router.use(adminResetRouter);

export default router;
