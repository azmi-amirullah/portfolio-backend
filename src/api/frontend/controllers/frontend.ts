/**
 * frontend controller
 */

import type { Context } from 'koa';

export default {
  async getProducts(ctx: Context) {
    try {
      const userDocumentId = ctx.state.user?.documentId;

      if (!userDocumentId) {
        return ctx.unauthorized(
          'You must be authenticated to access this endpoint'
        );
      }

      const user = await strapi
        .documents('plugin::users-permissions.user')
        .findOne({
          documentId: userDocumentId,
          populate: ['organisation'],
        });

      if (!user?.organisation) {
        return ctx.badRequest('User does not have an associated organisation');
      }

      const organisationName = user.organisation.name;
      const productsEntryName = `${organisationName}_products`;

      const cashierEntries = await strapi
        .documents('api::cashier.cashier')
        .findMany({
          filters: {
            name: productsEntryName,
          },
        });

      let productsData = {};

      if (cashierEntries.length === 0) {
        const newEntry = await strapi.documents('api::cashier.cashier').create({
          data: {
            name: productsEntryName,
            data: {},
            organisation: user.organisation.documentId,
          },
        });
        productsData = (newEntry.data as Record<string, any>) || {};
      } else {
        productsData = (cashierEntries[0]?.data as Record<string, any>) || {};
      }

      const productsArray = Object.entries(productsData).map(
        ([productName, productInfo]: [string, any]) => {
          const productStock = productInfo.stock || [];

          const totalStock = Array.isArray(productStock)
            ? productStock.reduce(
                (sum, batch) => sum + (batch.quantity || 0),
                0
              )
            : 0;

          const sold = productInfo.sold || 0;
          const availableStock = totalStock - sold;

          return {
            id: productName,
            name: productName,
            barcode: productInfo.barcode || '',
            price: productInfo.price || 0,
            buyPrice: productInfo.buyPrice || 0,
            sold: sold,
            stock: productStock,
            availableStock: availableStock,
          };
        }
      );
      console.log(productsArray);
      return {
        products: productsArray,
      };
    } catch (error) {
      console.log(error);
      ctx.throw(500, error);
    }
  },

  async addProduct(ctx: Context) {
    try {
      const userDocumentId = ctx.state.user?.documentId;
      if (!userDocumentId) return ctx.unauthorized();

      const { product } = ctx.request.body;
      if (!product || !product.name)
        return ctx.badRequest('Product name is required');
      if (
        product.price === undefined ||
        product.price === null ||
        product.price === ''
      )
        return ctx.badRequest('Sell price is required');

      const user = await strapi
        .documents('plugin::users-permissions.user')
        .findOne({
          documentId: userDocumentId,
          populate: ['organisation'],
        });

      if (!user?.organisation) return ctx.badRequest('No organisation found');

      const productsEntryName = `${user.organisation.name}_products`;
      const cashierEntries = await strapi
        .documents('api::cashier.cashier')
        .findMany({
          filters: { name: productsEntryName },
        });

      let entryId;
      let productsData = {};

      if (cashierEntries.length === 0) {
        const newEntry = await strapi.documents('api::cashier.cashier').create({
          data: {
            name: productsEntryName,
            data: {},
            organisation: user.organisation.documentId,
          },
        });
        entryId = newEntry.documentId;
        productsData = {};
      } else {
        entryId = cashierEntries[0].documentId;
        productsData = (cashierEntries[0].data as Record<string, any>) || {};
      }

      if (productsData[product.name]) {
        return ctx.badRequest('Product with this name already exists');
      }

      // Remove id and name from storage, use key as ID/Name
      const { id, name, ...productDataStored } = product;

      productsData[product.name] = {
        ...productDataStored,
        sold: 0,
        stock: product.stock || [],
      };

      await strapi.documents('api::cashier.cashier').update({
        documentId: entryId,
        data: {
          data: productsData,
        },
      });

      return {
        product: {
          ...productsData[product.name],
          id: product.name,
          name: product.name,
        },
      };
    } catch (error) {
      console.log(error);
      ctx.throw(500, error);
    }
  },

  async editProduct(ctx: Context) {
    try {
      const userDocumentId = ctx.state.user?.documentId;
      if (!userDocumentId) return ctx.unauthorized();

      const { oldName, product } = ctx.request.body;
      if (!oldName || !product || !product.name)
        return ctx.badRequest('Invalid data');
      if (
        product.price === undefined ||
        product.price === null ||
        product.price === ''
      )
        return ctx.badRequest('Sell price is required');

      const user = await strapi
        .documents('plugin::users-permissions.user')
        .findOne({
          documentId: userDocumentId,
          populate: ['organisation'],
        });

      if (!user?.organisation) return ctx.badRequest('No organisation found');

      const productsEntryName = `${user.organisation.name}_products`;
      const cashierEntries = await strapi
        .documents('api::cashier.cashier')
        .findMany({
          filters: { name: productsEntryName },
        });

      if (cashierEntries.length === 0)
        return ctx.notFound('Products entry not found');

      const entryId = cashierEntries[0].documentId;
      const productsData =
        (cashierEntries[0].data as Record<string, any>) || {};

      if (!productsData[oldName]) return ctx.notFound('Product not found');

      // If name changed, check for conflict
      if (oldName !== product.name && productsData[product.name]) {
        return ctx.badRequest('Product with new name already exists');
      }

      // Guard: Preserve sold count from backend, ignoring any value sent from client
      // This ensures the 'sold' count is read-only and managed solely by the backend/sales logic
      const soldCount = productsData[oldName].sold || 0;

      // Remove old entry if name changed
      if (oldName !== product.name) {
        delete productsData[oldName];
      }

      // Remove id and name from storage, use key as ID/Name
      const { id, name, ...productDataStored } = product;

      productsData[product.name] = {
        ...productDataStored,
        sold: soldCount, // Explicitly overwrite with preserved value
      };

      await strapi.documents('api::cashier.cashier').update({
        documentId: entryId,
        data: {
          data: productsData,
        },
      });

      return { product: productsData[product.name] };
    } catch (error) {
      console.log(error);
      ctx.throw(500, error);
    }
  },

  async deleteProduct(ctx: Context) {
    try {
      const userDocumentId = ctx.state.user?.documentId;
      if (!userDocumentId) return ctx.unauthorized();

      const { productName } = ctx.request.body;
      if (!productName) return ctx.badRequest('Product name is required');

      const user = await strapi
        .documents('plugin::users-permissions.user')
        .findOne({
          documentId: userDocumentId,
          populate: ['organisation'],
        });

      if (!user?.organisation) return ctx.badRequest('No organisation found');

      const productsEntryName = `${user.organisation.name}_products`;
      const cashierEntries = await strapi
        .documents('api::cashier.cashier')
        .findMany({
          filters: { name: productsEntryName },
        });

      if (cashierEntries.length === 0)
        return ctx.notFound('Products entry not found');

      const entryId = cashierEntries[0].documentId;
      const productsData =
        (cashierEntries[0].data as Record<string, any>) || {};

      if (!productsData[productName]) return ctx.notFound('Product not found');

      delete productsData[productName];

      await strapi.documents('api::cashier.cashier').update({
        documentId: entryId,
        data: {
          data: productsData,
        },
      });

      return { message: 'Product deleted successfully' };
    } catch (error) {
      console.log(error);
      ctx.throw(500, error);
    }
  },

  async saveSale(ctx: Context) {
    try {
      const userDocumentId = ctx.state.user?.documentId;
      if (!userDocumentId) return ctx.unauthorized();

      const { transaction } = ctx.request.body;
      if (!transaction || !transaction.timestamp || !transaction.products)
        return ctx.badRequest('Invalid transaction data');

      const user = await strapi
        .documents('plugin::users-permissions.user')
        .findOne({
          documentId: userDocumentId,
          populate: ['organisation'],
        });

      if (!user?.organisation) return ctx.badRequest('No organisation found');

      const salesEntryName = `${user.organisation.name}_sales`;
      const cashierEntries = await strapi
        .documents('api::cashier.cashier')
        .findMany({
          filters: { name: salesEntryName },
        });

      let entryId;
      let salesData = {};

      if (cashierEntries.length === 0) {
        const newEntry = await strapi.documents('api::cashier.cashier').create({
          data: {
            name: salesEntryName,
            data: {},
            organisation: user.organisation.documentId,
          },
        });
        entryId = newEntry.documentId;
        salesData = {};
      } else {
        entryId = cashierEntries[0].documentId;
        salesData = (cashierEntries[0].data as Record<string, any>) || {};
      }

      // Add new transaction at the top
      // Key is simply the timestamp as string, as requested
      const transactionKey = transaction.timestamp.toString();

      // Remove ID and timestamp from transaction before saving, use timestamp as key
      const { id, timestamp, ...transactionData } = transaction;

      const newSalesData = {
        [transactionKey]: transactionData,
        ...salesData,
      };

      await strapi.documents('api::cashier.cashier').update({
        documentId: entryId,
        data: {
          data: newSalesData,
        },
      });

      // Update product sold counts
      const productsEntryName = `${user.organisation.name}_products`;
      const productEntries = await strapi
        .documents('api::cashier.cashier')
        .findMany({
          filters: { name: productsEntryName },
        });

      if (productEntries.length > 0) {
        const productEntryId = productEntries[0].documentId;
        const productsData =
          (productEntries[0].data as Record<string, any>) || {};

        let hasUpdates = false;

        // Iterate through products in the transaction
        transaction.products.forEach((item: any) => {
          if (item.productId && item.quantity) {
            // Find product by ID (which is the key in productsData)
            // Note: In our system, product.id IS the key (product name)
            // But let's be safe and look it up if needed, or assume direct access if id matches key

            // The productId in frontend is the product name (key)
            const productKey = item.productId;

            if (productsData[productKey]) {
              const currentSold = productsData[productKey].sold || 0;
              productsData[productKey] = {
                ...productsData[productKey],
                sold: currentSold + item.quantity,
              };
              hasUpdates = true;
            }
          }
        });

        if (hasUpdates) {
          await strapi.documents('api::cashier.cashier').update({
            documentId: productEntryId,
            data: {
              data: productsData,
            },
          });
        }
      }

      return { message: 'Transaction saved successfully' };
    } catch (error) {
      console.log(error);
      ctx.throw(500, error);
    }
  },

  async getSales(ctx: Context) {
    try {
      const userDocumentId = ctx.state.user?.documentId;
      if (!userDocumentId) return ctx.unauthorized();

      const user = await strapi
        .documents('plugin::users-permissions.user')
        .findOne({
          documentId: userDocumentId,
          populate: ['organisation'],
        });

      if (!user?.organisation) return ctx.badRequest('No organisation found');

      const salesEntryName = `${user.organisation.name}_sales`;
      const cashierEntries = await strapi
        .documents('api::cashier.cashier')
        .findMany({
          filters: { name: salesEntryName },
        });

      let salesData = {};

      if (cashierEntries.length > 0) {
        salesData = (cashierEntries[0].data as Record<string, any>) || {};
      }

      // Convert object to array of transactions and re-inject ID and timestamp
      const salesArray = Object.entries(salesData).map(
        ([key, value]: [string, any]) => ({
          ...value,
          id: key,
          timestamp: parseInt(key),
        })
      );

      return { sales: salesArray };
    } catch (error) {
      console.log(error);
      ctx.throw(500, error);
    }
  },
};
