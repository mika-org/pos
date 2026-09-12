import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, verifySmtpConnection } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, subject, html, text } = body;

    if (!to || !subject || !html) {
      return NextResponse.json(
        { success: false, error: 'to, subject, dan html wajib diisi' },
        { status: 400 }
      );
    }

    const info = await sendEmail({ to, subject, html, text });
    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (err: any) {
    console.error('[POST /api/email] Error sending email:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Gagal mengirim email' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const result = await verifySmtpConnection();
  return NextResponse.json({
    status: result.success ? 'connected' : 'error',
    smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
    error: result.error || null,
  });
}
