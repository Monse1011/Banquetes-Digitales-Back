class AccountBlockedException extends Error {
  constructor() {
    super("Cuenta bloqueada temporalmente");
    this.name = "AccountBlockedException";
  }
}
module.exports = AccountBlockedException;
