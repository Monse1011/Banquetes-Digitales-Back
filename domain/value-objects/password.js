class Password {
  constructor(password) {
    this.password = password;
  }

  validate() {
    if (!this.password) return { valid: false, message: "La contraseña es obligatoria" };
    if (this.password.length < 8)
      return { valid: false, message: "La contraseña debe tener al menos 8 caracteres" };
    if (!/[A-Z]/.test(this.password))
      return { valid: false, message: "La contraseña debe contener al menos una letra mayúscula" };
    if (!/[a-z]/.test(this.password))
      return { valid: false, message: "La contraseña debe contener al menos una letra minúscula" };
    if (!/[0-9]/.test(this.password))
      return { valid: false, message: "La contraseña debe contener al menos un número" };
    if (!/[!@#$%^&*(),.?": {}|<>_\-\\[\]/'`~+=;]/.test(this.password))
      return { valid: false, message: "La contraseña debe contener al menos un carácter especial" };
    return { valid: true };
  }
}
module.exports = Password;
