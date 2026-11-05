import express from "express";
import { getActivity } from "./activity.controllers.js";
import { protect, authorize } from "../../middlewares/auth.middleware.js";
import Roles from "../../constant/roles.js";

const router = express.Router();

router.use(protect);
router.get("/", authorize(Roles.ADMIN), getActivity);

export default router;
