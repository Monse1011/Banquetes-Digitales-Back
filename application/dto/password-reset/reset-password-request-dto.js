class ResetPasswordRequestDTO {
  constructor(body = {}) {
    this.token = body.token;
    this.newPassword = body.newPassword ?? body.new_password;
  }
}
module.exports = ResetPasswordRequestDTO;
