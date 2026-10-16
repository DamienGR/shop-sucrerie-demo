#!/usr/bin/env node
// Passe des commandes de démonstration sur une boutique qui tourne, par le vrai
// parcours d'achat (panier, livraison, CGV, paiement « Démo »), puis les étale
// sur les dernières semaines et marque les plus anciennes comme expédiées, pour
// que le tableau de bord de l'administration ait quelque chose à montrer.
//
//   node client/demo/orders.mjs http://127.0.0.1:4321              # base locale
//   node client/demo/orders.mjs https://<staging> --remote --env staging
//
// Les clients sont fictifs et leurs adresses en @example.com : aucun e-mail ne
// peut partir vers une vraie personne. À ne jamais lancer contre une boutique
// qui a de vrais clients.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const base = (args.find((a) => /^https?:\/\//.test(a)) ?? '').replace(/\/+$/, '');
const remote = args.includes('--remote');
const env = args.includes('--env') ? args[args.indexOf('--env') + 1] : null;
const count = Number(args.find((a) => /^\d+$/.test(a)) ?? 30);
if (!base || (remote && !env)) {
  console.error('Usage : node client/demo/orders.mjs <url de la boutique> [nombre] [--remote --env <staging|production>]');
  process.exit(2);
}

const CUSTOMERS = [
  ['Camille Martin', '14 rue Oberkampf', '75011', 'Paris'],
  ['Lucas Bernard', '3 place Bellecour', '69002', 'Lyon'],
  ['Léa Dubois', '27 cours Julien', '13006', 'Marseille'],
  ['Hugo Thomas', '8 rue Sainte-Catherine', '33000', 'Bordeaux'],
  ['Chloé Robert', '41 rue Nationale', '59000', 'Lille'],
  ['Louis Richard', '12 quai de la Fosse', '44000', 'Nantes'],
  ['Manon Petit', '5 rue des Tanneurs', '67000', 'Strasbourg'],
  ['Arthur Durand', '19 allée Jean-Jaurès', '31000', 'Toulouse'],
  ['Inès Leroy', '2 rue de la Monnaie', '35000', 'Rennes'],
  ['Jules Moreau', '33 boulevard Victor-Hugo', '06000', 'Nice'],
  ['Zoé Simon', '7 rue du Bât-d’Argent', '69001', 'Lyon'],
  ['Gabriel Laurent', '60 rue de Rivoli', '75004', 'Paris'],
  ['Alice Lefebvre', '15 rue Foch', '34000', 'Montpellier'],
  ['Raphaël Michel', '9 rue de Siam', '29200', 'Brest'],
  ['Juliette Garcia', '22 rue des Martyrs', '75009', 'Paris'],
  ['Nathan David', '4 place du Capitole', '31000', 'Toulouse'],
  ['Emma Bertrand', '18 rue Lepic', '75018', 'Paris'],
  ['Adam Roux', '11 rue Gambetta', '37000', 'Tours'],
  ['Lina Vincent', '26 rue Esquermoise', '59800', 'Lille'],
  ['Paul Fournier', '1 rue du Palais', '17000', 'La Rochelle'],
];

// Un générateur pseudo-aléatoire à graine fixe : deux exécutions passent les
// mêmes commandes, dans le même ordre.
let seed = 20261016;
const random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (list) => list[Math.floor(random() * list.length)];
const slug = (text) => text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, '.');

class Session {
  cookies = new Map();
  async request(path, { method = 'GET', form } = {}) {
    const headers = { Origin: base, Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ') };
    let body;
    if (form) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(form).toString();
    }
    let response = await fetch(base + path, { method, headers, body, redirect: 'manual' });
    // Le limiteur du parcours d'achat compte vingt requêtes par minute : on
    // attend qu'il se vide plutôt que d'échouer.
    for (let attempt = 0; response.status === 429 && attempt < 3; attempt += 1) {
      process.stdout.write('…');
      await new Promise((done) => setTimeout(done, 61_000));
      response = await fetch(base + path, { method, headers, body, redirect: 'manual' });
    }
    for (const line of response.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const at = pair.indexOf('=');
      this.cookies.set(pair.slice(0, at).trim(), pair.slice(at + 1).trim());
    }
    return response;
  }
}

async function catalogue() {
  const response = await fetch(`${base}/api/products?limit=100`);
  if (!response.ok) throw new Error(`/api/products a répondu ${response.status}`);
  const { products } = await response.json();
  const detailed = await Promise.all(
    products.map((p) => fetch(`${base}/api/products/${p.slug}`).then((r) => r.json())),
  );
  return detailed.filter((p) => p.in_stock);
}

