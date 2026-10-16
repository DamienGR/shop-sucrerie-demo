# Contenu de démonstration de Sucrerie Démo

Tout ce qui fait de cette boutique une démonstration complète, et qui n'est
pas du code : les rayons, les pages, les menus, les réglages et un historique
de commandes fictives. Le catalogue lui-même vit dans `imports/` (le CSV et ses
photographies), comme pour n'importe quelle boutique du socle.

| Fichier | Rôle |
| --- | --- |
| `seed.mjs` | Charge rayons, catalogue, pages, menus et réglages dans une base. |
| `orders.mjs` | Passe des commandes fictives par le vrai parcours d'achat, puis les étale sur 30 jours. |
| `pages/*.md` | Les neuf pages de contenu, une par fichier (titre et mise en page dans l'en-tête). |
| `catalog-extras.json` | L'ordre des nouveautés et le texte alternatif de chaque photographie. |
| `MISE-EN-LIGNE.md` | La procédure pas à pas pour publier la démonstration sur Cloudflare. |

## Charger la boutique en local

```sh
nvm use 22
npm ci
npm run db:migrate
node client/demo/seed.mjs
npm run dev                       # http://localhost:4321
```

Au premier passage, `/admin/setup` demande un mot de passe d'administration.
Une fois la boutique lancée, les commandes fictives :

```sh
node client/demo/orders.mjs http://localhost:4321
```

Le parcours d'achat est limité à vingt requêtes par minute : le script attend
quand le limiteur répond 429, comptez une dizaine de minutes pour 30 commandes.

## Ce que le chargement écrit

- **3 rayons** : Sachets, Coffrets, Cadeaux ;
- **15 produits**, 26 unités vendues (poids de 150 et 300 g, lots de sucettes),
  30 photographies, par `shopctl catalog import` ;
- **9 pages publiées** : l'atelier, les ingrédients et allergènes, la
  livraison, la FAQ, le contact et les quatre pages légales ;
- **les menus** d'en-tête et de pied de page ;
- **les réglages** : nom de la boutique, fuseau horaire, bandeau d'annonce.

Le chargement est rejouable. Le catalogue est idempotent par référence (SKU) ;
les pages sont mises à jour par leur slug ; les deux menus sont **réécrits en
entier**, ce qui écrase une navigation retouchée dans l'administration.

## La couleur de chaque bonbon

Le thème peint chaque produit de la couleur du fond de sa photographie
principale. La table vit dans `src/themes/sucrerie-demo/candy-table.ts`, indexée
par le slug du produit ; elle a été relevée sur les photographies du catalogue.
Un produit créé plus tard dans l'administration, absent de la table, reçoit
automatiquement l'une des quatre couleurs de la marque (framboise, citron,
menthe, violette) : la boutique reste colorée sans intervention dans le code.

## Ce qui est volontairement fictif

La société, son adresse, son SIREN, son téléphone (une plage réservée par
l'ARCEP aux œuvres de fiction) et son e-mail (domaine réservé `.example`) ne
désignent personne. Les clients des commandes de démonstration ont des adresses
en `@example.com`. Les pages légales et le pied de page le disent.

Les photographies ont été générées pour cette démonstration ; elles ne
représentent ni de vrais produits ni de vraies personnes. Les ingrédients et
allergènes sont plausibles mais inventés.

## Avant d'en faire une vraie boutique

1. Remplacer les pages légales et la page des allergènes par les textes du
   commerçant, validés par lui.
2. Vider le catalogue de démonstration, ou le désactiver (`active` à `non` dans
   le CSV), et importer le vrai ; compléter `candy-table.ts` avec ses couleurs.
3. Configurer Stripe dans Admin → Réglages → Paiements : le paiement de
   démonstration disparaît dès qu'un vrai moyen de paiement est actif.
4. Retirer la mention « Boutique de démonstration » du pied de page
   (`src/themes/sucrerie-demo/Footer.astro`).
