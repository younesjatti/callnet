import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { app, checkPgConnection, startGoogleSheetsAutoSyncWorker } from "./api/server.js";

async function startServer() {
    const PORT = 3000;

    // Vite middleware for development vs static build for production
    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: {
                middlewareMode: true,
                watch: {
                    ignored: [
                        '**/data/**',
                        '**/*.json',
                        '**/.git/**',
                        '**/node_modules/**',
                    ],
                },
            },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), "dist");
        app.use(express.static(distPath));
        app.get("*", (req, res, next) => {
            if (req.path.startsWith("/api")) return next();
            res.sendFile(path.join(distPath, "index.html"));
        });
    }

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`🚀 CallNet platform server running on http://0.0.0.0:${PORT}`);

        // Connect to PostgreSQL and sync data asynchronously without blocking dev server startup
        checkPgConnection().then(() => {
            startGoogleSheetsAutoSyncWorker();
        }).catch(err => {
            console.warn("DB connection warning on startup:", err);
            startGoogleSheetsAutoSyncWorker();
        });
    });
}

startServer();
