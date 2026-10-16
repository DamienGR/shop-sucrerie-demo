import { CANDY_TABLE } from './candy-table';

/**
 * Sucrerie Démo : la couleur de chaque bonbon.
 *
 * Chaque produit est photographié sur un fond de sa propre couleur, et la
 * boutique reprend cette couleur partout où il apparaît : le galet de sa carte,
 * le fond de sa fiche, son prix. Le socle n'a pas de champ « couleur » sur un
 * produit, et ce n'est pas une donnée de commerce : c'est un choix de design.
 * La table vit donc dans le thème, indexée par le slug du produit.
 *
 * Un produit créé plus tard dans l'administration, absent de la table, reçoit
 * l'une des quatre couleurs de la marque, toujours la même pour un même slug :
 * la boutique reste colorée sans que personne ait à toucher au code.
 */
export interface Candy {
  /** Le fond de la photographie : le galet, la pastille de prix. */
  vivid: string;
  /** La teinte claire : le fond de la fiche produit. */
  pale: string;
  /** La couleur foncée, lisible en texte sur la teinte claire (4,5:1). */
  deep: string;
  /** Le texte posé sur la couleur vive : prune ou blanc. */
  ink: string;
}

export const BRAND_CANDIES: Candy[] = [
  { vivid: '#ff3d7f', pale: '#ffe0eb', deep: '#b82c67', ink: '#3a0f3d' }, // framboise
  { vivid: '#ffd23f', pale: '#fff8e0', deep: '#91653e', ink: '#3a0f3d' }, // citron
  { vivid: '#2fd69a', pale: '#def8ef', deep: '#34766d', ink: '#3a0f3d' }, // menthe
  { vivid: '#6b47f5', pale: '#e7e2fd', deep: '#6443e6', ink: '#ffffff' }, // violette
];

/** Slug d'un lien produit (`/products/<slug>`) ou slug brut. */
const slugOf = (hrefOrSlug: string) => hrefOrSlug.split('?')[0].split('/').filter(Boolean).pop() ?? '';

export function candyFor(hrefOrSlug: string): Candy {
  const slug = slugOf(hrefOrSlug);
  const known = CANDY_TABLE[slug];
  if (known) return known;
  let hash = 0;
  for (const char of slug) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return BRAND_CANDIES[hash % BRAND_CANDIES.length];
}

/**
 * La fiche produit ne connaît pas son URL (un gabarit ne lit pas la requête),
 * mais son nom : le slug d'un produit importé en est dérivé, par la même règle
 * que shopctl/src/catalog/contract.mjs.
 */
export function candyForName(name: string): Candy {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return candyFor(slug);
}

/** Les quatre propriétés CSS qu'un élément reçoit pour se peindre d'un bonbon. */
export function candyStyle(candy: Candy): string {
  return `--candy:${candy.vivid};--candy-pale:${candy.pale};--candy-deep:${candy.deep};--candy-ink:${candy.ink}`;
}

/**
 * Des galets, pas des cartes : chaque carte a ses propres arrondis et sa propre
 * inclinaison, choisis par sa position pour que la page soit stable d'un rendu
 * à l'autre (pas de hasard, donc pas de saut au rechargement).
 */
const PEBBLES = [
  '57% 43% 52% 48% / 46% 55% 45% 54%',
  '44% 56% 41% 59% / 58% 44% 56% 42%',
  '62% 38% 55% 45% / 50% 60% 40% 50%',
  '47% 53% 63% 37% / 41% 47% 53% 59%',
  '52% 48% 38% 62% / 62% 43% 57% 38%',
];
const TILTS = ['-2.2deg', '1.6deg', '-0.8deg', '2.4deg', '-1.6deg', '0.9deg'];

export function pebble(index: number): string {
  return `--pebble:${PEBBLES[index % PEBBLES.length]};--tilt:${TILTS[index % TILTS.length]}`;
}
