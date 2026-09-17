const express = require("express");

function createAuthRoutes(authController, authMiddleware, passwordResetController) {
  const router = express.Router();
  router.post("/login", authController.login);
  router.get("/first-access", authMiddleware, authController.firstAccess);
  router.post("/change-password", authMiddleware, authController.changePassword);
  router.post("/forgot-password", passwordResetController.requestReset);
  router.post("/reset-password", passwordResetController.resetPassword);
  return router;
}
module.exports = createAuthRoutes;
