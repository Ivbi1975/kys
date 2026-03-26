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
import authRouter from "./auth";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(projectsRouter);
router.use(kesimAlanlariRouter);
router.use(tagsRouter);
router.use(settingsRouter);
router.use(backupRouter);
router.use(aiNotesRouter);
router.use(exportRouter);
router.use(integrityRouter);

export default router;
