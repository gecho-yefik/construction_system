import nodemailer from "nodemailer";

type VerificationEmailInput = {
    email: string;
    token: string;
};

export async function sendVerificationEmail({ email, token }: VerificationEmailInput) {
    const smtpUrl = process.env.SMTP_URL;
    const from = process.env.EMAIL_FROM;

    if (!smtpUrl || !from) {
        throw new Error("Email delivery requires SMTP_URL and EMAIL_FROM configuration");
    }

    const verificationUrl = new URL(
        "/api/auth/verify-email",
        process.env.NEXTAUTH_URL || "http://localhost:3000",
    );
    verificationUrl.searchParams.set("token", token);

    const transporter = nodemailer.createTransport(smtpUrl);
    await transporter.sendMail({
        from,
        to: email,
        subject: "Verify your email address",
        text: `Verify your email address: ${verificationUrl.toString()}`,
        html: `<p>Verify your email address by <a href="${verificationUrl.toString()}">clicking here</a>.</p>`,
    });
}