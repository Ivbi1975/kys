import { Router, type IRouter } from "express";
import healthRouter from "./health";
import kesimAlanlariRouter from "./kesim-alanlari";
import tagsRouter from "./tags";
import settingsRouter from "./settings";
import backupRouter from "./backup";
import aiNotesRouter from "./ai-notes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(kesimAlanlariRouter);
router.use(tagsRouter);
router.use(settingsRouter);
router.use(backupRouter);
router.use(aiNotesRouter);

export default router;
