class ChangePasswordRequestDTO {
    constructor(body = {}) {
        this.currentPassword = body.currentPassword ?? body.password;
        this.newPassword = body.newPassword ?? body.new_password;
    }
}
module.exports = ChangePasswordRequestDTO;
