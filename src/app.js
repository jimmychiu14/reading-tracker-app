import express from "express";
import cors from "cors";
import morgan from "morgan";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import booksRouter from "./routes/books.js";
import notesRouter from "./routes/notes.js";
import tagsRouter from "./routes/tags.js";
import statsRouter from "./routes/stats.js";

import "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use(express.static(join(__dirname, "public")));

app.get("/api", (_req, res) => {
  res.json({
    name: "讀書追蹤 API",
    version: "1.0.0",
    endpoints: {
      books: "/api/books",
      notes: "/api/notes",
      tags: "/api/tags",
      stats: "/api/stats",
    },
  });
});

app.use("/api/books", booksRouter);
app.use("/api/notes", notesRouter);
app.use("/api/tags", tagsRouter);
app.use("/api/stats", statsRouter);

app.use(notFound);
app.use(errorHandler);
