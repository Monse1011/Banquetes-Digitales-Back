class Email {
  constructor(email) {
    this.email = email;
  }

  isValid() {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email || "");
  }
}
module.exports = Email;
