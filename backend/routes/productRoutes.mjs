import { Router } from 'express'; 

import {
  getAllProducts,
  createProduct,
} from '../controllers/productController.mjs';

const productRouter = Router();

productRouter.post('/api/products', createProduct);
productRouter.get('/api/products', getAllProducts);

export default productRouter;
