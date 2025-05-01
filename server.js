import dotenv from 'dotenv';
import express from 'express';
import manifestsRouter from './routes/manifests.js';

dotenv.config();
const app = express();

app.use(express.json({ limit: '10mb' }));
app.use('/manifests', manifestsRouter);

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('JSON parse error:', err.message);
    return res.status(400).json({ 
      error: `Invalid JSON format: ${err.message}`,
      details: "Please check your request body for syntax errors"
    });
  }
  next(err);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
