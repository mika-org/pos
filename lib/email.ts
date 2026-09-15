import nodemailer from 'nodemailer';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export function createSmtpTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER || 'dudungawug27@gmail.com';
  const pass = process.env.SMTP_PASS || 'hgpr drsv hmuw qcif';

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465 (SSL)
    auth: {
      user,
      pass,
    },
  });
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions) {
  const from = process.env.SMTP_FROM || '"VIOREPOS" <viorepost@gmail.com>';
  const transporter = createSmtpTransporter();

  return transporter.sendMail({
    from,
    to,
    subject,
    text: text || html.replace(/<[^>]+>/g, ''),
    html,
  });
}

export async function verifySmtpConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = createSmtpTransporter();
    await transporter.verify();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'SMTP connection failed' };
  }
}
