import { Router } from "express";
import { db } from "../db.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = Router();

router.get("/", asyncHandler(async (_req, res) => {
  const [
    totalBooksR,
    statusR,
    completedThisYearR,
    totalPagesR,
    totalNotesR,
    avgRatingR,
    recentlyCompletedR,
    currentlyReadingR,
    topTagsR,
  ] = await Promise.all([
    db.execute("SELECT COUNT(*) AS count FROM books"),
    db.execute("SELECT status, COUNT(*) AS count FROM books GROUP BY status"),
    db.execute(
      `SELECT COUNT(*) AS count FROM books
       WHERE status = 'completed' AND finished_at IS NOT NULL
         AND strftime('%Y', finished_at) = strftime('%Y', 'now')`
    ),
    db.execute("SELECT COALESCE(SUM(current_page), 0) AS total FROM books"),
    db.execute("SELECT COUNT(*) AS count FROM notes"),
    db.execute(
      `SELECT ROUND(AVG(rating), 2) AS avg FROM books
       WHERE rating IS NOT NULL AND status = 'completed'`
    ),
    db.execute(
      `SELECT id, title, author, finished_at, rating
       FROM books WHERE status = 'completed'
       ORDER BY finished_at DESC LIMIT 5`
    ),
    db.execute(
      `SELECT id, title, author, current_page, total_pages
       FROM books WHERE status = 'reading'
       ORDER BY updated_at DESC`
    ),
    db.execute(
      `SELECT t.name, COUNT(bt.book_id) AS count
       FROM tags t
       JOIN book_tags bt ON bt.tag_id = t.id
       GROUP BY t.id
       ORDER BY count DESC
       LIMIT 10`
    ),
  ]);

  const byStatus = {};
  for (const row of statusR.rows) {
    byStatus[row.status] = Number(row.count);
  }

  const currentlyReading = currentlyReadingR.rows.map((b) => ({
    id: Number(b.id),
    title: b.title,
    author: b.author,
    current_page: Number(b.current_page),
    total_pages: Number(b.total_pages),
    progress:
      Number(b.total_pages) > 0
        ? Math.round((Number(b.current_page) / Number(b.total_pages)) * 100)
        : 0,
  }));

  const topTags = topTagsR.rows.map((r) => ({
    name: r.name,
    count: Number(r.count),
  }));

  res.json({
    total_books: Number(totalBooksR.rows[0].count),
    by_status: {
      want_to_read: byStatus.want_to_read || 0,
      reading: byStatus.reading || 0,
      completed: byStatus.completed || 0,
    },
    completed_this_year: Number(completedThisYearR.rows[0].count),
    total_pages_read: Number(totalPagesR.rows[0].total),
    total_notes: Number(totalNotesR.rows[0].count),
    avg_rating: avgRatingR.rows[0].avg ?? null,
    currently_reading: currentlyReading,
    recently_completed: recentlyCompletedR.rows.map((r) => ({
      id: Number(r.id),
      title: r.title,
      author: r.author,
      finished_at: r.finished_at,
      rating: r.rating ?? null,
    })),
    top_tags: topTags,
  });
}));

export default router;
