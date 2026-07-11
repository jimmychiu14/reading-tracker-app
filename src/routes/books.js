import { Router } from "express";
import { db, now } from "../db.js";
import { badRequest, notFoundError, asyncHandler } from "../middleware/errorHandler.js";

const router = Router();

const VALID_STATUSES = ["want_to_read", "reading", "completed"];
const BOOK_SORTS = {
  updated_desc: "books.updated_at DESC",
  created_desc: "books.created_at DESC",
  created_asc: "books.created_at ASC",
  title_asc: "books.title COLLATE NOCASE ASC",
  title_desc: "books.title COLLATE NOCASE DESC",
  progress_desc: "CASE WHEN books.total_pages > 0 THEN CAST(books.current_page AS REAL) / books.total_pages ELSE 0 END DESC",
  progress_asc: "CASE WHEN books.total_pages > 0 THEN CAST(books.current_page AS REAL) / books.total_pages ELSE 0 END ASC",
  rating_desc: "books.rating IS NULL ASC, books.rating DESC",
};

async function attachTags(book) {
  if (!book) return book;
  const result = await db.execute({
    sql: `SELECT t.id, t.name FROM tags t
          JOIN book_tags bt ON bt.tag_id = t.id
          WHERE bt.book_id = ?`,
    args: [book.id],
  });
  const tags = result.rows;
  const progress =
    book.total_pages > 0
      ? Math.round((book.current_page / book.total_pages) * 100)
      : 0;
  return { ...book, tags, progress };
}

async function getBookById(id) {
  const result = await db.execute({
    sql: "SELECT * FROM books WHERE id = ?",
    args: [id],
  });
  return attachTags(result.rows[0]);
}

