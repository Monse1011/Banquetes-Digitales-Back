class LoginResponseDTO {
    constructor({ requiresPasswordChange, token, user }) {
        this.requiresPasswordChange = requiresPasswordChange;
        this.token = token;
        this.user = user;
    }
}
module.exports = LoginResponseDTO;
