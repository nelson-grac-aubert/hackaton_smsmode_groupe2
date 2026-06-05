# Cahier des charges — OTP-as-a-Service en RCS
**Hackathon smsmode · 2,5 jours · Stack : NestJS + React**

---

## 1. Vision & pitch

> *"L'OTP par SMS, c'est taper 6 chiffres en espérant ne pas se tromper.  
> L'OTP RCS de smsmode, c'est un tap — dans un message brandé, vérifié, infalsifiable."*

L'objectif est de prouver en 48 h que smsmode peut proposer une expérience d'authentification à forte valeur commerciale : une **RCS OTP Card** brandée, avec validation en 1 tap, qui transforme un code de vérification en outil marketing anti-phishing.

---

## 2. Acteurs

| Acteur | Rôle |
|---|---|
| **Développeur client** (ex. Nike) | Génère une clé API, configure son OTP et son branding via la console |
| **Utilisateur final** | Reçoit le message RCS, valide en 1 tap ou saisit le code manuellement |
| **smsmode (plateforme)** | Acheminement RCS + SMS fallback, profil de marque vérifié |

Pas d'organisations multi-niveaux — un seul niveau : **une app = une config = une clé API**.

---

## 3. Fonctionnalités

### 3.1 API OTP (NestJS)

#### `POST /otp/generate`
Génère et envoie un OTP par RCS (ou SMS en fallback).

**Body :**
```json
{
  "phone": "+33612345678",
  "sessionId": "sess_abc123"
}
```

**Ce que fait l'endpoint :**
1. Génère un code à N chiffres (défaut : 6) via `otplib`
2. Hache le code (bcrypt) avant stockage en base
3. Génère un `tapToken` — UUID aléatoire à usage unique — pour le 1-tap
4. Construit la RCS Card avec le branding de l'app
5. Envoie via l'API smsmode RCS (avec fallback SMS auto si pas de RCS)
6. Stocke `{ phoneHash, codeHash, tapToken, sessionId, expiresAt, attempts: 0 }` en base
7. Retourne `{ challengeId, expiresAt, channel: "RCS" | "SMS" }`

#### `GET /otp/verify-tap`
Point d'atterrissage du bouton "Valider en 1 tap".

**Query params :** `?t=<tapToken>`

**Comportement :**
1. Récupère le challenge associé au token
2. Vérifie : token valide, non expiré, non déjà consommé
3. Marque le challenge `VERIFIED`, consume le token (usage unique)
4. Redirige vers `verifyRedirectUrl?success=true&sessionId=<id>` (mobile)
5. Si cross-device → la même DB mise à jour suffit, le front poll le statut

#### `POST /otp/verify`
Vérification manuelle du code à 6 chiffres (fallback universel).

**Body :**
```json
{
  "challengeId": "chall_xyz",
  "code": "483921"
}
```

**Comportement :**
1. Récupère le challenge
2. Vérifie expiration + tentatives max (défaut : 3)
3. Compare `bcrypt(code, storedHash)`
4. Si OK → statut `VERIFIED`
5. Si KO → incrémente `attempts`, retourne erreur + tentatives restantes
6. Si tentatives épuisées → statut `BLOCKED`

#### `GET /otp/status/:challengeId`
Polling du front pour le cas cross-device.

**Retourne :** `{ status: "PENDING" | "VERIFIED" | "EXPIRED" | "BLOCKED" }`

#### `POST /otp/report`
Bouton "Ce n'est pas moi" depuis la RCS Card.

**Body :** `{ tapToken: "..." }`

**Comportement :** marque le challenge `REPORTED`, flag le numéro de téléphone (pseudonymisé) pour analyse fraude.

---

### 3.2 Configuration par app (NestJS — `AppConfig`)

Tous les réglages sont stockés par app et applicables à chaque génération.

#### Comportement OTP
| Paramètre | Défaut | Description |
|---|---|---|
| `ttlSeconds` | 300 | Validité du code (5 min) |
| `codeLength` | 6 | Longueur du code |
| `maxAttempts` | 3 | Tentatives max avant blocage |
| `resendCooldownSeconds` | 30 | Délai mini entre deux envois |

#### Canal & fallback
| Paramètre | Défaut | Description |
|---|---|---|
| `preferredChannel` | `RCS` | Canal prioritaire |
| `smsFallback` | `true` | Bascule SMS si pas RCS |
| `fallbackAfterSeconds` | 20 | Délai sans accusé RCS avant SMS |

