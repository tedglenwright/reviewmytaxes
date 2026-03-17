import express from 'express';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.static(__dirname));

app.use((req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(readFileSync(`${__dirname}/index.html`, 'utf-8'));
});

const PORT = process.env.PORT || 5004;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`ReviewMyTaxes running on http://0.0.0.0:${PORT}`);
});
