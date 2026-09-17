class AccountBlockedException extends Error {
  constructor(message = "Cuenta bloqueada temporalmente") {
    super(message);
    this.name = "AccountBlockedException";
  }
}
module.exports = AccountBlockedException;