#### 1-tap
| Paramètre | Défaut | Description |
|---|---|---|
| `oneTapEnabled` | `true` | Active le bouton de validation instantanée |
| `verifyRedirectUrl` | **(requis)** | URL de redirection après le tap |

#### Branding RCS Card
| Paramètre | Exemple | Description |
|---|---|---|
| `senderLabel` | `"Nike ✓"` | Nom vérifié affiché (profil de marque smsmode) |
| `brandColor` | `"#111111"` | Couleur d'en-tête de la card |
| `logoUrl` | `"https://..."` | Logo (PNG/SVG, carré recommandé) |
| `cardTitle` | `"Code de vérification"` | Titre de la card |
| `messageTemplate` | `"Votre code Nike est {{code}}, valable {{ttl}} min."` | Variables : `{{code}}`, `{{ttl}}`, `{{brand}}` |
| `locale` | `"fr"` | Langue |

#### Anti-fraude
| Paramètre | Défaut | Description |
|---|---|---|
| `allowedCountries` | `[]` | Codes ISO autorisés (vide = sans restriction) |
| `rateLimitPerPhonePerHour` | 5 | Envois max par numéro/heure |
| `rateLimitPerIpPerHour` | 20 | Envois max par IP/heure |
| `reportEnabled` | `true` | Affiche le bouton "Ce n'est pas moi" |

---

### 3.3 Console backoffice (React)

Interface de configuration de l'app, accessible via clé API ou login simple.

#### Pages / vues

**Dashboard**
- Volume d'OTP envoyés (dernières 24 h / 7 j)
- Taux de validation (validés / envoyés)
- Répartition RCS vs SMS fallback
- Alertes simples (taux de validation < seuil, pic de reports)

**Configuration**
- Formulaire de réglage de toutes les `AppConfig`
- Aucun champ obligatoire sauf `verifyRedirectUrl`
- Bouton "Enregistrer"

