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
  // RF-2.3.4.6: la propuesta se remite como adjunto al correo del cliente.
  async sendProposalEmail(email, clientName, proposalCode, fileName, pdfBuffer) {
    await this.transporter.sendMail({
      from: `"Banquetes Elegancia" <${this.user}>`,
      to: email,
      subject: `Propuesta de evento ${proposalCode} - Banquetes Elegancia`,
      html: `
                <h2>Propuesta de evento</h2>
                <p>Hola ${clientName},</p>
                <p>Adjuntamos la propuesta <strong>${proposalCode}</strong> para tu evento.</p>
                <p>Quedamos atentos a tu confirmación.</p>
                <p>Saludos,<br>Banquetes Elegancia</p>
            `,
      attachments: [
        {
          filename: fileName,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });
  }
}
module.exports = NodemailerEmailService;
