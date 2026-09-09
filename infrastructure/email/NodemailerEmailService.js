const nodemailer = require('nodemailer');

class NodemailerEmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT),
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD
            }
        });
    }

    async sendPasswordResetEmail(email, fullName, token) {
        const resetUrl = `${process.env.RESET_PASSWORD_URL}?token=${encodeURIComponent(token)}`;
        await this.transporter.sendMail({
            from: `"Banquetes Elegancia" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Restablecimiento de contraseña - Banquetes Elegancia',
            html: `
                <h2>Restablecimiento de contraseña</h2>
                <p>Hola ${fullName},</p>
                <p>Recibimos una solicitud para restablecer tu contraseña.</p>
                <p><a href="${resetUrl}">Restablecer contraseña</a></p>
                <p>Este enlace tiene una vigencia de <strong>15 minutos</strong> y solo puede utilizarse una vez.</p>
                <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
                <p>Saludos,<br>Banquetes Elegancia</p>
            `
        });
    }
}
module.exports = NodemailerEmailService;
