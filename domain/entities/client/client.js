class Client {
  constructor(clientId, fullName, email, phone, registrationDate) {
    this.clientId = clientId;
    this.fullName = fullName;
    this.email = email;
    this.phone = phone;
    this.registrationDate = registrationDate;
  }
}

module.exports = { Client };
