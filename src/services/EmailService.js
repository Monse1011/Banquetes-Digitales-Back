const nodemailer = require('nodemailer');

class EmailService {

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

        const resetUrl =
            `${process.env.RESET_PASSWORD_URL}?token=${token}`;

        await this.transporter.sendMail({
            from: `"Banquetes Elegancia" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Recuperación de contraseña - Banquetes Elegancia',

            html: `
                <h2>Recuperación de contraseña</h2>

                <p>Hola ${fullName},</p>

                <p>
                    Recibimos una solicitud para restablecer
                    tu contraseña.
                </p>

                <p>
                    Haz clic en el siguiente enlace para
                    establecer una nueva contraseña:
                </p>

                <p>
                    <a href="${resetUrl}">
                        Restablecer contraseña
                    </a>
                </p>

                <p>
                    Este enlace tiene una vigencia de
                    <strong>15 minutos</strong>
                    y solo puede utilizarse una vez.
                </p>

                <p>
                    Si no solicitaste este cambio,
                    puedes ignorar este correo.
                </p>

                <p>
                    Saludos,<br>
                    Banquetes Elegancia
                </p>
            `
        });
    }
}

module.exports = EmailService;