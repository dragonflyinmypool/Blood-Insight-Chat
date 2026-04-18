import { Router, type IRouter } from "express";
import healthRouter from "./health";
import bloodTestsRouter from "./bloodTests";
import chatRouter from "./chat";
import openaiRouter from "./openai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(bloodTestsRouter);
router.use(chatRouter);
router.use(openaiRouter);

export default router;
