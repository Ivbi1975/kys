import { Router, type IRouter } from "express";
import coreRouter from "./core";
import donationsRouter from "./donations";
import groupsRouter from "./groups";
import conflictsRouter from "./conflicts";
import trackingRouter from "./tracking";
import photosRouter from "./photos";
import teamsRouter from "./teams";
import notificationsRouter from "./notifications";
import searchRouter from "./search";
import transfersRouter from "./transfers";

const router: IRouter = Router();

router.use(coreRouter);
router.use(donationsRouter);
router.use(groupsRouter);
router.use(conflictsRouter);
router.use(trackingRouter);
router.use(photosRouter);
router.use(teamsRouter);
router.use(notificationsRouter);
router.use(searchRouter);
router.use(transfersRouter);

export default router;
