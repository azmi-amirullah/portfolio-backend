/**
 * frontend router
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/frontend/getProducts',
      handler: 'frontend.getProducts',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/frontend/addProduct',
      handler: 'frontend.addProduct',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/frontend/editProduct',
      handler: 'frontend.editProduct',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/frontend/deleteProduct',
      handler: 'frontend.deleteProduct',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/frontend/saveSale',
      handler: 'frontend.saveSale',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/frontend/getSales',
      handler: 'frontend.getSales',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
