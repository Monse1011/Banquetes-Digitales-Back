class ResetPasswordRequestDTO {
  constructor(body = {}) {
    this.token = body.token;
    this.new_password = body.new_password;
  }
}
module.exports = ResetPasswordRequestDTO;
