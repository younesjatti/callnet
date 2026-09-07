
import { Order, OrderStatus } from "../types";
import { apiClient } from "./apiClient";
import { normalizeStatus } from "../utils";

/**
 * Client-Side Heuristic Fallback for Column Mapping
 * Used when backend/offline mode is encountered.
 */
function localHeuristicSuggestMapping(headers: string[], systemFields: { key: string; label: string }[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  if (!Array.isArray(headers) || headers.length === 0) return mapping;

  const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

  const patterns: Record<string, string[]> = {
    id: ['id', 'code', 'ref', 'reference', 'ncommande', 'numcommande', 'codeenvoi', 'numero', 'orderid', 'ordernumber', 'tracking', 'no', 'identifiant', 'cmd', 'idorder'],
    customerName: ['nom', 'client', 'nomclient', 'destinataire', 'nomprenom', 'nometprenom', 'nomcomplet', 'fullname', 'customer', 'customername', 'name', 'buyer', 'destinatairenom', 'prenom', 'nomdestinataire', 'clientnom', 'acheteurnom'],
    phone: ['tel', 'telephone', 'phone', 'gsm', 'mobile', 'cell', 'whatsapp', 'contact', 'tele', 'numerotel', 'phonenumber', 'telclient', 'telephone1', 'tel1', 'phone1', 'numero', 'numtel', 'telmobile', 'gsm1'],
    price: ['prix', 'price', 'total', 'montant', 'crbt', 'cod', 'amount', 'prixtotal', 'totalmad', 'prixttc', 'montanttotal', 'montantcrbt', 'netapayer', 'valeur', 'prixunitaire', 'totalapayer', 'prixvente'],
    city: ['ville', 'city', 'destination', 'villedestination', 'town', 'gouvernorat', 'wilaya', 'region', 'province', 'villedelivraison'],
    district: ['quartier', 'district', 'secteur', 'zone', 'quartiersecteur', 'commune', 'arrondissement', 'secteurquartier', 'communequartier'],
    address: ['adresse', 'address', 'adressedelivraison', 'rue', 'adressecomplete', 'deliveryaddress', 'location', 'shippingaddress', 'adresseclient', 'lieu', 'adresseexacte'],
    product: ['produit', 'product', 'designation', 'designationproduit', 'article', 'item', 'nomproduit', 'libelle', 'libelleproduit', 'produits', 'articles', 'items'],
    quantity: ['quantite', 'qty', 'qte', 'pieces', 'nbrepieces', 'quantity', 'count', 'nombre', 'qtecommandee', 'quantitecommandee', 'nbr'],
    variant: ['variante', 'taille', 'couleur', 'variant', 'size', 'color', 'pointure', 'modele', 'options', 'taillecouleur'],
    date: ['date', 'datecommande', 'createdat', 'horodatage', 'timestamp', 'datecreation', 'datecmd', 'datesaisie'],
    note: ['note', 'remarque', 'observation', 'commentaire', 'instructions', 'instructionslivraison', 'comment', 'notes', 'remarques', 'obs', 'rem', 'observations'],
    status: ['statut', 'status', 'etat', 'orderstatus', 'statutcommande', 'etatcommande', 'confirmation', 'etatlivraison']
  };

  const normalizedHeaders = headers.map(h => ({ original: h, norm: normalize(h) }));

  for (const field of systemFields) {
    const key = field.key;
    const keyPatterns = patterns[key] || [normalize(key), normalize(field.label)];
    
    let found = normalizedHeaders.find(h => keyPatterns.some(p => h.norm === p));
    if (!found) {
      found = normalizedHeaders.find(h => keyPatterns.some(p => p.length >= 3 && (h.norm.includes(p) || p.includes(h.norm))));
    }

    if (found) {
      mapping[key] = found.original;
    }
  }

  return mapping;
}

export const extractOrderFromText = async (text: string): Promise<Partial<Order> | null> => {
  try {
    const res = await apiClient.apiPost<{ order?: Partial<Order> | null }>('/gemini/extract-order', { text });
    return res.order || null;
  } catch (error) {
    console.error("Gemini Extraction Error via Server:", error);
    return null;
  }
};

export const suggestColumnMapping = async (headers: string[], systemFields: { key: string; label: string }[]): Promise<Record<string, string>> => {
  const localMap = localHeuristicSuggestMapping(headers, systemFields);
  try {
    const fetchPromise = apiClient.apiPost<{ mapping?: Record<string, string>; source?: string }>('/gemini/suggest-mapping', {
      headers,
      systemFields
    });

    const timeoutPromise = new Promise<{ mapping?: Record<string, string> }>((resolve) => 
      setTimeout(() => resolve({ mapping: localMap }), 3500)
    );

    const res = await Promise.race([fetchPromise, timeoutPromise]);
    if (res && res.mapping && Object.keys(res.mapping).length > 0) {
      return { ...localMap, ...res.mapping };
    }
    return localMap;
  } catch (error) {
    console.warn("Server Gemini Mapping failed or timed out, using local heuristic matcher:", error);
    return localMap;
  }
};

/**
 * Map unknown status strings (or note hints) to valid OrderStatus values using AI.
 */
export const mapUnknownStatusesWithAI = async (inputs: string[]): Promise<Record<string, string>> => {
  if (!inputs || inputs.length === 0) return {};
  try {
    const res = await apiClient.apiPost<{ mapping?: Record<string, string> }>('/gemini/map-statuses', { inputs });
    if (res && res.mapping) {
      return res.mapping;
    }
    const fallback: Record<string, string> = {};
    for (const raw of inputs) {
      fallback[raw] = normalizeStatus(raw) || OrderStatus.EnAttend;
    }
    return fallback;
  } catch (error) {
    console.warn("Server Gemini Status Mapping failed, using local fallback:", error);
    const fallback: Record<string, string> = {};
    for (const raw of inputs) {
      fallback[raw] = normalizeStatus(raw) || OrderStatus.EnAttend;
    }
    return fallback;
  }
};

export interface ScannedProductItem {
  id?: string;
  name: string;
  sku: string;
  price: number;
  regularPrice?: number;
  category: string;
  description: string;
  confirmationPitch: string;
  upsellOffer: string;
  stock: number;
  matchedOrdersCount: number;
  variantsFound: string[];
  productUrl?: string;
  imageUrl?: string;
  isExistingInCatalog?: boolean;
  selected?: boolean;
}

/**
 * Clean & format a raw product string from orders.
 */
function cleanRawProductName(raw: string): string {
  if (!raw) return '';
  let cleaned = raw.trim();
  // Remove leading quantity markers like "1x", "2 x", "1*", "Pack:"
  cleaned = cleaned.replace(/^(\d+\s*[xX*]\s*)+/i, '');
  cleaned = cleaned.replace(/^\[.*?\]\s*/i, '');
  cleaned = cleaned.replace(/^(produit|ref|article|item)\s*[:#-]?\s*/i, '');
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
  return cleaned;
}

/**
 * Deduce a realistic category based on product title / keywords.
 */
function deduceCategory(name: string): string {
  const norm = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/creme|serum|huile|masque|visage|peau|savon|shampoing|parfum|levre|cheveux|soin|collagene|cosmetique|beaute|cils|maquillage|fond de teint/i.test(norm)) {
    return "Beauté / Cosmétique";
  }
  if (/montre|watch|ecouteur|airpod|bluetooth|camera|chargeur|smart|led|support|cable|gps|gadget|lampe|batterie|drone|ring|phone|audio|speaker|enceinte/i.test(norm)) {
    return "High-Tech / Électronique";
  }
  if (/cuisine|poele|couteau|hachoir|mixeur|brosse|rangement|aspirateur|rideau|oreiller|tapis|deco|maison|nettoyage|organisateur|douche/i.test(norm)) {
    return "Maison / Déco";
  }
  if (/robe|t-shirt|chemise|pantalon|sac|chaussure|basket|bague|collier|lunette|ceinture|veste|short|montre femme|bijou|sneaker/i.test(norm)) {
    return "Vêtements / Mode";
  }
  if (/amincissant|masseur|dos|genou|posture|articulation|sommeil|sante|thermique|tensiometre|vibrant|ventouse|massage|perte de poids|ceinture/i.test(norm)) {
    return "Santé / Bien-être";
  }
  if (/voiture|auto|moto|pneu|pare-brise|retro|volant|support voiture/i.test(norm)) {
    return "Auto / Moto";
  }
  if (/fitness|musculation|tapis course|haltere|sport|yoga|elastique/i.test(norm)) {
    return "Sport / Fitness";
  }
  return "Général";
}

/**
 * Generate a clean SKU from category and name.
 */
function generateSuggestedSku(name: string, category: string, index: number): string {
  let prefix = "PRD";
  if (category.includes("Beauté")) prefix = "BEA";
  else if (category.includes("High-Tech")) prefix = "TECH";
  else if (category.includes("Maison")) prefix = "HOME";
  else if (category.includes("Mode") || category.includes("Vêtement")) prefix = "MODE";
  else if (category.includes("Santé")) prefix = "CARE";
  else if (category.includes("Sport")) prefix = "FIT";
  else if (category.includes("Auto")) prefix = "AUTO";

  const num = Math.floor(100 + (index % 900) + Math.random() * 80);
  return `SKU-${prefix}-${num}`;
}

/**
 * Local Heuristic Scanner for Products in Orders
 */
export function localHeuristicScanProducts(
  orders: Order[],
  existingProducts: { name: string; sku?: string }[] = []
): {
  scannedProducts: ScannedProductItem[];
  totalOrdersScanned: number;
  alreadyExistingCount: number;
} {
  if (!Array.isArray(orders) || orders.length === 0) {
    return { scannedProducts: [], totalOrdersScanned: 0, alreadyExistingCount: 0 };
  }

  const existingNormNames = new Set(
    existingProducts.map(p => p.name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))
  );

  // Map to group order items
  const productGroups = new Map<string, {
    rawNames: string[];
    prices: number[];
    variants: Set<string>;
    orderCount: number;
    sampleNotes: string[];
  }>();

  let validOrdersCount = 0;

  for (const order of orders) {
    if (!order.product || !order.product.trim()) continue;
    validOrdersCount++;

    const rawName = order.product.trim();
    const cleaned = cleanRawProductName(rawName);
    if (!cleaned || cleaned.length < 2) continue;

    const normKey = cleaned.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Ignore placeholder test words
    if (['test', 'n/a', 'produit', 'article', 'sans nom', 'null', 'undefined'].includes(normKey)) {
      continue;
    }

    if (!productGroups.has(normKey)) {
      productGroups.set(normKey, {
        rawNames: [cleaned],
        prices: [],
        variants: new Set<string>(),
        orderCount: 0,
        sampleNotes: []
      });
    }

    const group = productGroups.get(normKey)!;
    group.orderCount++;
    if (!group.rawNames.includes(cleaned)) {
      group.rawNames.push(cleaned);
    }

    const qty = Math.max(1, Number(order.quantity) || 1);
    const rawPrice = Number(order.price) || 0;
    if (rawPrice > 0) {
      const unitPrice = Math.round(rawPrice / qty);
      group.prices.push(unitPrice);
    }

    if (order.variant && order.variant.trim()) {
      group.variants.add(order.variant.trim());
    }

    if (order.note && order.note.trim() && group.sampleNotes.length < 3) {
      group.sampleNotes.push(order.note.trim());
    }
  }

  const scannedList: ScannedProductItem[] = [];
  let alreadyExistingCount = 0;
  let idx = 1;

  for (const [normKey, group] of productGroups.entries()) {
    const isExisting = existingNormNames.has(normKey);
    if (isExisting) {
      alreadyExistingCount++;
      continue;
    }

    // Pick best name (longest or most capitalized)
    const displayName = group.rawNames.sort((a, b) => b.length - a.length)[0] || normKey;

    // Calculate median price
    let finalPrice = 199;
    if (group.prices.length > 0) {
      const sortedPrices = [...group.prices].sort((a, b) => a - b);
      const mid = Math.floor(sortedPrices.length / 2);
      finalPrice = sortedPrices[mid];
    }

    // Round price nicely (e.g. ends in 9 or 0 if reasonable, or keep exact)
    if (finalPrice <= 0) finalPrice = 199;

    const regularPrice = Math.max(finalPrice + 50, Math.round((finalPrice * 1.35) / 10) * 10 - 1);
    const category = deduceCategory(displayName);
    const sku = generateSuggestedSku(displayName, category, idx++);

    const confirmationPitch = `Vérifier l'adresse de livraison et confirmer la commande pour "${displayName}". Mettre en avant la qualité supérieure, la garantie satisfaction et la livraison rapide sous 24h à 48h.`;
    const upsellOffer = `Proposer une 2ème unité ou pack avantageux avec -30% de remise immédiate (livraison groupée sans frais supplémentaires).`;
    const description = `Article de qualité supérieure sélectionné pour sa fiabilité et sa grande satisfaction client. Idéal pour un usage quotidien.`;

    scannedList.push({
      name: displayName,
      sku,
      price: finalPrice,
      regularPrice,
      category,
      description,
      confirmationPitch,
      upsellOffer,
      stock: 50,
      matchedOrdersCount: group.orderCount,
      variantsFound: Array.from(group.variants),
      isExistingInCatalog: false,
      selected: true
    });
  }

  // Sort by popularity (orders count descending)
  scannedList.sort((a, b) => b.matchedOrdersCount - a.matchedOrdersCount);

  return {
    scannedProducts: scannedList,
    totalOrdersScanned: validOrdersCount,
    alreadyExistingCount
  };
}

/**
 * Smart Scan AI: Analyzes orders, calls Gemini 3.7 server route, and falls back to advanced heuristics.
 */
export async function smartScanProductsWithAI(
  orders: Order[],
  existingProducts: { name: string; sku?: string }[] = [],
  storeName?: string
): Promise<{
  scannedProducts: ScannedProductItem[];
  totalOrdersScanned: number;
  alreadyExistingCount: number;
  source: 'gemini' | 'heuristic';
}> {
  const localResult = localHeuristicScanProducts(orders, existingProducts);

  if (localResult.scannedProducts.length === 0) {
    return {
      ...localResult,
      source: 'heuristic'
    };
  }

  // Extract compact sample of orders for Gemini
  const orderItemsSample = orders
    .filter(o => o.product && o.product.trim())
    .slice(0, 120)
    .map(o => ({
      product: cleanRawProductName(o.product),
      variant: o.variant || undefined,
      price: o.price,
      quantity: o.quantity || 1,
      note: o.note ? o.note.slice(0, 60) : undefined
    }));

  const existingProductNames = existingProducts.map(p => p.name.trim());

  try {
    const fetchPromise = apiClient.apiPost<{ products?: any[]; source?: string }>('/gemini/scan-products', {
      orderItems: orderItemsSample,
      existingProductNames,
      storeName
    });

    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 7000));
    const res: any = await Promise.race([fetchPromise, timeoutPromise]);

    if (res && Array.isArray(res.products) && res.products.length > 0) {
      // Merge AI refined details with local order metrics
      const aiProducts: ScannedProductItem[] = res.products.map((p: any, i: number) => {
        // Find matching local product to preserve exact occurrences count and variants
        const localMatch = localResult.scannedProducts.find(
          lp => lp.name.toLowerCase().includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(lp.name.toLowerCase())
        );

        return {
          name: p.name || localMatch?.name || `Produit ${i + 1}`,
          sku: p.sku || localMatch?.sku || `SKU-AI-${100 + i}`,
          price: Number(p.price) || localMatch?.price || 199,
          regularPrice: Number(p.regularPrice) || localMatch?.regularPrice || Math.round((Number(p.price || 199) * 1.35) / 10) * 10 - 1,
          category: p.category || localMatch?.category || "Général",
          description: p.description || localMatch?.description || "Produit authentique de qualité supérieure.",
          confirmationPitch: p.confirmationPitch || localMatch?.confirmationPitch || "Confirmer le modèle et l'adresse avec le client.",
          upsellOffer: p.upsellOffer || localMatch?.upsellOffer || "Offre 2ème pièce avec remise immédiate.",
          stock: Number(p.stock) || 50,
          matchedOrdersCount: localMatch?.matchedOrdersCount || p.matchedOrdersCount || 1,
          variantsFound: localMatch?.variantsFound || [],
          isExistingInCatalog: false,
          selected: true
        };
      });

      // Also append any local products not covered by AI
      const coveredNames = new Set(aiProducts.map(p => p.name.toLowerCase().trim()));
      for (const lp of localResult.scannedProducts) {
        if (!coveredNames.has(lp.name.toLowerCase().trim())) {
          aiProducts.push(lp);
        }
      }

      aiProducts.sort((a, b) => b.matchedOrdersCount - a.matchedOrdersCount);

      return {
        scannedProducts: aiProducts,
        totalOrdersScanned: localResult.totalOrdersScanned,
        alreadyExistingCount: localResult.alreadyExistingCount,
        source: 'gemini'
      };
    }
  } catch (err) {
    console.warn("Gemini Scan Products fallback to heuristics:", err);
  }

  return {
    ...localResult,
    source: 'heuristic'
  };
}
