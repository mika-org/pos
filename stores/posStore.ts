import { create } from 'zustand';
import { Product } from '@/lib/db';

export interface CartItem {
  product: Product;
  qty: number;
  discount: number;
  subtotal: number;
}

interface POSState {
  cart: CartItem[];
  customerId: string | null;
  globalDiscount: number;
  note: string;
  
  // Actions
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQty: (productId: string, qty: number) => void;
  updateItemDiscount: (productId: string, discount: number) => void;
  setCustomer: (id: string | null) => void;
  setGlobalDiscount: (discount: number) => void;
  setNote: (note: string) => void;
  clearCart: () => void;
  
  // Getters
  getSubtotal: () => number;
  getTotal: () => number;
}

export const usePOSStore = create<POSState>((set, get) => ({
  cart: [],
  customerId: null,
  globalDiscount: 0,
  note: '',

  addToCart: (product) => set((state) => {
    const existing = state.cart.find(item => item.product.id === product.id);
    if (existing) {
      if (existing.qty >= product.stock) return state; // Don't exceed stock
      
      const newQty = existing.qty + 1;
      const newSubtotal = (product.sellPrice * newQty) - existing.discount;
      
      return {
        cart: state.cart.map(item => 
          item.product.id === product.id 
            ? { ...item, qty: newQty, subtotal: newSubtotal }
            : item
        )
      };
    }

    return {
      cart: [...state.cart, { 
        product, 
        qty: 1, 
        discount: 0, 
        subtotal: product.sellPrice 
      }]
    };
  }),

  removeFromCart: (productId) => set((state) => ({
    cart: state.cart.filter(item => item.product.id !== productId)
  })),

  updateQty: (productId, qty) => set((state) => {
    if (qty <= 0) {
      return { cart: state.cart.filter(item => item.product.id !== productId) };
    }

    return {
      cart: state.cart.map(item => {
        if (item.product.id === productId) {
          if (qty > item.product.stock) qty = item.product.stock; // Limit to stock
          return {
            ...item,
            qty,
            subtotal: (item.product.sellPrice * qty) - item.discount
          };
        }
        return item;
      })
    };
  }),

  updateItemDiscount: (productId, discount) => set((state) => ({
    cart: state.cart.map(item => {
      if (item.product.id === productId) {
        return {
          ...item,
          discount,
          subtotal: (item.product.sellPrice * item.qty) - discount
        };
      }
      return item;
    })
  })),

  setCustomer: (id) => set({ customerId: id }),
  setGlobalDiscount: (discount) => set({ globalDiscount: discount }),
  setNote: (note) => set({ note }),
  clearCart: () => set({ cart: [], customerId: null, globalDiscount: 0, note: '' }),

  getSubtotal: () => {
    const state = get();
    return state.cart.reduce((sum, item) => sum + item.subtotal, 0);
  },

  getTotal: () => {
    const state = get();
    return state.getSubtotal() - state.globalDiscount;
  }
}));
