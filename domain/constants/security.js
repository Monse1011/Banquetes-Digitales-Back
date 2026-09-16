const SecurityConstants = Object.freeze({
  JWT_DEFAULT_TTL: "1h",
  JWT_ALGORITHM: "HS256",
  BLOCK_DURATION_MINUTES: 15,
  AUTH_COOKIE_NAME: "auth_token",
});

function getAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
}

module.exports = { SecurityConstants, getAuthCookieOptions };
