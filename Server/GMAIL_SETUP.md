# Gmail API para sa production login emails

Gmail HTTPS ang gagamitin ng backend para sa single-use links at password-reset
codes. Hindi nito ginagamit ang SMTP ports o Gmail App Password. Ang sender
account lang ang magbibigay ng Google consent; hindi ang bawat tumatanggap ng email.

## 1. Gumawa ng Google OAuth client

1. Buksan ang [Google Cloud Console](https://console.cloud.google.com/), gumawa o
   pumili ng project na kontrolado mo.
2. Sa APIs & Services → Library, hanapin ang **Gmail API** at piliin ang **Enable**.
3. Sa **Google Auth Platform**, kumpletuhin ang **Branding**. Gumamit ng pangalan
   ng app at support/developer email na kontrolado mo.
4. Sa **Audience**, piliin ang **External** kung personal Gmail ang sender. Habang
   Testing pa, idagdag ang sender Gmail sa **Test users**.
5. Sa **Data Access**, idagdag lang ang scope na ito para sa helper:
   `https://www.googleapis.com/auth/gmail.send`.
6. Sa **Clients**, gumawa ng **Web application** OAuth client. Idagdag itong eksakto
   sa **Authorized redirect URIs**:

   ```text
   http://127.0.0.1:53682/oauth2/callback
   ```

   Hindi kailangan ng JavaScript origin: local server callback ang gamit ng setup.
7. I-download ang client JSON. I-save sa eksaktong filename na ito:
   `Server/google-oauth.credentials.local.json`. Naka-ignore ito sa Git.
   Huwag itong i-upload sa frontend, chat, screenshot, o repository.

## 2. I-authorize ang sender sa local computer

Tiyaking ang `EMAIL_USER` sa `Server/.env` ay ang Gmail account na gagamiting sender.
Pagkatapos, sa terminal:

```powershell
cd C:\Users\Admin\Desktop\SielAlumniLink\Server
npm run setup:gmail
```

Buksan ang Google consent URL na ilalabas ng command. Mag-sign in gamit ang
**sender account sa EMAIL_USER**, at payagan ang sending permission. Kung may
unverified-app notice, tiyaking sarili mong project/client ang nakalagay bago
magpatuloy; sundin ang verification requirements na ipinapakita ng Google.

Ang helper ay nakikinig lang sa `127.0.0.1`, nagva-validate ng state/PKCE, at
automatic na nagsa-save ng settings sa ignored na `Server/.env`. Hindi nito
ini-print ang client secret o refresh token at hindi ito nagpapadala ng email.
Sampung minuto lang ang local setup session. I-restart ang backend pagkatapos.

## 3. Ilagay ang settings sa backend Render service

Buksan ang **siel-alumni-link-api → Environment**. Kopyahin nang pribado ang
values mula sa lokal na `Server/.env` para sa limang variables na ito:

```text
EMAIL_PROVIDER=gmail_api
EMAIL_USER=<authorized Gmail sender>
GOOGLE_CLIENT_ID=<OAuth client ID>
GOOGLE_CLIENT_SECRET=<OAuth client secret>
GOOGLE_REFRESH_TOKEN=<refresh token saved by setup>
```

Panatilihin ang `FRONTEND_URL=https://sielalumnilink.onrender.com`. Save at redeploy
ang **backend**. Hindi kailangan ng frontend credentials. Huwag gumamit ng `VITE_`
prefix sa alinmang Google secret. I-revoke ang na-expose na App Password at alisin
ang hindi na ginagamit na `EMAIL_PASS` pagkatapos ng migration.

## 4. I-test sa production

Pagkatapos maging Live ang backend, humingi ng isang bagong login link. Sa Render
Logs, tingnan ang `Authentication email accepted for delivery`, saka buksan ang
email at kumpletuhin ang dashboard/password-setup flow. Ang generic HTTP 200 lang
ay hindi proof ng inbox delivery. Huwag mag-request nang paulit-ulit habang may cooldown.

- `EAUTH`: mali, expired, o revoked ang OAuth grant; i-run ulit ang setup kapag kailangan.
- `ECONFIG`: kulang ang Google variables o sender configuration.
- `EPERMISSION`: tingnan kung enabled ang Gmail API at granted ang sending scope.
- `EQUOTA`: Google rate limit; tingnan din ang Google Cloud/provider account limits.
- `ETIMEDOUT`: hindi natapos ang HTTPS request sa 12-second delivery deadline.

## Production consent at expiry

Ang refresh tokens para sa External app na **Testing** ay karaniwang nag-e-expire
pagkalipas ng **7 days** kapag Gmail scope ang gamit. Para sa tuloy-tuloy na
production sending, gamitin ang naaangkop na production/internal consent setup at
kumpletuhin ang verification na hinihingi ng Google. Huwag ipalagay na permanent
ang token o na verified na agad ang app kapag na-publish. Puwedeng ma-revoke ang
grant o maapektuhan ng account/policy changes; may safe error handling ang backend.

Sakop pa rin ng Gmail sending at abuse limits ang sender account. Hindi dinadagdagan
ng API transport ang daily allowance at hindi nito ginagarantiya ang inbox placement.

Official references:

- [Google Gmail sending guide](https://developers.google.com/workspace/gmail/api/guides/sending)
- [Google Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)
- [Google OAuth refresh-token expiry](https://developers.google.com/identity/protocols/oauth2#expiration)
- [Gmail sending limits](https://support.google.com/mail/answer/22839?hl=en)
