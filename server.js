import dotenv from 'dotenv';
import express from 'express';
import manifestsRouter from './routes/manifests.js';

dotenv.config();
const app = express();

app.use(express.json({ limit: '10mb' }));
app.use('/manifests', manifestsRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
