
export enum OrderStatus {
  Confirme = 'confirme',
  Expedie = 'expedie',
  Expider = 'expider',
  PasDeRep1 = 'pas de rep 1',
  PasDeRep2 = 'pas de rep 2',
  PasDeRep3 = 'pas de rep 3',
  PasDeRep4 = 'pas de rep 4',
  PasDeRep5 = 'pas de rep 5',
  Injoignable1 = 'injoignable 1',
  Injoignable2 = 'injoignable 2',
  Injoignable3 = 'injoignable 3',
  Injoignable4 = 'injoignable 4',
  EnAttend = 'en attend',
  Reporter = 'reporter',
  Reportee = 'reportee',
  NonCommandee = 'non commandee',
  Whatsapp = 'whatsapp',
  Annule = 'annule',
  NumIncorect = 'num incorect',
  FauxNumero = 'faux numero',
  PersonneIncorrecte = 'personne incorrecte',
  Expire = 'expire',
  EnDouble = 'en double',
  HorsZone = 'hors zone',
}

export enum Role {
  Admin = 'Admin',
  Manager = 'Manager',
  Client = 'Client',
  Agent = 'Agent',
}

export interface AgentPerformanceMetrics {
  agentId: string;
  agentName: string;
  agentEmail: string;
  agentAvatar?: string;
  phone?: string;
  assignedClientIds: string[];
  totalAssignedOrders: number;
  totalProcessedOrders: number;
  confirmedCount: number;
  confirmedRate: number;
  cancelledCount: number;
  cancelledRate: number;
  unreachableCount: number;
  unreachableRate: number;
  pendingCount: number;
  totalConfirmedRevenue: number;
  averageBasketConfirmed: number;
  rank?: number;
  performanceBadge?: string;
}

export interface GoogleSheetIntegration {
  id: string;
  spreadsheetId: string;
  sheetUrl: string;
  sheetTitle: string;
  fileName: string;
  status: boolean;
  columnMapping?: Record<string, string>;
  lastSyncedAt?: string;
  orderCount?: number;
  autoSync?: boolean;
  createdAt?: string;
}

export interface EcommercePlatformConfig {
  id: string;
  platform: 'shopify' | 'youcan' | 'storeep' | 'woocommerce' | 'lightfunnels' | 'storeino' | 'easyorders' | 'api' | 'magento';
  storeName: string;
  storeUrl?: string;
  apiKey?: string;
  apiSecret?: string;
  status: boolean;
  webhookUrl?: string;
  createdAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: Role;
  assignedClientIds?: string[]; // Only for Agents
  googleSheetUrl?: string;
  selectedSheet?: string; // The specific sheet name to sync from
  autoSync?: boolean;
  autoSyncInterval?: number; // In seconds (e.g. 60, 120, 300)
  lastAutoSyncedAt?: string;
  columnMapping?: Record<string, string>;
  googleSheets?: GoogleSheetIntegration[]; // Multiple Google Sheets support
  ecommercePlatforms?: EcommercePlatformConfig[];
  logoData?: string | null;
  logoScale?: number;
  avatarUrl?: string;
  phone?: string;
  primaryCourier?: CourierProvider;
}

export interface Order {
  id: string;
  customerName: string;
  product: string;
  productName?: string;
  quantity: number;
  variant?: string;
  price: number;
  date: string;
  status: OrderStatus;
  phone: string;
  address: string;
  city: string;
  cityId?: string | number;
  district?: string;
  note?: string;
  comment?: string;
  clientId: string;
  sheetSource?: string;
  sheetId?: string;
  archived?: boolean;
  _rowIndex?: number | string;
  trackingNumber?: string;
  courierName?: string;
  courierStatus?: string;
  shippedAt?: string;
  courierParcelId?: string;
  courierNote?: string;
}

export type CourierProvider = 
  | 'ozon_express' 
  | 'kargo_express' 
  | 'digylog' 
  | 'cathedis' 
  | 'ameex' 
  | 'irsaliyat' 
  | 'onessta' 
  | 'forcelog' 
  | 'chrono_diali' 
  | 'sendit' 
  | 'ecotrack' 
  | 'ozone' 
  | 'custom_api';

export interface CourierApiConfig {
  id: string;
  provider: CourierProvider;
  name: string;
  logoUrl?: string;
  isEnabled: boolean;
  isPrimary?: boolean; // Primary courier for this vendor / store
  apiKey: string; // Token / API Key
  clientId: string; // e.g. YOUR_ID in ozon/kargo or network ID in digylog
  apiSecret?: string; // e.g. store name/ID in digylog
  apiBaseUrl?: string; // default https://api.ozonexpress.ma or https://api.digylog.com/api/v2/seller
  isStock?: boolean; // parcel-stock: 1 if stock, 0 if ramassage
  allowOpenParcel?: boolean; // parcel-open / openproduct: 1 if Ouvrir, 0/2 if Ne pas ouvrir
  isFragile?: boolean; // parcel-fragile: 1 if Oui, 0 if Non (default = 0)
  isReplace?: boolean; // parcel-replace: 1 if Oui, 0 if Non (default = 0)
  defaultNature?: string; // e.g. "Vêtements / E-commerce"
  storeOwnerId?: string; // clientId associated with this config
  webhookSecret?: string;
  citiesCount?: number;
  lastSyncedAt?: string;
  digylogNetworkId?: number;
  digylogStoreId?: string;
  digylogSentType?: number; // 0 = not send, 1 = delivery service (default), 2 = call center
  digylogPort?: number; // 1 = Customer (default), 2 = Seller
  digylogCheckDuplicate?: boolean;
  digylogCanTry?: boolean;
  networkId?: number;
  store?: string;
  storeName?: string;
  sentType?: number;
  port?: number;
  checkDuplicate?: boolean;
  canTry?: boolean;
  orderType?: 'standard' | 'stock';
  fc?: number;
  pickupCity?: string; // Default pickup/sender city chosen from official courier cities
  pickupCityId?: string | number;
  defaultCity?: string; // Default city reference
  createdAt?: string;
  updatedAt?: string;
}

