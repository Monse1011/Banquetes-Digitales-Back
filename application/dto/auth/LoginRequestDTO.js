class LoginRequestDTO {
    constructor({ employeeId, password }) {
        this.employeeId = employeeId;
        this.password = password;
    }
}
module.exports = LoginRequestDTO;
