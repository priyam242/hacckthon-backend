export function sendSuccess(res, data = null, message = "Operation completed successfully", meta = null, status = 200) {
  const payload = {
    success: true,
    message,
    data,
    meta,
  };
  return res.status(status).json(payload);
}

export function sendError(res, code = "BAD_REQUEST", message = "An error occurred", details = [], status = 400) {
  const payload = {
    success: false,
    message,
    error: {
      code,
      details,
    },
  };
  res.setHeader("Content-Type", "application/problem+json");
  return res.status(status).json(payload);
}
