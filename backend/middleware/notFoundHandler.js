export function notFoundHandler(req, res) {
  res.status(404).json({ error: `Not Found - ${req.originalUrl}` });
}

export default notFoundHandler;
