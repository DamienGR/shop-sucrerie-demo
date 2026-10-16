# Mettre la démonstration en ligne

Ce guide publie Sucrerie Démo sur Cloudflare, dans l'environnement `staging` du
socle, à une adresse `https://minshop-sucrerie-demo-staging.<votre-sous-domaine>.workers.dev`.
Comptez trente à quarante-cinq minutes, dont une bonne moitié d'attente.

Tout se fait depuis le dépôt de la boutique, sous Node 22. Les commandes sont à
copier telles quelles ; seules les valeurs entre chevrons sont à remplacer.

## 0. Ce qu'il faut avant de commencer

1. **Un compte Cloudflare.** Le plan gratuit suffit pour la démonstration.
2. **R2 activé sur ce compte.** Tableau de bord Cloudflare, menu *R2 Object
   Storage*, bouton d'activation. Cloudflare demande un moyen de paiement même
   pour l'offre gratuite ; la démonstration reste très loin des seuils payants
   (10 Go stockés, 1 million d'écritures par mois). Sans cette activation, la
   création des buckets échoue.
3. **Un sous-domaine `workers.dev`.** Tableau de bord, menu *Workers & Pages* :
   à la première visite, Cloudflare demande de choisir le sous-domaine du
   compte. C'est lui qui formera l'adresse publique de la démonstration.
4. **Node 22 et les dépendances installées** dans le dépôt :

   ```sh
   git clone https://github.com/DamienGR/shop-sucrerie-demo.git
   cd shop-sucrerie-demo
   nvm use 22
   npm ci
   npm ci --prefix mcp
   ```

   Si vous travaillez dans la copie locale déjà présente, placez-vous sur la
   branche qui contient la démonstration et lancez seulement `nvm use 22`.

## 1. Connecter Wrangler à Cloudflare

Sous WSL2, avec le navigateur de Windows :

```sh
node scripts/wrangler-login-wsl.mjs
```

Ailleurs :

```sh
npx wrangler login
```

Vérifiez ensuite le compte et notez son identifiant (32 caractères
hexadécimaux, colonne *Account ID*) :

```sh
npx wrangler whoami
```

## 2. Désigner le compte

Le socle ne devine jamais le compte Cloudflare. Pour toute la session :

```sh
export CLOUDFLARE_ACCOUNT_ID=<identifiant du compte>
```

Pour l'inscrire durablement, ajoutez la ligne `accountId: <identifiant>` sous
`cloudflare:` dans `client/client.yaml` et commitez-la : un identifiant de
compte n'est pas un secret.

## 3. Créer les ressources

Une simulation d'abord, qui n'écrit rien :

```sh
npm run shopctl -- provision --env staging --dry-run
```

Puis la création réelle : la base D1 `minshop-sucrerie-demo-staging-db`, les
buckets R2 `minshop-sucrerie-demo-staging-images` et `-files` en juridiction
européenne, et les deux secrets internes du Worker.

```sh
npm run shopctl -- provision --env staging
```

La commande est rejouable : relancée, elle ne recrée rien.

## 4. Déployer

```sh
npm run shopctl -- deploy --env staging
```

Elle enchaîne la suite de vérification complète (plusieurs minutes), les
migrations, la construction, l'envoi du Worker et un test de fumée. À la fin,
elle affiche l'adresse publique : notez-la, elle sert aux étapes suivantes.

## 5. Créer le compte d'administration, tout de suite

Tant qu'aucun mot de passe n'existe, la page d'installation est ouverte à qui
la trouve. Ouvrez sans attendre :

```
https://minshop-sucrerie-demo-staging.<sous-domaine>.workers.dev/admin/setup
```

- **Nom de la boutique** : `Sucrerie Démo` ;
- **Fuseau horaire** : `Europe/Paris` ;
- **Mot de passe** : une phrase longue, rangée dans votre gestionnaire ;
- **Ne cochez pas** le catalogue de démonstration du socle : celui de Sucrerie
  Démo est chargé à l'étape suivante.

## 6. Charger la boutique

Rayons, 15 produits et leurs 30 photographies, pages, menus et réglages :

```sh
node client/demo/seed.mjs --remote --env staging
```

Puis l'historique de commandes fictives, pour que le tableau de bord ait
quelque chose à montrer (une dizaine de minutes : le parcours d'achat est
limité à vingt requêtes par minute et le script attend son tour) :

```sh
node client/demo/orders.mjs https://minshop-sucrerie-demo-staging.<sous-domaine>.workers.dev --remote --env staging
```

## 7. Remettre le dépôt au propre

Le déploiement a réécrit `wrangler.jsonc` pour l'environnement `staging`. Ce
fichier est généré et ne doit pas être commité dans cet état :

```sh
git checkout -- wrangler.jsonc
git status --short
```

## 8. Vérifier

- la vitrine : l'accueil (titre qui gonfle, bonbons qui tombent), un rayon, une
  fiche produit teintée de sa couleur, une recherche (« guimauve ») ;
- un achat complet : ajout au panier, case des CGV, « Commande de
  démonstration », paiement simulé, page de confirmation ;
- l'administration (`/admin`) : tableau de bord, commandes, produits, pages,
  navigation.

## En option

| Pour | Où |
| --- | --- |
| Une adresse à vous plutôt que `workers.dev` | `cloudflare.stagingDomain` dans `client/client.yaml`, sur une zone de votre compte, derrière une application Cloudflare Access (voir `docs/agents/shopctl.md`) |
| Le vrai paiement par carte, en mode test | Admin → Réglages → Paiements, clés de test Stripe ; le paiement de démonstration disparaît alors |
| Les e-mails de confirmation | Admin → Réglages → E-mail, clé Resend et domaine d'expédition vérifié |
| Le déploiement depuis GitHub | `npm run shopctl -- repo --public` avec `CLOUDFLARE_API_TOKEN` exporté, puis l'action *Deploy* du dépôt |
| La supervision nocturne | Réactiver le workflow *Nightly* (désactivé tant que rien n'est déployé), voir `docs/agents/remote-gates.md` |

## Retirer la démonstration

Irréversible : la base, les buckets et le Worker de `staging` sont supprimés.
Les buckets doivent d'abord être vidés depuis le tableau de bord R2.

```sh
npm run shopctl -- destroy --env staging --confirm sucrerie-demo
```

## En cas d'échec

| Message | Cause probable | Que faire |
| --- | --- | --- |
| `wrangler n'est pas authentifié` | session Wrangler expirée | refaire l'étape 1 |
| `aucun compte désigné` ou deux comptes en désaccord | `CLOUDFLARE_ACCOUNT_ID` absent ou différent du manifeste | refaire l'étape 2 |
| `Please enable R2` à la création d'un bucket | R2 pas encore activé | point 2 de l'étape 0, puis relancer `provision` |
| `wrangler.jsonc ne décrit pas l'environnement staging` | `seed.mjs` lancé avant `deploy` ou après l'étape 7 | relancer `npm run shopctl -- deploy --env staging` |
| Le test de fumée échoue juste après le déploiement | propagation du sous-domaine `workers.dev` | attendre une minute et relancer `deploy` |
| `/admin/setup` répond 403 | la page est fermée : un mot de passe existe déjà | se connecter sur `/admin/login`, ou voir `docs/operations/runbooks/mot-de-passe-admin.md` |
