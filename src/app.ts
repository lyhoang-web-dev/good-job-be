import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { passport } from "./lib/passport";
import { errorHandler } from "./middleware/errorHandler.middleware";
import { globalRateLimiter } from "./middleware/rateLimiter.middleware";
import { authRouter } from "./modules/auth/auth.router";
import { usersRouter } from "./modules/users/users.router";
import { kudosRouter } from "./modules/kudos/kudos.router";
import { mediaRouter } from "./modules/media/media.router";
import { rewardsRouter } from "./modules/rewards/rewards.router";
import { notificationsRouter } from "./modules/notifications/notifications.router";
import { sseRouter } from "./modules/sse/sse.router";
import { adminRouter } from "./modules/admin/admin.router";
import { config } from "./config";

export const app = express();

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(
  cors({
    origin: config.CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Idempotency-Key",
      "Cookie",
    ],
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(passport.initialize());
app.use(globalRateLimiter);

app.use("/api/health", (req, res) => {
  res.send("OK");
});
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/kudos", kudosRouter);
app.use("/api/kudos", mediaRouter);
app.use("/api/rewards", rewardsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/events", sseRouter);
app.use("/api/admin", adminRouter);

app.use(errorHandler);