export interface CourierCity {
  id: string | number;
  name: string;
  code?: string;
  courier?: CourierProvider;
  hub?: string;
  zone?: string;
  deliveredPrice?: number;
  returnedPrice?: number;
  refusedPrice?: number;
  aliases?: string[];
}

export interface ParcelShipmentResult {
  orderId: string;
  trackingNumber: string;
  courier: string;
  status: 'success' | 'error';
  message?: string;
  receiver?: string;
  city?: string;
  price?: number | string;
  responseDetails?: any;
  timestamp: string;
}

export interface Product {
  id: string;
  name: string;
  sku?: string;
  price: number;
  regularPrice?: number;
  productUrl?: string; // Website / landing page link
  imageUrl?: string; // Direct image URL or base64 data
  description?: string;
  confirmationPitch?: string; // Sales pitch & confirmation instructions for agents
  upsellOffer?: string; // Recommended upsell offer
  stock?: number;
  category?: string;
  clientId: string; // Store / Client owner ID
  clientName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StaticColumn {
  id: string;
  header: string;
  defaultValue: string;
}

export interface ShippingTemplate {
  id: string;
  name: string;
  companyName?: string;
  description?: string;
  mapping: Record<string, string>; // Maps system keys to custom header names
  columnOrder?: string[]; // Array of system keys in export order
  enabledKeys?: string[]; // Array of system keys that are exported
  staticColumns?: StaticColumn[]; // Custom static/fixed value columns (e.g. Type envoi = 'Livraison')
  filenamePrefix?: string;
  sheetName?: string;
}

export const ORDER_FIELDS: { key: keyof Order; label: string; required?: boolean }[] = [
    { key: 'id', label: 'Order ID', required: false },
    { key: 'customerName', label: 'Customer Name', required: true },
    { key: 'phone', label: 'Phone', required: true },
    { key: 'city', label: 'City', required: false },
    { key: 'district', label: 'Quartier / District', required: false },
    { key: 'address', label: 'Address', required: false },
    { key: 'product', label: 'Product', required: true },
    { key: 'quantity', label: 'Quantity', required: false },
    { key: 'variant', label: 'Variant', required: false },
    { key: 'price', label: 'Price', required: true },
    { key: 'date', label: 'Date', required: false },
    { key: 'note', label: 'Note', required: false },
    { key: 'status', label: 'Status', required: false },
];

export interface AuditLog {
    id: string;
    timestamp: string;
    userEmail: string;
    userName?: string;
    action: string;
    category: 'auth' | 'orders' | 'users' | 'user' | 'system' | 'security' | 'sync' | 'database' | 'product' | 'products';
    details: string;
    status: 'success' | 'warning' | 'error';
    ip?: string;
}

export interface DatabaseConfig {
    masterSheetUrl: string;
    status: 'connected' | 'disconnected' | 'syncing' | 'error';
    lastSync?: string;
    lastPingLatencyMs?: number;
    autoSyncInterval: number; // in seconds
    autoSyncEnabled: boolean;
    syncStats?: {
        usersCount: number;
        ordersCount: number;
        logsCount: number;
        storesCount: number;
    };
    detectedSheets?: string[];
    schemaStatus?: {
        users: boolean;
        logs: boolean;
        orders: boolean;
        settings: boolean;
    };
    lastError?: string;
}

export interface PlatformMessage {
    id: string;
    conversationId: string;
    senderId: string;
    senderName: string;
    senderRole: Role;
    senderAvatar?: string;
    recipientId?: string;
    recipientName?: string;
    storeId: string;
    storeName?: string;
    content: string;
    orderRefId?: string;
    orderCustomerName?: string;
    createdAt: string;
    readBy: string[];
}

export type CustomerSegment = 'all' | 'vip' | 'repeat' | 'new' | 'prospect' | 'high_value';

export interface CustomerProductSummary {
    name: string;
    variant?: string;
    count: number;
    totalAmount: number;
    lastPurchasedDate: string;
}

export interface CustomerProfile {
    id: string;
    name: string;
    phone: string;
    normalizedPhone: string;
    whatsappPhone: string;
    city: string;
    district?: string;
    address?: string;
    totalOrders: number;
    confirmedOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    unreachableOrders: number;
    pendingOrders: number;
    totalSpend: number;
    averageSpend: number;
    firstOrderDate: string;
    lastOrderDate: string;
    products: CustomerProductSummary[];
    orders: Order[];
    segment: 'vip' | 'repeat' | 'new' | 'prospect' | 'high_value';
    notes?: string[];
}


