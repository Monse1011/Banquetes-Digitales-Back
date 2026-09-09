class Email {
  static isValid(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "");
  }
}
module.exports = Email;
