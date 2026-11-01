import jwt from "jsonwebtoken";
import { config } from "../config.js";

export function authenticateJwt(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      type: "about:blank",
      title: "Unauthorized",
      status: 401,
      detail: "Missing or invalid Authorization header. Expected Bearer token.",
      instance: req.originalUrl,
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({
      type: "about:blank",
      title: "Unauthorized",
      status: 401,
      detail: "Token has expired or is invalid.",
      instance: req.originalUrl,
    });
  }
}
