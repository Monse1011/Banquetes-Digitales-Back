const nodemailer = require("nodemailer");

class NodemailerEmailService {
  constructor({ host, port, user, password, resetPasswordUrl } = {}) {
    this.user = user;
    this.resetPasswordUrl = resetPasswordUrl;
    this.transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: false,
      auth: {
        user,
        pass: password,
      },
    });
  }

  async sendPasswordResetEmail(email, fullName, token) {
    const resetUrl = `${this.resetPasswordUrl}?token=${encodeURIComponent(token)}`;
    console.log(`Sending password reset email to ${email}`);
    await this.transporter.sendMail({
      from: `"Banquetes Elegancia" <${this.user}>`,
      to: email,
      subject: "Restablecimiento de contraseña - Banquetes Elegancia",
      html: `
                <h2>Restablecimiento de contraseña</h2>
                <p>Hola ${fullName},</p>
                <p>Recibimos una solicitud para restablecer tu contraseña.</p>
                <p><a href="${resetUrl}">Restablecer contraseña</a></p>
                <p>Este enlace tiene una vigencia de <strong>15 minutos</strong> y solo puede utilizarse una vez.</p>
                <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
                <p>Saludos,<br>Banquetes Elegancia</p>
            `,
    });
  }
}
module.exports = NodemailerEmailService;
