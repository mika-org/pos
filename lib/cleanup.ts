import { db } from './db';

// Helper to determine if an ID is a UUID / string ID rather than an auto-incremented integer
const isUuidOrStringId = (id: any): boolean => {
  if (typeof id !== 'string') return false;
  // If it's a number string like "123", we don't treat it as a UUID
  return isNaN(Number(id));
};

export const cleanDuplicates = async () => {
  try {
    console.log('Running local database duplicate cleanup...');

    // 1. CLEAN CATEGORIES
    const categories = await db.categories.toArray();
    const catGroups: { [key: string]: typeof categories } = {};
    for (const cat of categories) {
      const key = cat.name.trim().toLowerCase();
      if (!catGroups[key]) catGroups[key] = [];
      catGroups[key].push(cat);
    }

    for (const key in catGroups) {
      const group = catGroups[key];
      if (group.length > 1) {
        console.log(`Found duplicate categories for name "${group[0].name}":`, group);
        // Select primary category: prefer UUID/string ID, then synced: true, then the oldest
        group.sort((a, b) => {
          const aIsStr = isUuidOrStringId(a.id);
          const bIsStr = isUuidOrStringId(b.id);
          if (aIsStr && !bIsStr) return -1;
          if (!aIsStr && bIsStr) return 1;

          if (a.synced && !b.synced) return -1;
          if (!a.synced && b.synced) return 1;

          return a.createdAt - b.createdAt;
        });

        const primaryCat = group[0];
        const duplicates = group.slice(1);

        for (const dup of duplicates) {
          const dupId = dup.id as string | number | undefined;
          if (!dupId) continue;
          
          // Re-map products using this duplicate category's ID to primary category's ID
          const allProducts = await db.products.toArray();
          const productsToUpdate = allProducts.filter(prod => 
            String(prod.categoryId) === String(dupId)
          );

          for (const prod of productsToUpdate) {
            if (prod.id) {
              await db.products.update(prod.id, {
                categoryId: primaryCat.id!.toString(),
                updatedAt: Date.now(),
                synced: false // Force sync updated categoryId back to server
              });
            }
          }

          // Delete the duplicate category
          await db.categories.delete(dup.id);
          console.log(`Deleted duplicate category "${dup.name}" (ID: ${dup.id}), merged to ID: ${primaryCat.id}`);
        }
      }
    }

    // 2. CLEAN PRODUCTS
    const products = await db.products.toArray();
    const prodGroups: { [key: string]: typeof products } = {};
    for (const prod of products) {
      const key = prod.barcode && prod.barcode.trim() !== '' 
        ? `barcode:${prod.barcode.trim()}`
        : `name:${prod.name.trim().toLowerCase()}`;
      if (!prodGroups[key]) prodGroups[key] = [];
      prodGroups[key].push(prod);
    }

    for (const key in prodGroups) {
      const group = prodGroups[key];
      if (group.length > 1) {
        console.log(`Found duplicate products for "${group[0].name}":`, group);
        group.sort((a, b) => {
          const aIsStr = isUuidOrStringId(a.id);
          const bIsStr = isUuidOrStringId(b.id);
          if (aIsStr && !bIsStr) return -1;
          if (!aIsStr && bIsStr) return 1;

          if (a.synced && !b.synced) return -1;
          if (!a.synced && b.synced) return 1;

          return a.createdAt - b.createdAt;
        });

        const primaryProd = group[0];
        const duplicates = group.slice(1);

        for (const dup of duplicates) {
          if (dup.id) {
            await db.products.delete(dup.id);
            console.log(`Deleted duplicate product "${dup.name}" (ID: ${dup.id}), kept ID: ${primaryProd.id}`);
          }
        }
      }
    }

    // 3. CLEAN CUSTOMERS
    const customers = await db.customers.toArray();
    const custGroups: { [key: string]: typeof customers } = {};
    for (const cust of customers) {
      const key = cust.phone && cust.phone.trim() !== ''
        ? `phone:${cust.phone.trim()}`
        : `name:${cust.name.trim().toLowerCase()}`;
      if (!custGroups[key]) custGroups[key] = [];
      custGroups[key].push(cust);
    }

    for (const key in custGroups) {
      const group = custGroups[key];
      if (group.length > 1) {
        console.log(`Found duplicate customers for "${group[0].name}":`, group);
        group.sort((a, b) => {
          const aIsStr = isUuidOrStringId(a.id);
          const bIsStr = isUuidOrStringId(b.id);
          if (aIsStr && !bIsStr) return -1;
          if (!aIsStr && bIsStr) return 1;

          if (a.synced && !b.synced) return -1;
          if (!a.synced && b.synced) return 1;

          return a.createdAt - b.createdAt;
        });

        const primaryCust = group[0];
        const duplicates = group.slice(1);

        for (const dup of duplicates) {
          if (dup.id) {
            await db.customers.delete(dup.id);
            console.log(`Deleted duplicate customer "${dup.name}" (ID: ${dup.id}), kept ID: ${primaryCust.id}`);
          }
        }
      }
    }

    // 4. CLEAN SUPPLIERS
    const suppliers = await db.suppliers.toArray();
    const supGroups: { [key: string]: typeof suppliers } = {};
    for (const sup of suppliers) {
      const key = sup.phone && sup.phone.trim() !== ''
        ? `phone:${sup.phone.trim()}`
        : `name:${sup.name.trim().toLowerCase()}`;
      if (!supGroups[key]) supGroups[key] = [];
      supGroups[key].push(sup);
    }

    for (const key in supGroups) {
      const group = supGroups[key];
      if (group.length > 1) {
        console.log(`Found duplicate suppliers for "${group[0].name}":`, group);
        group.sort((a, b) => {
          const aIsStr = isUuidOrStringId(a.id);
          const bIsStr = isUuidOrStringId(b.id);
          if (aIsStr && !bIsStr) return -1;
          if (!aIsStr && bIsStr) return 1;

          if (a.synced && !b.synced) return -1;
          if (!a.synced && b.synced) return 1;

          return a.createdAt - b.createdAt;
        });

        const primarySup = group[0];
        const duplicates = group.slice(1);

        for (const dup of duplicates) {
          if (dup.id) {
            await db.suppliers.delete(dup.id);
            console.log(`Deleted duplicate supplier "${dup.name}" (ID: ${dup.id}), kept ID: ${primarySup.id}`);
          }
        }
      }
    }

    // 5. CLEAN TRANSACTIONS & ITEMS
    const transactions = await db.transactions.toArray();
    const txGroups: { [key: string]: typeof transactions } = {};
    for (const tx of transactions) {
      const key = tx.no.trim();
      if (!txGroups[key]) txGroups[key] = [];
      txGroups[key].push(tx);
    }

    for (const key in txGroups) {
      const group = txGroups[key];
      if (group.length > 1) {
        console.log(`Found duplicate transactions for number "${key}":`, group);
        group.sort((a, b) => {
          const aIsStr = isUuidOrStringId(a.id);
          const bIsStr = isUuidOrStringId(b.id);
          if (aIsStr && !bIsStr) return -1;
          if (!aIsStr && bIsStr) return 1;

          if (a.synced && !b.synced) return -1;
          if (!a.synced && b.synced) return 1;

          return a.createdAt - b.createdAt;
        });

        const primaryTx = group[0];
        const duplicates = group.slice(1);

        for (const dup of duplicates) {
          const dupId = dup.id as string | number | undefined;
          if (!dupId) continue;

          // Delete duplicate transaction items locally
          const allTxItems = await db.transactionItems.toArray();
          const itemsToDelete = allTxItems.filter(item => 
            String(item.transactionId) === String(dupId)
          );

          for (const item of itemsToDelete) {
            if (item.id) {
              await db.transactionItems.delete(item.id);
            }
          }

          // Delete duplicate transaction
          await db.transactions.delete(dup.id);
          console.log(`Deleted duplicate transaction "${dup.no}" (ID: ${dup.id}), kept ID: ${primaryTx.id}`);
        }
      }
    }

    console.log('Local database duplicate cleanup completed successfully!');
  } catch (error) {
    console.error('Error occurred during duplicate cleanup:', error);
  }
};
