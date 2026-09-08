const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config');
const { AuthenticationError } = require('./errors');

// Password hashing
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
};

const comparePasswords = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

// JWT token generation — HS256 pinned, 15m access
const generateAccessToken = (payload) => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
    algorithm: config.jwt.algorithm,
  });
};

const generateRefreshToken = (payload) => {
  return jwt.sign({ ...payload, jti: require('uuid').v4() }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
    algorithm: config.jwt.algorithm,
  });
};

const generateTokenPair = (payload) => {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
};

// JWT verification — HS256 pinned
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret, { algorithms: [config.jwt.algorithm] });
  } catch (error) {
    throw new AuthenticationError('Invalid or expired token');
  }
};

const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.refreshSecret, { algorithms: [config.jwt.algorithm] });
  } catch (error) {
    throw new AuthenticationError('Invalid or expired refresh token');
  }
};

// Extract token from headers — trims, case-insensitive Bearer
const extractToken = (authHeader) => {
  if (!authHeader) return null;
  const trimmed = authHeader.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
  return parts[1].trim();
};

module.exports = {
  hashPassword,
  comparePasswords,
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  extractToken,
};
