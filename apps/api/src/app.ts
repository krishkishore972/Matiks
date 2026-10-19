/**
 * The Express application.
 *
 * Middleware order is deliberate: JSON parsing and CORS first, then the routes,
 * then a JSON 404, then the single error handler. Express 5 forwards rejected
 * promises from async handlers to that handler automatically, so routes can be
 * plain `async` functions without a wrapper.
 */
import { env } from "@repo/server/env";
import express, { type NextFunction, type Request, type Response } from "express";
import { HttpError } from "./errors";
import { apiRouter } from "./routes";

export function createApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");

  app.use(express.json({ limit: "256kb" }));

  app.use((req, res, next) => {
    // The client is a browser on another origin (Next dev server); the session
    // id travels in a header, so that header must be allowed explicitly.
    res.setHeader("access-control-allow-origin", env.corsOrigin);
    res.setHeader("access-control-allow-headers", "content-type, x-player-id");
    res.setHeader("access-control-allow-methods", "GET, POST, PATCH, OPTIONS");
    res.setHeader("vary", "origin");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use(apiRouter);

  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: `no route for ${req.method} ${req.path}` });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof HttpError) {
      res.status(error.status).json({ error: error.message, issues: error.details });
      return;
    }

    // `express.json` raises a 400 SyntaxError for a malformed body.
    if (
      error instanceof SyntaxError &&
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      (error as { status?: number }).status === 400
    ) {
      res.status(400).json({ error: "malformed JSON body" });
      return;
    }

    console.error("[api] unhandled error:", error);
    res.status(500).json({ error: "internal server error" });
  });

  return app;
}
