import { Router } from "express";
import { db } from "../db.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const router = Router();

router.get("/", asyncHandler(async (_req, res) => {
  const totalBooksResult = await db.execute("SELECT COUNT(*) AS count FROM books");
  const totalBooks = Number(totalBooksResult.rows[0].count);

  const statusResult = await db.execute(
    "SELECT status, COUNT(*) AS count FROM books GROUP BY status"
  );
  const byStatus = {};
  for (const row of statusResult.rows) {
    byStatus[row.status] = Number(row.count);
  }

  const completedThisYearResult = await db.execute(
    `SELECT COUNT(*) AS count FROM books
     WHERE status = 'completed' AND finished_at IS NOT NULL
       AND strftime('%Y', finished_at) = strftime('%Y', 'now')`
  );
  const completedThisYear = Number(completedThisYearResult.rows[0].count);

  const totalPagesResult = await db.execute(
    "SELECT COALESCE(SUM(current_page), 0) AS total FROM books"
  );
  const totalPagesRead = Number(totalPagesResult.rows[0].total);

  const totalNotesResult = await db.execute("SELECT COUNT(*) AS count FROM notes");
  const totalNotes = Number(totalNotesResult.rows[0].count);

  const avgRatingResult = await db.execute(
    `SELECT ROUND(AVG(rating), 2) AS avg FROM books
     WHERE rating IS NOT NULL AND status = 'completed'`
  );
  const avgRating = avgRatingResult.rows[0].avg ?? null;

  const recentlyCompletedResult = await db.execute(
    `SELECT id, title, author, finished_at, rating
     FROM books WHERE status = 'completed'
     ORDER BY finished_at DESC LIMIT 5`
  );

  const currentlyReadingResult = await db.execute(
    `SELECT id, title, author, current_page, total_pages
     FROM books WHERE status = 'reading'
     ORDER BY updated_at DESC`
  );
  const currentlyReading = currentlyReadingResult.rows.map((b) => ({
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

  const topTagsResult = await db.execute(
    `SELECT t.name, COUNT(bt.book_id) AS count
     FROM tags t
     JOIN book_tags bt ON bt.tag_id = t.id
     GROUP BY t.id
     ORDER BY count DESC
     LIMIT 10`
  );
  const topTags = topTagsResult.rows.map((r) => ({
    name: r.name,
    count: Number(r.count),
  }));

  res.json({
    total_books: totalBooks,
    by_status: {
      want_to_read: byStatus.want_to_read || 0,
      reading: byStatus.reading || 0,
      completed: byStatus.completed || 0,
    },
    completed_this_year: completedThisYear,
    total_pages_read: totalPagesRead,
    total_notes: totalNotes,
    avg_rating: avgRating,
    currently_reading: currentlyReading,
    recently_completed: recentlyCompletedResult.rows.map(r => ({
      ...r,
      id: Number(r.id),
      rating: r.rating ?? null,
    })),
    top_tags: topTags,
  });
}));

export default router;
