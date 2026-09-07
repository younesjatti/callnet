import { pgTable, text, boolean, numeric, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  role: text('role').notNull(),
  assignedClientIds: text('assigned_client_ids').array(),
  googleSheetUrl: text('google_sheet_url'),
  selectedSheet: text('selected_sheet'),
  autoSync: boolean('auto_sync').default(false),
  autoSyncInterval: integer('auto_sync_interval').default(120),
  lastAutoSyncedAt: timestamp('last_auto_synced_at'),
  columnMapping: jsonb('column_mapping'),
  logoData: text('logo_data'),
  logoScale: numeric('logo_scale', { precision: 4, scale: 2 }).default('1.00'),
  avatarUrl: text('avatar_url'),
  phone: text('phone'),
  createdAt: timestamp('created_at').defaultNow()
});

export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  customerName: text('customer_name').notNull(),
  product: text('product').notNull(),
  quantity: integer('quantity').default(1),
  variant: text('variant'),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  date: text('date').notNull(),
  status: text('status').notNull(),
  phone: text('phone').notNull(),
  address: text('address').notNull(),
  city: text('city'),
  district: text('district'),
  note: text('note'),
  clientId: text('client_id'),
  archived: boolean('archived').default(false),
  rowIndex: text('row_index'),
  createdAt: timestamp('created_at').defaultNow()
});

export const products = pgTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sku: text('sku'),
  price: numeric('price', { precision: 10, scale: 2 }).notNull().default('0.00'),
  regularPrice: numeric('regular_price', { precision: 10, scale: 2 }),
  productUrl: text('product_url'),
  imageUrl: text('image_url'),
  description: text('description'),
  confirmationPitch: text('confirmation_pitch'),
  upsellOffer: text('upsell_offer'),
  stock: integer('stock').default(0),
  category: text('category'),
  clientId: text('client_id').notNull(),
  clientName: text('client_name'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const shippingTemplates = pgTable('shipping_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  companyName: text('company_name'),
  description: text('description'),
  mapping: jsonb('mapping').notNull(),
  columnOrder: text('column_order').array(),
  enabledKeys: text('enabled_keys').array(),
  staticColumns: jsonb('static_columns'),
  filenamePrefix: text('filename_prefix'),
  sheetName: text('sheet_name'),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const platformMessages = pgTable('platform_messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull(),
  senderId: text('sender_id').notNull(),
  senderName: text('sender_name').notNull(),
  senderRole: text('sender_role').notNull(),
  senderAvatar: text('sender_avatar'),
  recipientId: text('recipient_id'),
  recipientName: text('recipient_name'),
  storeId: text('store_id').notNull(),
  storeName: text('store_name'),
  content: text('content').notNull(),
  orderRefId: text('order_ref_id'),
  orderCustomerName: text('order_customer_name'),
  createdAt: timestamp('created_at').defaultNow(),
  readBy: text('read_by').array().default([])
});

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  timestamp: timestamp('timestamp').defaultNow(),
  userEmail: text('user_email').notNull(),
  action: text('action').notNull(),
  category: text('category'),
  details: text('details'),
  status: text('status').default('success')
});
