import Dexie, { Table } from 'dexie';

export interface AppUser {
  id?: string;
  name: string;
  email: string;
  password?: string;
  role: 'admin' | 'kasir';
  createdAt: number;
  updatedAt: number;
  synced: boolean;
  deleted: boolean;
}

export interface Product {
  id?: string;
  name: string;
  categoryId: string;
  barcode: string;
  buyPrice: number;
  sellPrice: number;
  stock: number;
  imageUrl?: string;
  createdAt: number;
  updatedAt: number;
  synced: boolean;
  deleted: boolean;
}

export interface Category {
  id?: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  synced: boolean;
  deleted: boolean;
}

export interface Customer {
  id?: string;
  name: string;
  phone: string;
  address?: string;
  createdAt: number;
  updatedAt: number;
  synced: boolean;
  deleted: boolean;
}

export interface Supplier {
  id?: string;
  name: string;
  phone: string;
  address?: string;
  createdAt: number;
  updatedAt: number;
  synced: boolean;
  deleted: boolean;
}

export interface Transaction {
  id?: string;
  no: string;
  date: number;
  customerId?: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  amountPaid: number;
  change: number;
  note?: string;
  status: 'completed' | 'hold' | 'cancelled';
  userId?: string;
  createdAt: number;
  updatedAt: number;
  synced: boolean;
}

export interface TransactionItem {
  id?: string;
  transactionId: string;
  productId: string;
  productName: string;
  price: number;
  qty: number;
  discount: number;
  subtotal: number;
}

export class POSDatabase extends Dexie {
  products!: Table<Product>;
  categories!: Table<Category>;
  customers!: Table<Customer>;
  suppliers!: Table<Supplier>;
  transactions!: Table<Transaction>;
  transactionItems!: Table<TransactionItem>;
  users!: Table<AppUser>;

  constructor() {
    super('POSDatabase');
    this.version(1).stores({
      products: '++id, name, categoryId, barcode, synced, deleted',
      categories: '++id, name, synced, deleted',
      customers: '++id, name, phone, synced, deleted',
      suppliers: '++id, name, phone, synced, deleted',
      transactions: '++id, no, date, customerId, status, synced',
      transactionItems: '++id, transactionId, productId'
    });
    
    this.version(2).stores({
      users: '++id, email, role, synced, deleted'
    });
  }
}

export const db = new POSDatabase();
