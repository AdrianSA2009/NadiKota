<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kode Verifikasi NadiKota</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f4;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e7e5e4;box-shadow:0 1px 3px rgba(0,0,0,0.05);">

          <!-- Header -->
          <tr>
            <td style="background-color:#1e3a5f;padding:24px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="44" height="44" style="background-color:#ffffff;border-radius:10px;padding:0;">
                    {{-- URL absolut HTTPS + aset email khusus 44px opaque (bukan CID/blob). --}}
                    <img src="{{ rtrim(config('app.url'), '/') }}/logo-email-88.png" width="44" height="44" alt="Logo NadiKota" style="display:block;width:44px;height:44px;border:0;border-radius:10px;">
                  </td>
                  <td style="padding-left:12px;color:#ffffff;font-size:18px;font-weight:700;">NadiKota</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;color:#1c1917;font-size:20px;font-weight:700;">Verifikasi alamat email Anda</p>
              <p style="margin:0 0 24px;color:#57534e;font-size:15px;line-height:1.6;">
                Masukkan kode berikut untuk menyelesaikan pendaftaran akun warga NadiKota.
              </p>

              <!-- OTP box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f4;border:1px solid #e7e5e4;border-radius:12px;text-align:center;">
                <tr>
                  <td style="padding:24px 16px;">
                    <p style="margin:0 0 8px;color:#78716c;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">KODE VERIFIKASI</p>
                    <p style="margin:0;color:#1e3a5f;font-size:38px;font-weight:800;letter-spacing:10px;line-height:1.2;">{{ $otp }}</p>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
                <tr>
                  <td style="padding:12px 16px;background-color:#fef3c7;border-left:3px solid #d97706;border-radius:6px;color:#78350f;font-size:13px;line-height:1.5;">
                    <strong>Kode berlaku {{ $expiryMinutes }} menit.</strong> Jangan bagikan kepada siapa pun, termasuk pihak yang mengaku petugas NadiKota.
                  </td>
                </tr>
              </table>

              <p style="margin:24px 0 0;color:#57534e;font-size:14px;line-height:1.6;">
                Jika Anda tidak mendaftar di NadiKota, abaikan email ini — tidak ada akun yang dibuat.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#fafaf9;border-top:1px solid #e7e5e4;padding:20px 32px;">
              <p style="margin:0 0 4px;color:#78716c;font-size:13px;font-weight:600;">NadiKota — Pelaporan Infrastruktur Kota</p>
              <p style="margin:0;color:#a8a29e;font-size:12px;line-height:1.5;">
                Email ini dikirim otomatis, mohon tidak membalas pesan ini.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>