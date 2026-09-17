class ChangePasswordRequestDTO {
  constructor(body = {}) {
    this.password = body.password;
    this.new_password = body.new_password;
  }
}

module.exports = ChangePasswordRequestDTO;
