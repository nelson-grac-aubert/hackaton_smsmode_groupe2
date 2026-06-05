# hackaton_smsmode_groupe2
A lightweight solution to improve OTP generation, distribution using RTS and verification. Made during a hackaton hosted by smsmode and code4sud in june 2026. Made by Nicolas DUHAMEL, [Hugo BELALOUI](https://github.com/hugo-belaloui), Nelson GRAC-AUBERT, Zied ROUROU and Mounir MEROUANE.

# Déploiement local — OTP smsmode API avec docker

## Prérequis

- [Docker](https://docs.docker.com/get-docker/) et Docker Compose
- [ngrok](https://ngrok.com) avec l'authtoken fourni par smsmode
- Node.js 22+ (uniquement pour travailler en dehors du Docker et compat sdk smsmode)

---

## 1. Configuration de l'environnement

Copier le fichier d'exemple et remplir les valeurs :

```bash
cp .env.example .env
```

Variables obligatoires à renseigner :

| Variable | Description |
|---|---|
| `OTP_API_KEY` | Clé API smsmode — récupérable sur ui.smsmode.com > Settings > API Keys |
| `PUBLIC_URL` | URL ngrok de votre équipe — ex: `https://smsmode-hack-team-2.ngrok.dev` |
| `PHONE_HMAC_SECRET` | Secret arbitraire pour pseudonymiser les numéros (min. 32 chars recommandé) |
| `POSTGRES_PASSWORD` | Mot de passe PostgreSQL |

> ⚠️ Ne jamais committer le fichier `.env`. Il est déjà dans `.gitignore`.

---

## 2. Lancer le projet

```bash
docker compose up --build
```

Le backend démarre sur `http://localhost:3000`.  
La documentation Swagger est accessible sur `http://localhost:3000/api/doc`.

Les migrations Prisma et le seed de données sont appliqués automatiquement au démarrage via le `docker-entrypoint.sh`.

Une application de démonstration **L'Élégance** est créée automatiquement avec des transactions d'exemple. Elle est immédiatement visible dans le dashboard sans configuration supplémentaire.

| Champ | Valeur |
|---|---|
| Nom | L'Élégance |
| Clé API | `demo-sk-elegance-2024` |
| Mode | CLASSIC |

> Le seed est idempotent — relancer `docker compose up` ne duplique pas les données.

---

## 3. ngrok — exposer le backend pour les webhooks smsmode

Suivre la doc smsmode si ngrok non installé. Dans un terminal dédié, à chaque session de travail :

```bash
ngrok http --url=smsmode-hack-team-2.ngrok.dev 3000
```

Remplacer `3000` par le port configuré dans `.env` (`NESTJS_PORT`) si différent.

L'interface de debug ngrok est accessible sur `http://localhost:4040/inspect/http` — elle permet de visualiser les webhooks reçus et de les rejouer sans renvoyer de message.

---

## 4. Gestion des migrations Prisma

### Contexte

Le schéma Prisma est dans `prisma/schema.prisma`. Les types TypeScript sont générés dans `src/generated/prisma` à partir de ce schéma.

Toute modification du schéma nécessite de créer une migration et de régénérer les types.

### En développement (schéma modifié)

```bash
# Entrer dans le container backend
docker compose exec backend sh

# Créer et appliquer la migration + régénérer les types
npx prisma migrate dev --name description_de_la_migration

# Si les types ne sont pas à jour, forcer la régénération
npx prisma generate

# Quitter
exit
```

> `migrate dev` crée le fichier SQL dans `prisma/migrations/`, l'applique, et régénère les types. À utiliser uniquement en développement.

### Si la DB est désynchronisée (drift)

Cela arrive quand la DB a été modifiée manuellement ou sans passer par Prisma Migrate.

```bash
docker compose exec backend sh
npx prisma migrate reset --force
exit
```

> ⚠️ `migrate reset` supprime toutes les données. À n'utiliser qu'en développement.

### Appliquer une migration existante sans perdre les données

```bash
docker compose --profile migrate run --rm migrate
```

Ce service est configuré avec `profiles: [migrate]` — il ne démarre pas avec `docker compose up` et doit être appelé explicitement.

---

## 5. Données de démonstration (seed)

Au premier démarrage, une application **L'Élégance** est automatiquement créée en base avec 15 transactions réparties sur 7 jours (VERIFIED, PENDING, EXPIRED, BLOCKED, REPORTED).

Le dashboard frontend détecte un `localStorage` vide et charge cette app automatiquement — aucune action requise.

Pour relancer le seed manuellement (hors Docker) :

```bash
cd backend
DATABASE_URL="postgresql://user:pass@localhost:5432/dbname" pnpm exec prisma db seed
```

Pour réinitialiser complètement les données :

```bash
docker compose down -v
docker compose up --build
```

---

## 6. Créer une app OTP supplémentaire

```bash
curl -X POST http://localhost:3000/api/v1/otp/apps \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mon App",
    "mail": "contact@monapp.fr",
    "verifyRedirectUrl": "https://monapp.fr/auth/callback"
  }'
```

La réponse contient la clé API — **la conserver, elle ne sera plus affichée** :

```json
{
  "id": "cmpz...",
  "name": "Mon App",
  "apiKey": "sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

Utiliser cette clé dans le header `x-api-key` pour toutes les requêtes suivantes.

---

## 7. Modes OTP

L'API supporte deux modes de validation, configurables par app via le champ `otpMode` à la création.

### Mode CLASSIC (défaut)

L'utilisateur reçoit une RCS Card avec son code affiché en grand et un bouton "Valider en 1 tap".

```bash
curl -X POST http://localhost:3000/api/v1/otp/apps \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mon App",
    "mail": "contact@monapp.fr",
    "verifyRedirectUrl": "https://monapp.fr/auth/callback",
    "otpMode": "CLASSIC"
  }'
```

Flux de validation :

```
POST /otp/generate  →  retourne { challengeId }
                        le PC poll GET /otp/status/:challengeId toutes les 2s
                        le mobile reçoit la RCS Card
                        [tap "Valider"]  →  GET /otp/tap?t=<token>  →  status VERIFIED
                        le PC détecte VERIFIED  →  redirige vers le dashboard
```

### Mode GOOGLE_PROMPT

Inspiré du mécanisme Google — le PC affiche un chiffre, le mobile reçoit un carousel RCS avec 3 chiffres mélangés. L'utilisateur tape celui qui correspond.

```bash
curl -X POST http://localhost:3000/api/v1/otp/apps \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Mon App",
    "mail": "contact@monapp.fr",
    "verifyRedirectUrl": "https://monapp.fr/auth/callback",
    "otpMode": "GOOGLE_PROMPT"
  }'
```

Flux de validation :

```
POST /otp/generate  →  retourne { challengeId, promptDigit: 7 }
                        le PC affiche "Appuyez sur le 7 sur votre téléphone"
                        le mobile reçoit un carousel RCS de 3 cards (ex: 2, 7, 5)
                        [tap sur la card "7"]  →  GET /otp/tap?t=<tokenDu7>  →  status VERIFIED
                        [tap sur un leurre]    →  token inconnu  →  success=false, status reste PENDING
                        le PC détecte VERIFIED  →  redirige vers le dashboard
```

> Le `promptDigit` retourné par `POST /otp/generate` est le chiffre à afficher sur le PC. Les deux leurres sont générés aléatoirement et mélangés côté serveur — le front ne les connaît jamais.


---

## 9. Commandes utiles

```bash
# Lancer le seed manuellement (depuis le container)
docker compose exec backend npx prisma db seed
```

```bash
# Démarrer le projet
docker compose up --build

# Arrêter le projet
docker compose down

# Arrêter et supprimer les volumes (repart de zéro)
docker compose down -v

# Voir les logs du backend
docker compose logs -f backend

# Entrer dans le container backend
docker compose exec backend sh

# Régénérer les types Prisma sans migration
docker compose exec backend npx prisma generate

# Inspecter la base de données
docker compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB
```

---

## 10. Flux de validation OTP — rappel

```
POST /otp/generate          → envoie le message RCS, retourne challengeId
                              (+ promptDigit en mode GOOGLE_PROMPT)
GET  /otp/status/:id        → polling depuis le PC (toutes les 2s)
GET  /otp/tap?t=<token>     → appelé par le mobile via le bouton RCS → redirect front
POST /otp/verify            → saisie manuelle du code (fallback, mode CLASSIC uniquement)
POST /webhook/rcs           → webhooks smsmode (DLR livraison + MO "Ce n'est pas moi")
```