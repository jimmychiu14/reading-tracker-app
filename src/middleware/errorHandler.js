export function notFound(req, res) {
  res.status(404).json({ error: "找不到路徑", path: req.path });
}

export function errorHandler(err, _req, res, _next) {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || "伺服器內部錯誤" });
}

export function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

export function notFoundError(message) {
  const err = new Error(message);
  err.status = 404;
  return err;
}

export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
