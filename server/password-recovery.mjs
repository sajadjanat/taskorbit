import nodemailer from "nodemailer";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { transaction } from "./db.mjs";

export function passwordMailer(env = process.env) {
  if (!env.SMTP_HOST || !env.MAIL_FROM) return null;
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: env.SMTP_SECURE === "true",
    requireTLS: env.SMTP_SECURE !== "true",
    ...(env.SMTP_USER
      ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } }
      : {}),
    connectionTimeout: 10000,
    socketTimeout: 15000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  return ({ to, url, locale }) =>
    transport.sendMail({
      from: env.MAIL_FROM,
      to,
      subject:
        locale === "fa"
          ? "بازیابی رمز TaskOrbit"
          : "Reset your TaskOrbit password",
      text:
        locale === "fa"
          ? `برای انتخاب رمز جدید، این لینک را باز کنید. لینک ۳۰ دقیقه اعتبار دارد و یک‌بار قابل استفاده است.\n\n${url}\n\nاگر شما درخواست نکرده‌اید، این پیام را نادیده بگیرید.`
          : `Open this link to choose a new password. It expires in 30 minutes and can be used once.\n\n${url}\n\nIf you did not request this, ignore this message.`,
    });
}

export function mountPasswordRecovery(
  app,
  { db, origin, limiter, mailer, hashPassword, fail },
) {
  const hash = (value) => createHash("sha256").update(value).digest("hex");
  app.get("/api/auth-options", (_req, res) =>
    res.json({ password_reset: !!mailer }),
  );
  app.post("/api/password/forgot", limiter, async (req, res) => {
    const v = z
      .object({
        email: z.email().transform((s) => s.toLowerCase()),
        locale: z.enum(["en", "fa", "ar", "zh-CN"]).default("en"),
      })
      .parse(req.body);
    if (!mailer)
      fail(
        503,
        "Password recovery is not configured; contact your administrator",
      );
    db.prepare("DELETE FROM password_resets WHERE expires<?").run(Date.now());
    const user = db
      .prepare("SELECT id,email FROM users WHERE email=? AND active=1")
      .get(v.email);
    // Respond identically for missing, disabled and existing accounts, including delivery failure.
    if (user) {
      const token = randomBytes(32).toString("base64url");
      const tokenHash = hash(token);
      db.prepare("INSERT INTO password_resets VALUES(?,?,?)").run(
        tokenHash,
        user.id,
        Date.now() + 30 * 60000,
      );
      const url = new URL(origin);
      url.searchParams.set("reset", token);
      // Delivery latency must not disclose whether an address has an account.
      void Promise.resolve()
        .then(() => mailer({ to: user.email, url: url.href, locale: v.locale }))
        .catch(() => {
          if (db.isOpen)
            db.prepare("DELETE FROM password_resets WHERE token_hash=?").run(
              tokenHash,
            );
        });
    }
    res.json({ ok: true });
  });
  app.post("/api/password/reset", limiter, (req, res) => {
    const v = z
      .object({
        token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
        password: z.string().min(12).max(128),
      })
      .parse(req.body);
    transaction(db, () => {
      const reset = db
        .prepare(
          "SELECT r.user_id FROM password_resets r JOIN users u ON u.id=r.user_id WHERE r.token_hash=? AND r.expires>? AND u.active=1",
        )
        .get(hash(v.token), Date.now());
      if (!reset) fail(400, "Reset link is invalid or expired");
      db.prepare("UPDATE users SET password=? WHERE id=?").run(
        hashPassword(v.password),
        reset.user_id,
      );
      db.prepare("DELETE FROM password_resets WHERE user_id=?").run(
        reset.user_id,
      );
      db.prepare("DELETE FROM sessions WHERE user_id=?").run(reset.user_id);
      db.prepare("DELETE FROM api_tokens WHERE user_id=?").run(reset.user_id);
    });
    res.json({ ok: true });
  });
}
