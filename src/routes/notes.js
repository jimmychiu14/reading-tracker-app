import { Router } from "express";
import { db, now } from "../db.js";
import { badRequest, notFoundError, asyncHandler } from "../middleware/errorHandler.js";

const router = Router();
const NOTE_SORTS = {
  created_desc: "created_at DESC",
  created_asc: "created_at ASC",
  page_asc: "page IS NULL ASC, page ASC",
  page_desc: "page IS NULL ASC, page DESC",
};

async function checkBook(bookId) {
  const result = await db.execute({
    sql: "SELECT id FROM books WHERE id = ?",
    args: [bookId],
  });
  if (!result.rows[0]) throw notFoundError("找不到此書籍");
}

router.get("/", asyncHandler(async (req, res) => {
  const { book_id, sort = "created_desc" } = req.query;
  let sql = "SELECT * FROM notes";
  const args = [];
  if (book_id) {
    sql += " WHERE book_id = ?";
    args.push(book_id);
  }
  sql += ` ORDER BY ${NOTE_SORTS[sort] || NOTE_SORTS.created_desc}`;
  const result = await db.execute({ sql, args });
  res.json(result.rows);
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const result = await db.execute({
    sql: "SELECT * FROM notes WHERE id = ?",
    args: [req.params.id],
  });
  if (!result.rows[0]) throw notFoundError("找不到此筆記");
  res.json(result.rows[0]);
}));

router.post("/", asyncHandler(async (req, res) => {
  const { book_id, content, page = null } = req.body;
  if (!book_id) throw badRequest("book_id 為必填欄位");
  if (!content) throw badRequest("content 為必填欄位");
  await checkBook(book_id);

  const result = await db.execute({
    sql: "INSERT INTO notes (book_id, content, page) VALUES (?, ?, ?)",
    args: [book_id, content, page],
  });

  const id = Number(result.lastInsertRowid);
  const noteResult = await db.execute({
    sql: "SELECT * FROM notes WHERE id = ?",
    args: [id],
  });
  res.status(201).json(noteResult.rows[0]);
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const existingResult = await db.execute({
    sql: "SELECT * FROM notes WHERE id = ?",
    args: [req.params.id],
  });
  const existing = existingResult.rows[0];
  if (!existing) throw notFoundError("找不到此筆記");

  const { content, page } = req.body;
  await db.execute({
    sql: "UPDATE notes SET content = ?, page = ?, updated_at = ? WHERE id = ?",
    args: [content ?? existing.content, page ?? existing.page, now(), Number(req.params.id)],
  });

  const noteResult = await db.execute({
    sql: "SELECT * FROM notes WHERE id = ?",
    args: [Number(req.params.id)],
  });
  res.json(noteResult.rows[0]);
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const result = await db.execute({
    sql: "DELETE FROM notes WHERE id = ?",
    args: [req.params.id],
  });
  if (result.rowsAffected === 0) throw notFoundError("找不到此筆記");
  res.json({ message: "已刪除", id: Number(req.params.id) });
}));

export default router;
