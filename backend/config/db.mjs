import mongoose from 'mongoose';


import { MONGODB_URI } from './utils.mjs'; 


async function connectDatabase() {
  try {
    await mongoose.connect(MONGODB_URI); 
    console.log('Database connection successful!!!!');
  } catch (error) {
    console.log(`Database connection failed ${MONGODB_URI}`, error);
  }
}

export default connectDatabase;
