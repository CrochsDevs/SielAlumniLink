import express from "express";
import cors from "cors";
import { frontendOrigins } from "../config/cors.js";
import cookieParser from "cookie-parser";
import userRoutes from "../modules/users/users.routes.js";
import authRoutes from "../modules/auth/auth.routes.js";
import activityRoutes from "../modules/activity/activity.routes.js";
import tracerRoutes from "../modules/tracer/tracer.routes.js";
import jobsRoutes from "../modules/jobs/jobs.routes.js";
import surveysRoutes from "../modules/surveys/surveys.routes.js";
import eventsRoutes from "../modules/events/events.routes.js";
import connectionsRoutes from "../modules/connections/connections.routes.js";
import announcementsRoutes from "../modules/announcements/announcements.routes.js";
import careerPostsRoutes from "../modules/career-posts/career-posts.routes.js";
import messagesRoutes from "../modules/messages/messages.routes.js";
import notificationsRoutes from "../modules/notifications/notifications.routes.js";
import referralsRoutes from "../modules/referrals/referrals.routes.js";
import searchRoutes from "../modules/search/search.routes.js";
import uploadRoutes from "../routes/upload.routes.js";
import feedRoutes from "../modules/feed/feed.routes.js";
import developmentRoutes from "../modules/development/development.routes.js";

import certificateRoutes from "../modules/development/certificates.routes.js";
import meetingRoutes from "../modules/meetings/meetings.routes.js";
import employmentRoutes from "../modules/employment/employment.routes.js";
import mentorshipRoutes from "../modules/mentorship/mentorship.routes.js";
import reportRoutes from "../modules/reports/reports.routes.js";

//CAIS INTEGRATION API

//SYLLABUS INTEGRATION API

const app = express();
// Configure exact proxy IPs/CIDRs when deployed behind a reverse proxy.
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY.split(',').map(value => value.trim()));

app.use(
  cors({
    origin: frontendOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/tracer", tracerRoutes);
app.use("/api/jobs", jobsRoutes);
app.use("/api/surveys", surveysRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/connections", connectionsRoutes);
app.use("/api/announcements", announcementsRoutes);
app.use("/api/career-posts", careerPostsRoutes);
app.use("/api/conversations", messagesRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/referrals", referralsRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/development", developmentRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/employment", employmentRoutes);
app.use("/api/mentorship", mentorshipRoutes);
app.use("/api/reports", reportRoutes);

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "The API has been working successfully",
    endpoints: {
      users: "/api/users",
      auth: "/api/auth",
    },
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

export default app;
