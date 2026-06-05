const { Pool } = require('pg');
const { createHash, randomUUID } = require('node:crypto');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const sha256 = (v) => createHash('sha256').update(v).digest('hex');

// Heure aléatoire pondérée vers les heures de bureau
function pickHour() {
  const r = Math.random();
  if (r < 0.04) return Math.floor(Math.random() * 7);          // 0h-6h  (4%)
  if (r < 0.12) return 7 + Math.floor(Math.random() * 2);      // 7h-8h  (8%)
  if (r < 0.35) return 9 + Math.floor(Math.random() * 3);      // 9h-11h (23%)
  if (r < 0.50) return 12 + Math.floor(Math.random() * 2);     // 12h-13h (15%)
  if (r < 0.80) return 14 + Math.floor(Math.random() * 4);     // 14h-17h (30%)
  if (r < 0.95) return 18 + Math.floor(Math.random() * 3);     // 18h-20h (15%)
  return 21 + Math.floor(Math.random() * 3);                    // 21h-23h (5%)
}

function pickStatus() {
  const r = Math.random();
  if (r < 0.64) return 'VERIFIED';
  if (r < 0.79) return 'EXPIRED';
  if (r < 0.90) return 'BLOCKED';
  if (r < 0.97) return 'PENDING';
  return 'REPORTED';
}

function pickAttempts(status) {
  if (status === 'VERIFIED')  return Math.random() < 0.72 ? 1 : 2;
  if (status === 'BLOCKED')   return 3;
  if (status === 'EXPIRED')   return Math.floor(Math.random() * 3);
  if (status === 'REPORTED')  return 1 + Math.floor(Math.random() * 3);
  return 0;
}

async function main() {
  const RAW_API_KEY = 'demo-sk-elegance-2024';
  const PUBLIC_URL = (process.env.PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, '');
  const LOGO_URL = `${PUBLIC_URL}/logo.png`;

  const { rows: [app] } = await pool.query(
    `INSERT INTO "OtpApp" (
      id, name, mail, "apiKey",
      "ttlSeconds", "codeLength", "maxAttempts", "resendCooldown",
      "oneTapEnabled", "verifyRedirectUrl", "otpMode",
      "senderLabel", "cardTitle", "messageTemplate", "logoUrl",
      "allowedCountries", "rateLimitPhone", "rateLimitIp", "reportEnabled",
      "createdAt"
    ) VALUES (
      'demo-app-elegance-2024', $1, $2, $3,
      300, 6, 3, 30,
      true, 'http://localhost:3030/verified', 'CLASSIC',
      $1, 'Code de vérification', 'Votre code {{brand}} est valable {{ttl}} min.', $4,
      ARRAY['FR','BE','CH'], 5, 20, true,
      NOW()
    )
    ON CONFLICT (mail) DO UPDATE SET "logoUrl" = $4
    RETURNING id, name`,
    ['Atelier', 'contact@atelier.fr', sha256(RAW_API_KEY), LOGO_URL],
  );

  const { rows: [{ count }] } = await pool.query(
    `SELECT COUNT(*) AS count FROM "OtpTransaction" WHERE "appId" = $1`,
    [app.id],
  );

  if (parseInt(count) > 0) {
    console.log(`\nSeed ignoré — ${count} transactions déjà présentes pour "${app.name}"`);
    console.log(`   Clé API brute : ${RAW_API_KEY}\n`);
    return;
  }

  // Génère ~650 transactions sur 30 jours avec distribution réaliste
  const transactions = [];
  const DAYS = 30;

  for (let d = 0; d < DAYS; d++) {
    const date = new Date(Date.now() - d * 24 * 3_600_000);
    const dow = date.getDay();
    const isWeekend = dow === 0 || dow === 6;

    // Volume journalier : 8-18 le weekend, 18-38 en semaine
    const dailyCount = isWeekend
      ? 8 + Math.floor(Math.random() * 11)
      : 18 + Math.floor(Math.random() * 21);

    for (let t = 0; t < dailyCount; t++) {
      const hour = pickHour();
      const minute = Math.floor(Math.random() * 60);
      const second = Math.floor(Math.random() * 60);

      const createdAt = new Date(date);
      createdAt.setHours(hour, minute, second, 0);

      const status = pickStatus();
      const channel = Math.random() < 0.68 ? 'RCS' : 'SMS';
      const attempts = pickAttempts(status);

      // Numéro FR aléatoire (06 ou 07)
      const prefix = Math.random() < 0.5 ? '6' : '7';
      const phone = `+33${prefix}${String(Math.floor(Math.random() * 100_000_000)).padStart(8, '0')}`;

      transactions.push({ status, phone, channel, attempts, createdAt });
    }
  }

  // Insert par batch de 50
  const BATCH = 50;
  for (let i = 0; i < transactions.length; i += BATCH) {
    const batch = transactions.slice(i, i + BATCH);
    await Promise.all(
      batch.map((tx) =>
        pool.query(
          `INSERT INTO "OtpTransaction" (
            id, "appId", "phoneHash", "sessionId", "codeHash",
            status, attempts, channel,
            "expiresAt", "createdAt", "updatedAt"
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)`,
          [
            randomUUID(), app.id, sha256(tx.phone), randomUUID(), sha256('123456'),
            tx.status, tx.attempts, tx.channel,
            new Date(tx.createdAt.getTime() + 300_000), tx.createdAt,
          ],
        ),
      ),
    );
  }

  console.log(`\nSeed complet — app "${app.name}"`);
  console.log(`   Clé API brute : ${RAW_API_KEY}`);
  console.log(`   Transactions  : ${transactions.length} insérées\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => pool.end());
