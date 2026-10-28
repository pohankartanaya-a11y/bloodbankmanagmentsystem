const jwt = require("jsonwebtoken");

function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Authentication token is missing." });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || "development-secret");
    next();
  } catch (error) {
    return res.status(401).json({ message: "Authentication token is invalid or expired." });
  }
}

module.exports = authenticate;