async function placeOrder(products, customer, index) {
  const session = new Session();
  const lines = random() < 0.55 ? 1 : random() < 0.75 ? 2 : 3;
  let subtotal = 0;
  const chosen = new Set();
  for (let i = 0; i < lines; i += 1) {
    const product = pick(products);
    if (chosen.has(product.id)) continue;
    chosen.add(product.id);
    const form = { _action: 'add', product_id: product.id };
    if (product.variants?.length) {
      const available = product.variants.filter((v) => v.in_stock);
      if (available.length === 0) continue;
      const variant = available[Math.min(available.length - 1, Math.floor(random() * available.length))];
      form.variant_id = variant.id;
      subtotal += variant.price.cents;
    } else {
      subtotal += product.price.cents;
    }
    await session.request('/api/cart', { method: 'POST', form });
  }
  if (chosen.size === 0) return null;

  const [name, line1, postal, city] = customer;
  // Une même cliente garde son adresse : les commandes répétées se regroupent
  // sous une seule fiche client dans l'administration.
  const email = `${slug(name)}@example.com`.replace(/\.@/, '@');
  const shipping = subtotal >= 4500 ? 'Livraison offerte' : random() < 0.65 ? 'Colissimo suivi, 48 h' : 'Point relais, 3 à 5 jours';
  const checkout = await session.request('/checkout', {
    method: 'POST',
    form: { method: 'demo', email, name, line1, line2: '', city, state: '', postal, country: 'FR', shipping_label: shipping, accept_terms: 'on' },
  });
  const location = (response) => {
    const value = response.headers.get('location');
    return value ? new URL(value, base).pathname : null;
  };
  const payPath = location(checkout);
  if (!payPath || !payPath.startsWith('/pay/')) {
    throw new Error(`commande ${index + 1} : /checkout a répondu ${checkout.status} vers ${payPath ?? 'rien'} au lieu de /pay/.`);
  }
  const paid = await session.request(payPath, { method: 'POST', form: { email, outcome: 'approve' } });
  const orderPath = location(paid);
  if (!orderPath) throw new Error(`commande ${index + 1} : le paiement démo a répondu ${paid.status}.`);
  const page = await session.request(orderPath).then((r) => r.text());
  const number = /n°\s*([a-z0-9]+)/i.exec(page)?.[1];
  if (!number) throw new Error(`commande ${index + 1} : numéro introuvable sur ${orderPath}.`);
  return `ord_${number}`;
}

if (remote) {
  const config = readFileSync(join(ROOT, 'wrangler.jsonc'), 'utf8');
  if (!config.includes(`-${env}-db`) || config.includes('00000000-0000-0000-0000-000000000000')) {
    console.error(`wrangler.jsonc ne décrit pas l'environnement ${env}. Lancez d'abord : npm run shopctl -- deploy --env ${env}`);
    process.exit(4);
  }
}

const products = await catalogue();
console.log(`▸ ${count} commandes sur ${base} (${products.length} produits disponibles)`);
const placed = [];
for (let i = 0; i < count; i += 1) {
  const customer = i < CUSTOMERS.length ? CUSTOMERS[i] : pick(CUSTOMERS);
  // Un poids peut s'épuiser en cours de route : la commande est sautée, la
  // série continue.
  const id = await placeOrder(products, customer, i).catch((error) => {
    console.warn(`\n! ${error.message}`);
    return null;
  });
  if (id) {
    placed.push(id);
    process.stdout.write('.');
  }
}
console.log(`\n✓ ${placed.length} commandes passées`);

// Les plus anciennes d'abord : la première commande passée remonte à 30 jours,
// la dernière date d'aujourd'hui. Au-delà de trois jours, le colis est parti.
const statements = placed.map((id, i) => {
  const daysAgo = Math.round(30 - (30 * i) / Math.max(1, placed.length - 1));
  const hours = 9 + Math.floor(random() * 12);
  const minutes = Math.floor(random() * 60);
  // Le jour même, l'heure est prise dans le passé : jamais de commande future.
  const when = daysAgo === 0
    ? `datetime('now', '-${20 + Math.floor(random() * 240)} minutes')`
    : `datetime('now', 'start of day', '-${daysAgo} days', '+${hours} hours', '+${minutes} minutes')`;
  const shipped = daysAgo > 3
    ? `, fulfillment_status = 'fulfilled', tracking_carrier = 'colissimo', tracking_number = '6A${String(20000000000 + i * 7919).slice(0, 11)}', fulfilled_at = datetime(${when}, '+1 day')`
    : '';
  return `UPDATE orders SET created_at = ${when}${shipped} WHERE public_id = '${id}';`;
});
const directory = mkdtempSync(join(tmpdir(), 'sucrerie-demo-orders-'));
try {
  const file = join(directory, 'orders.sql');
  writeFileSync(file, `${statements.join('\n')}\n`, 'utf8');
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'DB', remote ? '--remote' : '--local', '--file', file, '--yes'], {
    cwd: ROOT,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
} finally {
  rmSync(directory, { recursive: true, force: true });
}
console.log('✓ Dates étalées sur 30 jours, commandes de plus de 3 jours marquées expédiées.');
