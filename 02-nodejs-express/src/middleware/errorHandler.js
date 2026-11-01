export function errorHandler(err, req, res, next) {
  // If response headers already sent, delegate to default express handler
  if (res.headersSent) {
    return next(err);
  }

  const status = err.status || err.statusCode || 500;
  const title = err.title || (status === 500 ? "Internal Server Error" : "Request Error");
  const detail = status === 500 
    ? "An unexpected internal server error occurred." 
    : (err.message || "An error occurred processing your request.");

  const problemDetails = {
    type: err.type || "about:blank",
    title,
    status,
    detail,
    instance: req.originalUrl,
  };

  if (err.invalidParams) {
    problemDetails.invalid_params = err.invalidParams;
  }

  res.setHeader("Content-Type", "application/problem+json");
  return res.status(status).json(problemDetails);
}
