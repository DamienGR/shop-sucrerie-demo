import type { DeepPartial, SiteConfig } from './config';

/**
 * Réglages de construction de Sucrerie Démo. Seules les valeurs qui diffèrent
 * des défauts de `config.ts` sont listées ; elles sont fusionnées par-dessus.
 *
 * La livraison ci-dessous est le point de départ d'une boutique neuve : une fois
 * enregistrée depuis Admin → Shipping, c'est l'administration qui fait foi.
 */
export const storeOverrides: DeepPartial<SiteConfig> = {
  // Le nom affiché là où le réglage de l'administration n'est pas lu (page de
  // paiement, llms.txt, libellé des factures Lightning).
  storeName: 'Sucrerie Démo',

  // Premier numéro de commande : 2000.
  orderNumber: { offset: 2000, step: 1, randomStep: 0 },

  shipping: {
    enabled: true,
    // Boîte, papier de soie et calage, comptés une fois par colis.
    packageWeightGrams: 180,
    zones: [
      {
        countries: ['FR'],
        rates: [
          { label: 'Colissimo suivi, 48 h', amountCents: 490 },
          { label: 'Point relais, 3 à 5 jours', amountCents: 350 },
        ],
        // Livraison offerte dès 45 € : c'est la promesse affichée dans le thème.
        freeOverCents: 4500,
      },
    ],
  },
};
