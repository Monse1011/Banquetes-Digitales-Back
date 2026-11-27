// RF-1.2.8.7: advertencia de posible duplicado; se puede continuar con confirm_duplicate.
class DuplicateResourceException extends Error {
  constructor(
    message = "Ya existe un recurso humano activo con el mismo nombre completo y rol operativo. Confirme si desea registrarlo de todos modos."
  ) {
    super(message);
    this.name = "DuplicateResourceException";
  }
}

module.exports = DuplicateResourceException;
