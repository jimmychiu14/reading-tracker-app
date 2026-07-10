import { Router } from "express";
import { db } from "../db.js";
import { badRequest, notFoundError, asyncHandler } from "../middleware/errorHandler.js";

const router = Router();

router.get("/", asyncHandler(async (_req, res) => {
  const result = await db.execute(
    `SELECT t.id, t.name, COUNT(bt.book_id) AS book_count
     FROM tags t
     LEFT JOIN book_tags bt ON bt.tag_id = t.id
     GROUP BY t.id
     ORDER BY t.name`
  );
  res.json(result.rows.map(r => ({ ...r, id: Number(r.id), book_count: Number(r.book_count) })));
}));

router.post("/", asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name) throw badRequest("name 為必填欄位");

  try {
    const result = await db.execute({
      sql: "INSERT INTO tags (name) VALUES (?)",
      args: [name],
    });
    res.status(201).json({ id: Number(result.lastInsertRowid), name });
  } catch (err) {
    if (err.message.includes("UNIQUE") || err.message.includes("constraint")) {
      throw badRequest("此標籤名稱已存在");
    }
    throw err;
  }
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const result = await db.execute({
    sql: "DELETE FROM tags WHERE id = ?",
    args: [req.params.id],
  });
  if (result.rowsAffected === 0) throw notFoundError("找不到此標籤");
  res.json({ message: "已刪除", id: Number(req.params.id) });
}));

router.get("/:id/books", asyncHandler(async (req, res) => {
  const tagResult = await db.execute({
    sql: "SELECT * FROM tags WHERE id = ?",
    args: [req.params.id],
  });
  if (!tagResult.rows[0]) throw notFoundError("找不到此標籤");

  const result = await db.execute({
    sql: `SELECT b.* FROM books b
          JOIN book_tags bt ON bt.book_id = b.id
          WHERE bt.tag_id = ?
          ORDER BY b.updated_at DESC`,
    args: [req.params.id],
  });
  res.json(result.rows);
}));

export default router;
