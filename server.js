import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from environment
const app = express();

app.use(express.json());
app.use(express.static(__dirname)); // serve HTML files
app.get('/', (req, res) => res.redirect('/halalcheck.html'));
// ── Halal expert system prompt (cached — same for every request) ──────────────
const HALAL_SYSTEM_PROMPT = `Kamu adalah ahli syariah Islam dan ahli kimia pangan/kosmetik yang berspesialisasi dalam sertifikasi halal berdasarkan standar MUI (Majelis Ulama Indonesia).

Ketika diberikan nama produk atau daftar bahan, analisis dan kembalikan respons JSON dengan struktur PERSIS seperti ini:

{
  "verdict": "HALAL" atau "SYUBHAT" atau "HARAM",
  "confidence": "HIGH" atau "MEDIUM" atau "LOW",
  "productName": "nama produk yang sudah dibersihkan",
  "reason": "1-2 kalimat dalam Bahasa Indonesia menjelaskan verdik",
  "flaggedIngredients": [
    {"name": "nama bahan", "status": "HALAL" atau "SYUBHAT" atau "HARAM", "reason": "alasan singkat"}
  ],
  "safeIngredients": ["daftar bahan yang jelas halal"],
  "alternatives": ["1-2 alternatif halal jika HARAM atau SYUBHAT, kosongkan jika HALAL"]
}

Aturan penting:
- HARAM: Mengandung babi/lemak babi, alkohol/etanol (kecuali sangat kecil untuk tujuan non-konsumsi), darah, hewan buas, serangga (karmin E120/cochineal)
- SYUBHAT (meragukan): E471 mono & digliserida (sumber tidak jelas), gelatin tanpa keterangan, rennet tanpa keterangan, L-sistein E910, vanilla extract (mungkin mengandung alkohol), enzim dari sumber tidak jelas
- HALAL: Bahan nabati, bahan hewani dari hewan halal yang disembelih sesuai syariat, bahan sintetis tanpa sumber haram

Untuk produk lokal Indonesia (Indomie, Indofood, Garuda, dll) — umumnya sudah bersertifikasi MUI, sebutkan ini.
Untuk produk impor tanpa keterangan halal — lebih kritis dalam analisis.

PENTING: Kembalikan HANYA valid JSON, tidak ada teks lain sama sekali.`;

// ── POST /api/check ───────────────────────────────────────────────────────────
app.post('/api/check', async (req, res) => {
  const { product } = req.body;

  if (!product || !product.trim()) {
    return res.status(400).json({ error: 'Nama produk diperlukan' });
  }

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      // Cache the system prompt — it never changes, saves ~90% cost after first call
      system: [
        {
          type: 'text',
          text: HALAL_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' }
        }
      ],
      messages: [
        {
          role: 'user',
          content: `Analisis status halal produk ini: "${product.trim()}"\n\nKembalikan hanya valid JSON.`
        }
      ]
    });

    const rawText = response.content.find(b => b.type === 'text')?.text ?? '';

    // Extract JSON even if model adds extra whitespace/newlines
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const result = JSON.parse(jsonMatch[0]);

    // Log cache stats to console (helpful for cost monitoring)
    const usage = response.usage;
    console.log(`[${result.verdict}] "${product}" | cache_read: ${usage.cache_read_input_tokens ?? 0} | cache_write: ${usage.cache_creation_input_tokens ?? 0} | tokens: ${usage.input_tokens}`);

    res.json(result);
  } catch (err) {
    console.error('Error:', err.message);

    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(401).json({ error: 'API key tidak valid. Cek ANTHROPIC_API_KEY kamu.' });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'Terlalu banyak permintaan. Coba lagi sebentar.' });
    }

    res.status(500).json({ error: 'Analisis gagal. Silakan coba lagi.' });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`\n✅ HalalCheck AI server berjalan di http://localhost:${PORT}`);
  console.log(`📋 Buka http://localhost:${PORT}/halalcheck.html di browser kamu\n`);

  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️  ANTHROPIC_API_KEY tidak ditemukan! Set dulu sebelum cek produk.\n');
  }
});
