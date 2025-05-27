import nodemailer from "npm:nodemailer";


// Crée et retourne un transporteur reutilisable
function createTransporter() {
  return nodemailer.createTransport({
    host: Deno.env.get("SMTP_HOST"),
    port: parseInt(Deno.env.get("SMTP_PORT") ?? "587"),
    secure: false,
    auth: {
      user: Deno.env.get("SMTP_USER") ?? "",
      pass: Deno.env.get("SMTP_PASS") ?? "",
    },
  });
}

/**
 * Envoi un email d'activation de compte (lien valable 24h).
 */
export async function envoyerEmailActivation(
  to: string,
  activationLink: string,
) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: Deno.env.get("SMTP_FROM") ?? "noreply@example.com",
    to,
    subject: "Activation de votre compte",
    html: `
      <p>Bonjour,</p>
      <p>Merci de vous être inscrit. Cliquez sur ce lien pour activer votre compte (valide 24h) :</p>
      <a href="${activationLink}">${activationLink}</a>
    `,
  });
}

/**
 * Envoi un email de confirmation de changement d'adresse email (lien valable 24h).
 */
export async function envoyerEmailChangeEmail(
  to: string,
  changeLink: string,
) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: Deno.env.get("SMTP_FROM") ?? "noreply@example.com",
    to,
    subject: "Confirmation de votre nouvelle adresse email",
    html: `
      <p>Bonjour,</p>
      <p>Vous avez demandé à changer votre adresse email. Cliquez sur ce lien pour confirmer (valide 24h) :</p>
      <a href="${changeLink}">${changeLink}</a>
      <p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>
    `,
  });
}

/**
 * Envoi un email de réinitialisation du mot de passe (lien valable 1h).
 */
export async function envoyerEmailResetPassword(
  to: string,
  resetLink: string,
) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: Deno.env.get("SMTP_FROM") ?? "noreply@example.com",
    to,
    subject: "Réinitialisation de votre mot de passe",
    html: `
      <p>Bonjour,</p>
      <p>Vous (ou quelqu'un) avez demandé à réinitialiser votre mot de passe.
         Cliquez sur le lien ci-dessous (valide 1h) :</p>
      <a href="${resetLink}">${resetLink}</a>
      <p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>
    `,
  });
}
