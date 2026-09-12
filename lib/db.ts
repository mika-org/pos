export interface AppUser {
  id?: string;
  name: string;
  email: string;
  password?: string;
  role: 'admin' | 'kasir';
  createdAt: number;
  updatedAt: number;
  synced?: boolean;
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
  synced?: boolean;
  deleted: boolean;
}

export interface Category {
  id?: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  synced?: boolean;
  deleted: boolean;
}

export interface Customer {
  id?: string;
  name: string;
  phone: string;
  address?: string;
  createdAt: number;
  updatedAt: number;
  synced?: boolean;
  deleted: boolean;
}

export interface Supplier {
  id?: string;
  name: string;
  phone: string;
  address?: string;
  createdAt: number;
  updatedAt: number;
  synced?: boolean;
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
  synced?: boolean;
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

export interface DiningTable {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  created_at: number;
  updated_at: number;
}

export interface CustomerOrder {
  id: string;
  customer_name: string;
  customer_email: string;
  total_amount: number;
  payment_method: 'qris' | 'bank_transfer' | 'cashier';
  payment_proof: string;
  status: 'pending_confirmation' | 'preparing' | 'delivery' | 'finished' | 'rejected';
  verified_by?: string | null;
  verified_at?: number | null;
  notes?: string | null;
  table_id?: string | null;
  created_at: number;
  updated_at: number;
}

export interface CustomerOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price: number;
  subtotal: number;
}

