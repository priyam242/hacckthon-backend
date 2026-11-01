import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { sendError } from "../utils/response.js";

export function authenticateJwt(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return sendError(res, "UNAUTHORIZED", "Missing or invalid Authorization header. Expected Bearer token.", [], 401);
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    return next();
  } catch (err) {
    return sendError(res, "UNAUTHORIZED", "Token has expired or is invalid.", [], 401);
  }
}
