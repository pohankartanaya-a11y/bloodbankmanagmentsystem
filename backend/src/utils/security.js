const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const KEY_LENGTH = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH).toString("hex");

  return `${salt}:${hash}`;
}

function verifyPassword(password, storedValue) {
  if (!storedValue || !storedValue.includes(":")) {
    return false;
  }

  const [salt, originalHash] = storedValue.split(":");
  const calculatedHash = crypto.scryptSync(password, salt, KEY_LENGTH);
  const originalBuffer = Buffer.from(originalHash, "hex");

  if (originalBuffer.length !== calculatedHash.length) {
    return false;
  }

  return crypto.timingSafeEqual(originalBuffer, calculatedHash);
}

function signToken(user) {
  return jwt.sign(
    {
      id: user.user_id,
      full_name: user.full_name,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET || "development-secret",
    { expiresIn: "12h" }
  );
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken
};
