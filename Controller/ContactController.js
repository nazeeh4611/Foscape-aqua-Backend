import dotenv from "dotenv";
import sendEmail from "../Utils/SendMail.js";

dotenv.config();

export const contactForm = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    const emailContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #144E8C, #78CDD1); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; }
          .field { margin-bottom: 15px; }
          .label { font-weight: bold; color: #144E8C; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Contact Form Submission</h1>
          </div>
          <div class="content">
            <div class="field">
              <span class="label">Name:</span> ${name}
            </div>
            <div class="field">
              <span class="label">Email:</span> ${email}
            </div>
            <div class="field">
              <span class="label">Phone:</span> ${phone}
            </div>
            <div class="field">
              <span class="label">Subject:</span> ${subject}
            </div>
            <div class="field">
              <span class="label">Message:</span>
              <p>${message}</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail("info@thefoscape.com", `New Contact Form: ${subject}`, emailContent);

    res.status(200).json({ message: "Message sent successfully" });

  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
};
