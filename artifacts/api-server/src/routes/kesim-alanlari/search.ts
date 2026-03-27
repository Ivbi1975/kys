import { Router, type IRouter } from "express";
import { asyncHandler } from "../../middleware/error-handler";
import { globalSearch } from "../../services/search.service";

const router: IRouter = Router();

router.get("/global-search", asyncHandler(async (req, res) => {
  const q = (typeof req.query.q === "string" ? req.query.q : "").trim().toLocaleLowerCase("tr");
  const column = typeof req.query.column === "string" ? req.query.column : "all";
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;

  const results = await globalSearch(q, column, projectId);
  res.json(results);
}));

export default router;
