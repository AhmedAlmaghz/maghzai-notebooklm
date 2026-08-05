/**
 * Email service.
 *
 * Reads SMTP config from env vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, NEXT_PUBLIC_APP_URL
 *
 * If SMTP is not configured, falls back to a console transport so auth flows
 * still work locally (the token/link is logged to stdout). A prominent warning
 * is emitted once at module load.
 */
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import ar from "@/i18n/dictionaries/ar";
import en from "@/i18n/dictionaries/en";
import type { Locale } from "@/i18n";

export type EmailLocale = Locale; // "ar" | "en"

// ─── Config ───────────────────────────────────────────────────────────────────

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || "587");
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM || "Bahhatha <no-reply@bahhatha.app>";
const publicAppUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const smtpConfigured = Boolean(smtpHost && smtpUser && smtpPass);

if (!smtpConfigured) {
    console.warn(
        "\n[email] SMTP is NOT configured (SMTP_HOST/SMTP_USER/SMTP_PASS missing). " +
        "Emails will be logged to the console instead of being sent. " +
        "Set the SMTP_* env vars to enable real delivery.\n"
    );
}

// Lazy transporter (created on first send) so importing this module in dev
// without SMTP never throws.
let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
    if (!smtpConfigured) return null;
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465, // 465 = implicit TLS; 587 = STARTTLS
            auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
        });
    }
    return transporter;
}

// ─── Public helpers ───────────────────────────────────────────────────────────

/**
 * Builds an absolute URL for auth links (verify-email / reset-password).
 */
export function buildTokenLink(path: string, token: string): string {
    const base = (publicAppUrl || "http://localhost:3000").replace(/\/+$/, "");
    return `${base}${path}?token=${encodeURIComponent(token)}`;
}

export interface SendEmailParams {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<{ sent: boolean; previewUrl?: string }> {
    const t = getTransporter();
    if (!t) {
        // Dev fallback: log the full email so the flow can be verified locally.
        console.log("\n[email][DEV TRANSPORT] To:", to);
        console.log("[email][DEV TRANSPORT] Subject:", subject);
        console.log(`[email][DEV TRANSPORT] Link: (see "html" below)\n`);
        console.log("[email][DEV TRANSPORT] html:", html.slice(0, 2000));
        if (text) console.log("[email][DEV TRANSPORT] text:", text.slice(0, 500));
        console.log("");
        return { sent: false, previewUrl: undefined };
    }

    try {
        const info = await t.sendMail({
            from: smtpFrom,
            to,
            subject,
            html,
            text: text || stripHtml(html),
        });
        return { sent: true, previewUrl: info.messageId };
    } catch (err) {
        console.error("[email] SMTP send failed:", err);
        return { sent: false };
    }
}

function stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// ─── Bilingual template builders ──────────────────────────────────────────────

const dictionaries = { ar, en };

/**
 * Builds the verification email for the given locale (AR or EN).
 * `link` should be an absolute URL (see buildTokenLink).
 */
export function buildVerificationEmail(name: string, link: string, locale: EmailLocale) {
    const dict = dictionaries[locale];
    const isAr = locale === "ar";
    const subject = dict.authEmail.verifySubject;
    const title = dict.authEmail.verifyTitle.replace("{{name}}", name);
    const body = dict.authEmail.verifyBody;
    const cta = dict.authEmail.verifyCta;
    const footer = dict.authEmail.verifyFooter;
    const footerNote = dict.authEmail.footerNote;
    const signOff = dict.authEmail.signOff;

    const html = renderTemplate({
        isAr,
        title,
        body,
        cta,
        link,
        footer,
        footerNote,
        signOff,
    });

    return { subject, html, text: `\n${title}\n\n${body}\n\n${cta}: ${link}\n\n${footer}\n` };
}

/**
 * Builds the password-reset email for the given locale (AR or EN).
 * `link` should be an absolute URL (see buildTokenLink).
 */
export function buildPasswordResetEmail(name: string, link: string, locale: EmailLocale) {
    const dict = dictionaries[locale];
    const isAr = locale === "ar";
    const subject = dict.authEmail.resetSubject;
    const title = dict.authEmail.resetTitle;
    const body = dict.authEmail.resetBody;
    const cta = dict.authEmail.resetCta;
    const expiresNote = dict.authEmail.expiresNote;
    const footer = dict.authEmail.resetFooter;
    const footerNote = dict.authEmail.footerNote;
    const signOff = dict.authEmail.signOff;

    const html = renderTemplate({
        isAr,
        title,
        body,
        cta,
        link,
        footer,
        footerNote,
        signOff,
        expiresNote,
    });

    return { subject, html, text: `\n${title}\n\n${body}\n\n${cta}: ${link}\n\n${expiresNote}\n${footer}\n` };
}

// ─── HTML template (inline CSS, responsive, RTL-aware) ────────────────────────

interface TemplateArgs {
    isAr: boolean;
    title: string;
    body: string;
    cta: string;
    link: string;
    footer: string;
    footerNote: string;
    signOff: string;
    expiresNote?: string;
}

function renderTemplate(args: TemplateArgs): string {
    const { isAr, title, body, cta, link, footer, footerNote, signOff, expiresNote } = args;
    const dir = isAr ? "rtl" : "ltr";
    const lang = isAr ? "ar" : "en";
    const align = isAr ? "right" : "left";

    return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(2,6,23,.08);">
            <tr>
              <td style="padding:32px 32px 24px 32px;background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);text-align:${align};">
                <span style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:.3px;">بحّاثة</span>
                <div style="margin-top:8px;font-size:13px;color:#c7d2fe;">Bahhatha</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;text-align:${align};">
                <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;color:#0f172a;">${title}</h1>
                <p style="margin:0 0 24px 0;font-size:15px;line-height:1.7;color:#475569;">${body}</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="padding:8px 0 24px 0;">
                      <a href="${link}" target="_blank" rel="noopener" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 32px;border-radius:12px;box-shadow:0 4px 14px rgba(79,70,229,.35);">
                        ${cta}
                      </a>
                    </td>
                  </tr>
                </table>
                ${expiresNote ? `<p style="margin:0 0 8px 0;font-size:13px;line-height:1.6;color:#94a3b8;">${expiresNote}</p>` : ""}
                <p style="margin:0;font-size:13px;line-height:1.6;color:#94a3b8;">${footer}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;text-align:${align};">
                <p style="margin:0 0 6px 0;font-size:12px;line-height:1.6;color:#64748b;">${footerNote}</p>
                <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">${signOff}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
