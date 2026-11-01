import { sendError } from "../utils/response.js";

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const status = err.status || err.statusCode || 500;
  const code = err.code || (status === 500 ? "INTERNAL_ERROR" : "BAD_REQUEST");
  const message = status === 500 
    ? "An unexpected internal server error occurred." 
    : (err.message || "An error occurred processing your request.");

  const details = err.invalidParams || err.details || [];
  return sendError(res, code, message, details, status);
}
