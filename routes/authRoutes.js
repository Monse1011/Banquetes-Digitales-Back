const express = require("express");

function createAuthRoutes(authController, authMiddleware) {
  const router = express.Router();
  router.post("/login", authController.login);
  router.post("/change-password", authMiddleware, authController.changePassword);
  return router;
}
module.exports = createAuthRoutes;