async function syncTags(bookId, tagNames) {
  const tx = await db.transaction();
  try {
    await tx.execute({ sql: "DELETE FROM book_tags WHERE book_id = ?", args: [bookId] });
    for (const name of tagNames) {
      await tx.execute({ sql: "INSERT OR IGNORE INTO tags (name) VALUES (?)", args: [name] });
      const tagResult = await tx.execute({ sql: "SELECT id FROM tags WHERE name = ?", args: [name] });
      const tagId = Number(tagResult.rows[0].id);
      await tx.execute({ sql: "INSERT INTO book_tags (book_id, tag_id) VALUES (?, ?)", args: [bookId, tagId] });
    }
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

function syncStatusDates(book, prevStatus) {
  const ts = now();
  const updates = [];

  if (book.status === "reading" && prevStatus !== "reading") {
    updates.push(["started_at", ts]);
  }
  if (book.status === "completed" && prevStatus !== "completed") {
    updates.push(["finished_at", ts]);
    if (book.total_pages > 0) {
      book.current_page = book.total_pages;
    }
  }
  if (book.status !== "completed") {
    updates.push(["finished_at", null]);
  }
  return updates;
}

router.get("/", asyncHandler(async (req, res) => {
  const { status, tag, q, sort = "updated_desc" } = req.query;
  let sql = "SELECT books.* FROM books";
  const conditions = [];
  const args = [];

  if (status) {
    conditions.push("books.status = ?");
    args.push(status);
  }
  if (tag) {
    sql += " JOIN book_tags bt ON bt.book_id = books.id JOIN tags t ON t.id = bt.tag_id";
    conditions.push("t.name = ?");
    args.push(tag);
  }
  if (q) {
    conditions.push("(books.title LIKE ? OR books.author LIKE ?)");
    args.push(`%${q}%`, `%${q}%`);
  }
  if (conditions.length) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  sql += ` ORDER BY ${BOOK_SORTS[sort] || BOOK_SORTS.updated_desc}`;

  const result = await db.execute({ sql, args });
  const books = await Promise.all(result.rows.map(attachTags));
  res.json(books);
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const book = await getBookById(req.params.id);
  if (!book) throw notFoundError("找不到此書籍");
  res.json(book);
}));

router.post("/", asyncHandler(async (req, res) => {
  const {
    title,
    author = "",
    isbn = "",
    total_pages = 0,
    current_page = 0,
    status = "want_to_read",
    rating = null,
    cover_url = "",
    tags = [],
  } = req.body;

  if (!title) throw badRequest("title 為必填欄位");
  if (!VALID_STATUSES.includes(status))
    throw badRequest(`status 必須是: ${VALID_STATUSES.join(", ")}`);
  if (current_page > total_pages)
    throw badRequest("current_page 不可超過 total_pages");

  const result = await db.execute({
    sql: `INSERT INTO books (title, author, isbn, total_pages, current_page, status, rating, cover_url)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [title, author, isbn, total_pages, current_page, status, rating, cover_url],
  });

  const id = Number(result.lastInsertRowid);

  if (tags.length) await syncTags(id, tags);

  const book = { id, status, total_pages, current_page };
  const dateUpdates = syncStatusDates(book, "want_to_read");
  if (dateUpdates.length) {
    const set = dateUpdates.map(([k]) => `${k} = ?`).join(", ");
    const vals = dateUpdates.map(([, v]) => v);
    await db.execute({
      sql: `UPDATE books SET ${set}, updated_at = ? WHERE id = ?`,
      args: [...vals, now(), id],
    });
  }

  res.status(201).json(await getBookById(id));
}));

router.put("/:id", asyncHandler(async (req, res) => {
  const existingResult = await db.execute({
    sql: "SELECT * FROM books WHERE id = ?",
    args: [req.params.id],
  });
  const existing = existingResult.rows[0];
  if (!existing) throw notFoundError("找不到此書籍");

  const {
    title,
    author,
    isbn,
    total_pages,
    current_page,
    status,
    rating,
    cover_url,
    tags,
  } = req.body;

  if (status && !VALID_STATUSES.includes(status))
    throw badRequest(`status 必須是: ${VALID_STATUSES.join(", ")}`);
  if (total_pages != null && current_page != null && current_page > total_pages)
    throw badRequest("current_page 不可超過 total_pages");

  const merged = {
    title: title ?? existing.title,
    author: author ?? existing.author,
    isbn: isbn ?? existing.isbn,
    total_pages: total_pages ?? existing.total_pages,
    current_page: current_page ?? existing.current_page,
    status: status ?? existing.status,
    rating: rating ?? existing.rating,
    cover_url: cover_url ?? existing.cover_url,
  };

  const dateUpdates = syncStatusDates(merged, existing.status);

  const tx = await db.transaction();
  try {
    await tx.execute({
      sql: `UPDATE books
            SET title = ?, author = ?, isbn = ?,
                total_pages = ?, current_page = ?,
                status = ?, rating = ?, cover_url = ?,
                updated_at = ?
            WHERE id = ?`,
      args: [merged.title, merged.author, merged.isbn, merged.total_pages,
             merged.current_page, merged.status, merged.rating, merged.cover_url,
             now(), Number(req.params.id)],
    });
    if (dateUpdates.length) {
      const set = dateUpdates.map(([k]) => `${k} = ?`).join(", ");
      const vals = dateUpdates.map(([, v]) => v);
      await tx.execute({
        sql: `UPDATE books SET ${set}, updated_at = ? WHERE id = ?`,
        args: [...vals, now(), Number(req.params.id)],
      });
    }
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }

  if (tags !== undefined) {
    await syncTags(Number(req.params.id), tags);
  }

  res.json(await getBookById(req.params.id));
}));

router.patch("/:id/progress", asyncHandler(async (req, res) => {
  const existingResult = await db.execute({
    sql: "SELECT * FROM books WHERE id = ?",
    args: [req.params.id],
  });
  const existing = existingResult.rows[0];
  if (!existing) throw notFoundError("找不到此書籍");

  const { current_page } = req.body;
  if (current_page == null) throw badRequest("current_page 為必填欄位");
  if (current_page < 0) throw badRequest("current_page 不可為負數");
  if (existing.total_pages > 0 && current_page > existing.total_pages)
    throw badRequest("current_page 不可超過 total_pages");

  let newStatus = existing.status;
  if (existing.status === "want_to_read" && current_page > 0) {
    newStatus = "reading";
  }
  if (existing.total_pages > 0 && current_page >= existing.total_pages) {
    newStatus = "completed";
  }

  const merged = { status: newStatus, total_pages: existing.total_pages, current_page };
  const dateUpdates = syncStatusDates(merged, existing.status);

  let sql = "UPDATE books SET current_page = ?, status = ?, updated_at = ?";
  const args = [current_page, newStatus, now()];
  if (dateUpdates.length) {
    sql += ", " + dateUpdates.map(([k]) => `${k} = ?`).join(", ");
    args.push(...dateUpdates.map(([, v]) => v));
  }
  sql += " WHERE id = ?";
  args.push(Number(req.params.id));
  await db.execute({ sql, args });

  res.json(await getBookById(req.params.id));
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const result = await db.execute({
    sql: "DELETE FROM books WHERE id = ?",
    args: [req.params.id],
  });
  if (result.rowsAffected === 0) throw notFoundError("找不到此書籍");
  res.json({ message: "已刪除", id: Number(req.params.id) });
}));

export default router;
