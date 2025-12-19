import { Resend } from "resend";
import dotenv from "dotenv";
dotenv.config();

const resend = new Resend(process.env.RESEND_API);

export default async function sendEmail(to, subject, htmlContent) {
  await resend.emails.send({
    from: "noreply@thefoscape.com",
    to,
    subject,
    html: htmlContent,
  });
  console.log("✅ Email sent successfully");
}

// Test example

