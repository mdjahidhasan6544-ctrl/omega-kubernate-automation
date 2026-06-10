import 'dotenv/config';


import 'dotenv/config'; 

import cors from 'cors'; 
import express from 'express';
import router from './routes/router.mjs'; 
import productRouter from './routes/productRoutes.mjs';
import connectDatabase from './config/db.mjs';
import { PORT } from './config/utils.mjs';

const port = PORT || 5000;

const app = express();
app.use(express.json());
app.use(
  cors()
);

connectDatabase();

app.use(router);
app.use(productRouter);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
