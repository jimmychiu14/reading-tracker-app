# 讀書追蹤專案 (Reading Tracker)

Node.js + Express + SQLite 的讀書追蹤 REST API，提供書籍管理、閱讀進度追蹤、筆記、標籤分類與統計儀表板。

## 快速開始

```bash
npm install
npm start          # 正式啟動
npm run dev        # 開發模式 (自動重載)
```

伺服器預設運行於 `http://localhost:3000`（可用 `PORT=4000 npm start` 覆寫）。
資料庫檔案自動建立於 `data/reading-tracker.db`。

## 功能

- **書籍 CRUD** — 新增、查詢、修改、刪除書籍
- **閱讀狀態** — `want_to_read`（想讀）/ `reading`（閱讀中）/ `completed`（已讀完）
- **進度追蹤** — 記錄當前頁數，自動計算百分比與切換狀態
- **閱讀筆記** — 每本書可附加多則筆記，含頁碼
- **分類標籤** — 為書籍貼標籤、依標籤搜尋
- **統計儀表板** — 總覽閱讀數據

## API 端點

### 書籍 `/api/books`

| 方法     | 路徑                    | 說明                         |
| -------- | ----------------------- | ---------------------------- |
| `GET`    | `/api/books`            | 列出所有書籍（支援 `?status=`、`?tag=`、`?q=` 篩選） |
| `GET`    | `/api/books/:id`        | 取得單本書籍                 |
| `POST`   | `/api/books`            | 新增書籍                     |
| `PUT`    | `/api/books/:id`        | 更新書籍完整資料             |
| `PATCH`  | `/api/books/:id/progress` | 更新閱讀進度（自動切換狀態） |
| `DELETE` | `/api/books/:id`        | 刪除書籍                     |

**新增書籍範例：**
```json
{
  "title": "原子習慣",
  "author": "James Clear",
  "total_pages": 320,
  "tags": ["自我成長", "習慣"]
}
```

**更新進度：**
```json
{ "current_page": 160 }
```

### 筆記 `/api/notes`

| 方法     | 路徑              | 說明                          |
| -------- | ----------------- | ----------------------------- |
| `GET`    | `/api/notes`      | 列出筆記（`?book_id=` 篩選）  |
| `GET`    | `/api/notes/:id`  | 取得單則筆記                  |
| `POST`   | `/api/notes`      | 新增筆記                      |
| `PUT`    | `/api/notes/:id`  | 更新筆記                      |
| `DELETE` | `/api/notes/:id`  | 刪除筆記                      |

### 標籤 `/api/tags`

| 方法     | 路徑               | 說明                    |
| -------- | ------------------ | ----------------------- |
| `GET`    | `/api/tags`        | 列出所有標籤（含書籍數）|
| `POST`   | `/api/tags`        | 新增標籤                |
| `DELETE` | `/api/tags/:id`    | 刪除標籤                |
| `GET`    | `/api/tags/:id/books` | 取得此標籤下的書籍   |

### 統計 `/api/stats`

| 方法  | 路徑        | 說明                                      |
| ----- | ----------- | ----------------------------------------- |
| `GET` | `/api/stats`| 閱讀統計總覽（總數、狀態分布、進度、評分等）|

## 專案結構

```
reading-tracker/
├── package.json
├── src/
│   ├── server.js              # 伺服器啟動
│   ├── app.js                 # Express 應用設定
│   ├── db.js                  # SQLite 資料庫初始化與 schema
│   ├── middleware/
│   │   └── errorHandler.js    # 錯誤處理中介層
│   └── routes/
│       ├── books.js           # 書籍 CRUD + 進度追蹤
│       ├── notes.js           # 閱讀筆記
│       ├── tags.js            # 標籤分類
│       └── stats.js           # 統計儀表板
└── data/                      # SQLite 資料庫檔案（自動產生）
```

## 技術棧

- **Express** — Web 框架
- **better-sqlite3** — 同步 SQLite 驅動
- **morgan** — 請求日誌
- **cors** — 跨域支援
