const escapeHtml = (value) => String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

const emailShell = ({ preheader, label, title, description, content, security }) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} | AlumniLink</title>
</head>
<body style="margin:0;padding:0;background-color:#f2f4f2;font-family:Arial,Helvetica,sans-serif;color:#183528;-webkit-text-size-adjust:100%;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f2f4f2;">
    <tr><td align="center" style="padding:32px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border:1px solid #dfe7e1;border-radius:16px;overflow:hidden;">
        <tr><td align="center" bgcolor="#006b32" style="padding:28px 24px 24px;background-color:#006b32;border-radius:15px 15px 0 0;">
          <img src="cid:clsu-logo@alumnilink" width="76" height="76" alt="Central Luzon State University seal" style="display:block;width:76px;height:76px;border:0;margin:0 auto 14px;">
          <p style="margin:0;color:#ffffff;font-size:25px;line-height:32px;font-weight:700;letter-spacing:-0.5px;">AlumniLink</p>
          <p style="margin:5px 0 0;color:#e0eee4;font-size:12px;line-height:19px;">Central Luzon State University</p>
        </td></tr>
        <tr><td bgcolor="#d6ae45" height="4" style="height:4px;background-color:#d6ae45;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:30px 24px 28px;">
          <p style="margin:0 0 10px;color:#007d35;font-size:11px;line-height:18px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">${escapeHtml(label)}</p>
          <h1 style="margin:0 0 12px;color:#153725;font-size:26px;line-height:34px;font-weight:700;">${escapeHtml(title)}</h1>
          <p style="margin:0 0 24px;color:#52635a;font-size:14px;line-height:23px;">${escapeHtml(description)}</p>
          ${content}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
            <tr><td style="padding:15px 16px;background-color:#f3f7f4;border:1px solid #e0e9e2;border-radius:8px;">
              <p style="margin:0 0 4px;color:#234a32;font-size:12px;line-height:19px;font-weight:700;">Keep your account secure</p>
              <p style="margin:0;color:#5c6b62;font-size:12px;line-height:20px;">${escapeHtml(security)}</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:20px 24px;border-top:1px solid #e7ede8;background-color:#fafcfb;border-radius:0 0 15px 15px;">
          <p style="margin:0;color:#496352;font-size:12px;line-height:20px;font-weight:700;">CLSU Alumni Network</p>
          <p style="margin:4px 0 0;color:#77877d;font-size:11px;line-height:18px;">An automated message from AlumniLink. Please do not reply.</p>
          <p style="margin:8px 0 0;color:#77877d;font-size:11px;line-height:18px;">&copy; ${new Date().getFullYear()} AlumniLink &middot; Central Luzon State University</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

export const magicLinkEmail = (loginUrl) => ({
    subject: 'Your AlumniLink sign-in link',
    text: `AlumniLink | Central Luzon State University\n\nSign in to your account:\n${loginUrl}\n\nThis link can be used once and expires in 15 minutes.\n\nFirst time here? After verifying your email, you will create your own AlumniLink password. You can use that password for future logins.\n\nDo not share this link. If you did not request it, you can ignore this email.\n\nCLSU Alumni Network`,
    html: emailShell({
        preheader: 'Your single-use AlumniLink sign-in link expires in 15 minutes.',
        label: 'Secure sign-in',
        title: 'Your alumni connection starts here.',
        description: 'Use the button below to verify your email and sign in to your AlumniLink account.',
        content: `<table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr><td align="center" bgcolor="#009639" style="border-radius:8px;background-color:#009639;mso-padding-alt:15px 28px;">
              <a href="${escapeHtml(loginUrl)}" style="display:inline-block;padding:15px 28px;border:1px solid #009639;border-radius:8px;color:#ffffff;font-size:14px;line-height:20px;font-weight:700;text-decoration:none;">Verify email &amp; sign in &rarr;</a>
            </td></tr>
          </table>
          <p style="margin:12px 0 24px;color:#6b7b71;font-size:12px;line-height:20px;">Valid for <strong style="color:#315640;">15 minutes</strong> &middot; Can be used once</p>
          <p style="margin:0 0 6px;color:#234a32;font-size:14px;line-height:22px;font-weight:700;">First time using AlumniLink?</p>
          <p style="margin:0;color:#52635a;font-size:13px;line-height:22px;">After verifying your email, you will create your own password. Use it to log in on your next visit.</p>
          <p style="margin:22px 0 6px;color:#6b7b71;font-size:12px;line-height:20px;">Button not working? Copy this link into your browser:</p>
          <p style="margin:0;font-size:11px;line-height:19px;word-break:break-all;overflow-wrap:anywhere;"><a href="${escapeHtml(loginUrl)}" style="color:#007d35;text-decoration:underline;word-break:break-all;">${escapeHtml(loginUrl)}</a></p>`,
        security: 'Do not share this link. If you did not request this email, you can safely ignore it.'
    })
});

export const passwordResetEmail = (otp) => ({
    subject: 'Your AlumniLink password reset code',
    text: `AlumniLink | Central Luzon State University\n\nYour password reset code: ${otp}\n\nEnter this code on the password recovery page. It expires in 10 minutes. After verification, you can choose a new password.\n\nDo not share this code. If you did not request a password reset, you can ignore this email. Your password will stay the same.\n\nCLSU Alumni Network`,
    html: emailShell({
        preheader: 'Your AlumniLink password reset code expires in 10 minutes.',
        label: 'Password recovery',
        title: 'Let\'s get you back in.',
        description: 'We received a request to reset your AlumniLink password. Enter this verification code on the password recovery page.',
        content: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td align="center" style="padding:22px 12px;background-color:#eef7f0;border:1px solid #cfe4d4;border-radius:10px;">
              <p style="margin:0 0 10px;color:#42614d;font-size:10px;line-height:16px;font-weight:700;letter-spacing:1.5px;">YOUR VERIFICATION CODE</p>
              <p style="margin:0;color:#006b32;font-family:'Courier New',monospace;font-size:34px;line-height:42px;font-weight:700;letter-spacing:7px;">${escapeHtml(otp)}</p>
            </td></tr>
          </table>
          <p style="margin:12px 0 22px;color:#6b7b71;font-size:12px;line-height:20px;">This code expires in <strong style="color:#315640;">10 minutes.</strong></p>
          <p style="margin:0;color:#52635a;font-size:13px;line-height:22px;">Once your code is verified, you can choose a new password and sign in again.</p>`,
        security: 'Do not share this code. If you did not request a password reset, ignore this email. Your password will stay the same.'
    })
});
