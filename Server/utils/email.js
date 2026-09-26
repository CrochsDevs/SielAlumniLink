import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

export const sendOTPEmail = async (to, otp) => {
    const mailOptions = {
        from: `"SielAlumni" <${process.env.EMAIL_USER}>`,
        to: to,
        subject: 'Your OTP Code for Password Reset',
        html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 12px;">
                <h2 style="color: #009639; text-align: center;">Password Reset OTP</h2>
                <p style="font-size: 16px; color: #52525b;">You requested to reset your password. Use the OTP below:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; background: #f4f4f5; padding: 15px; border-radius: 8px; display: inline-block; color: #18181b;">
                        ${otp}
                    </div>
                </div>
                <p style="font-size: 14px; color: #71717a;">This OTP is valid for 10 minutes.</p>
                <p style="font-size: 14px; color: #71717a;">If you didn't request this, please ignore this email.</p>
                <hr style="border: none; border-top: 1px solid #e4e4e7;">
                <p style="font-size: 12px; color: #a1a1aa; text-align: center;">SielAlumni - CLSU Alumni Network</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('✅ OTP email sent to:', to);
        return { success: true };
    } catch (error) {
        console.error('❌ Email error:', error.message);
        return { success: false, error: error.message };
    }
};

export const sendMagicLinkEmail = async (to, loginUrl) => {
    const mailOptions = {
        from: `"SielAlumni" <${process.env.EMAIL_USER}>`,
        to: to,
        subject: 'Your SielAlumni Login Link',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Login to SielAlumni</title>
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f4f5; padding: 40px 20px; margin: 0;">
                <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 40px 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                    <div style="text-align: center; margin-bottom: 24px;">
                        <div style="display: inline-block; width: 48px; height: 48px; background: #009639; border-radius: 10px; line-height: 48px; text-align: center; color: #ffffff; font-size: 24px; font-weight: bold;">S</div>
                    </div>

                    <h1 style="font-size: 22px; color: #18181b; text-align: center; margin: 0 0 8px;">Log in to SielAlumni</h1>
                    <p style="font-size: 14px; color: #71717a; text-align: center; margin: 0 0 32px; line-height: 1.6;">
                        Click the button below to log in to your account.
                    </p>

                    <div style="text-align: center; margin: 32px 0;">
                        <a href="${loginUrl}" style="display: inline-block; background: #18181b; color: #ffffff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                            Log in to SielAlumni
                        </a>
                    </div>

                    <p style="font-size: 12px; color: #a1a1aa; text-align: center; line-height: 1.6; margin: 24px 0 0;">
                        This link expires in 15 minutes.<br>
                        If you didn't request this, you can safely ignore this email.
                    </p>

                    <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0 16px;">

                    <p style="font-size: 11px; color: #a1a1aa; text-align: center; margin: 0;">
                        © ${new Date().getFullYear()} SielAlumni &middot; CLSU Alumni Network
                    </p>
                </div>
            </body>
            </html>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('✅ Magic link email sent to:', to);
        return { success: true };
    } catch (error) {
        console.error('❌ Magic link email error:', error.message);
        return { success: false, error: error.message };
    }
};