**Branding & Preview** *(effet waouh no.1)*
- Formulaire branding : couleur, logo, nom, texte
- **Prévisualisation en temps réel** de la RCS Card (rendu fidèle de la card telle qu'elle apparaît sur le téléphone, mise à jour à chaque frappe)
- Bouton "Envoyer un test" → saisir un numéro, envoyer un vrai RCS

**Intégration**
- Clé API (affichage + rotation)
- Snippet TypeScript / cURL prêt à coller
- Lien vers la doc

---

### 3.4 Flux 1-tap — détail technique

```
[Browser PC]                [Mobile]                [Backend]
     |                          |                        |
     | POST /otp/generate       |                        |
     |------------------------>|----------------------->|
     |                          |                        | Génère code + tapToken
     |                          |  RCS Card              | Envoie RCS
     |                          |<-----------------------|
     |                          |                        |
     |  GET /otp/status/:id     |  [tap "Valider"]       |
     |  (polling toutes 2s)     | GET /otp/verify-tap?t= |
     |------------------------>|----------------------->|
     |                          |                        | VERIFIED
     |  { status: "VERIFIED" }  |  Redirect → "C'est bon, retournez sur votre ordi" 
     |<------------------------|<-----------------------|
     |                          |
     | Redirect → dashboard     |
```

**Sécurité :**
- `tapToken` : UUID v4 aléatoire, usage unique, TTL = TTL du code
- Le polling expose un `challengeId` opaque — non devinable
- La réponse au front ne contient jamais le code OTP
- Statut avance dans un seul sens : `PENDING → VERIFIED | EXPIRED | BLOCKED | REPORTED`

---

## 4. Fonctionnalités "effet waouh"

### 4.1 Prévisualisation RCS live

La console affiche un rendu fidèle de la RCS Card à chaque modification du branding (couleur, logo, texte). Le développeur voit exactement ce que verra son utilisateur, sans envoyer un seul message.

**Pourquoi c'est fort :** aucun outil d'OTP SMS ne propose ça — le RCS est invisiblement personnalisé d'habitude.

### 4.2 Validation en 1 tap

Passage de "lire 6 chiffres + retaper" à "appuyer". Différenciateur immédiatement visible en démo live. C'est le moment "waouh" que les jurés retiendront.

### 4.3 Bouton "Ce n'est pas moi"

L'utilisateur qui n'a rien demandé peut signaler le message en 1 tap. Le backend reçoit le signal et peut bloquer le numéro/IP. C'est de l'anti-SMS-pumping collaboratif — smsmode peut en faire un argument commercial de conformité.

### 4.4 Expéditeur vérifié

Le message RCS affiche `Nike ✓` (profil de marque vérifié smsmode) au lieu d'un shortcode anonyme. Visuellement, c'est le signal anti-phishing le plus fort qu'un SMS ne peut pas reproduire.

### 4.5 Accusé de lecture intelligent

Le backend sait si le message a été lu (accusé RCS). On peut afficher dans la console "lu il y a 2 min, pas encore validé" et ne proposer un renvoi qu'après X secondes sans lecture — au lieu de spammer l'utilisateur.

---

## 5. Schéma de données (Prisma)

```prisma
model App {
  id               String    @id @default(cuid())
  name             String
  apiKey           String    @unique  // stockée hachée
  
  // Comportement OTP
  ttlSeconds       Int       @default(300)
  codeLength       Int       @default(6)
  maxAttempts      Int       @default(3)
  resendCooldown   Int       @default(30)
  
  // Canal
  smsFallback      Boolean   @default(true)
  fallbackAfter    Int       @default(20)
  
  // 1-tap
  oneTapEnabled    Boolean   @default(true)
  verifyRedirectUrl String
  
  // Branding
  senderLabel      String    @default("Verification")
  brandColor       String    @default("#0F6E56")
  logoUrl          String?
  cardTitle        String    @default("Code de vérification")
  messageTemplate  String    @default("Votre code est {{code}}, valable {{ttl}} min.")
  locale           String    @default("fr")
  
  // Anti-fraude
  allowedCountries String[]  @default([])
  rateLimitPhone   Int       @default(5)
  rateLimitIp      Int       @default(20)
  reportEnabled    Boolean   @default(true)
  
  challenges       Challenge[]
  createdAt        DateTime  @default(now())
}

model Challenge {
  id           String          @id @default(cuid())
  appId        String
  app          App             @relation(fields: [appId], references: [id])
  
  phoneHash    String          // HMAC du numéro — jamais le numéro brut
  sessionId    String
  codeHash     String          // bcrypt du code — jamais le code brut
  tapToken     String?         @unique
  tapUsed      Boolean         @default(false)
  
  status       ChallengeStatus @default(PENDING)
  attempts     Int             @default(0)
  channel      Channel         @default(RCS)
  
  expiresAt    DateTime
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt
}

enum ChallengeStatus {
  PENDING
  VERIFIED
  EXPIRED
  BLOCKED
  REPORTED
}

enum Channel {
  RCS
  SMS
}
```

---

## 6. Exigences non-fonctionnelles

### Sécurité
- Codes et clés API **jamais stockés en clair** (bcrypt / SHA-256)
- Numéros de téléphone **pseudonymisés** (HMAC-SHA256 avec clé secrète)
- `tapToken` usage unique, consommé à la première utilisation
- Rate limiting par IP et par numéro (middleware NestJS)
- Headers sécurité (Helmet)

### RGPD
- Aucun numéro de téléphone en clair en base
- Le code OTP n'est **jamais loggé**
- Rétention des challenges bornée (ex. 30 jours max)
- Purge automatique des challenges expirés

### Scalabilité (hackathon vs prod)
- **Hackathon** : stockage en mémoire acceptable pour les démos, mais la DB doit être branché pour le polling
- **Post-hackathon** : `Map` en mémoire → PostgreSQL + Redis pour le rate limiting

### Observabilité
- Logs structurés (Winston ou Pino) sans secrets
- Pas de code OTP dans les logs

---

## 9. Scénario de démo (5 min)

1. **Montrer la console** → configuration du branding Nike en 30 s
2. **Preview live** → modifier la couleur, voir la card changer en temps réel
3. **Envoyer un test** → vrai RCS reçu sur le téléphone du jury
4. **Démo 1-tap cross-device** → formulaire sur le PC du jury, validation sur le téléphone
5. **Bouton "Ce n'est pas moi"** → le jury appuie, le backend flag immédiatement
6. **Dashboard** → les métriques de la session de démo s'affichent

