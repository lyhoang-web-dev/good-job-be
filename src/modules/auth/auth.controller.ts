import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { authService } from "./auth.service";
import { config } from "../../config";
import { ok } from "../../utils/response";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const authController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const { token, user } = await authService.login(email, password);
      res
        .status(200)
        .json({ data: user, message: "success", accessToken: token });
    } catch (err) {
      next(err);
    }
  },

  async logout(_req: Request, res: Response) {
    res.clearCookie("access_token");
    ok(res, null, "Logged out");
  },

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const { password: _, ...user } = await prisma.user.findUniqueOrThrow({
        where: { id: req.user!.id },
      });
      ok(res, user);
    } catch (err) {
      next(err);
    }
  },

  googleCallback(req: Request, res: Response) {
    const user = req.user;
    if (!user) {
      res.redirect(`${config.FE_URL}/login?error=oauth_failed`);
      return;
    }

    const token = authService.signToken(user.id, user.email, user.role);
    const hash = `access_token=${encodeURIComponent(token)}`;
    res.redirect(`${config.FE_URL}/feed#${hash}`);
  },

  googleFailure(_req: Request, res: Response) {
    res.redirect(`${config.FE_URL}/login?error=google_auth_failed`);
  },
};
