const express = require('express');
const router = express.Router();
const axios = require('axios');
const db = require('../db');
const fs = require('fs');
const path = require('path');

const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const conversationContexts = new Map();

function getConversationContext(sessionId) {
    if (!conversationContexts.has(sessionId)) {
        conversationContexts.set(sessionId, {
            lastItems: null,
            lastIntent: null,
            lastQuery: null,
            timestamp: Date.now()
        });
    }
    return conversationContexts.get(sessionId);
}

function updateConversationContext(sessionId, data) {
    const context = getConversationContext(sessionId);
    Object.assign(context, data, { timestamp: Date.now() });
    conversationContexts.set(sessionId, context);
}

function clearOldContexts() {
    const now = Date.now();
    const timeout = 30 * 60 * 1000; //30 mnt
    for (const [key, value] of conversationContexts.entries()) {
        if (now - value.timestamp > timeout) {
            conversationContexts.delete(key);
        }
    }
}

setInterval(clearOldContexts, 10 * 60 * 1000); //10 menit

function getDatabaseSchema() {
    try {
        const sqlPath = path.join(__dirname, '../db/dbinventas.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
        
        return `
DATABASE SCHEMA (dari file SQL):
${sqlContent}

INSTRUKSI:
- Pelajari struktur tabel, kolom, dan relasi dari SQL di atas
- Generate SQL query yang sesuai berdasarkan pemahaman struktur
- Gunakan JOIN yang tepat sesuai foreign key relationship
- Pahami tipe data dan constraint untuk validasi
`;
    } catch (error) {
        console.error('Error reading SQL file:', error);

        return `
DATABASE TABLES:
- barang: id_barang, nama_barang, gambar_barang, deskripsi_barang, kategori, lokasi_barang, harga_barang, status_barang, kondisi_barang, waktu_masuk
- karyawan: id_karyawan, nama_karyawan, jabatan, jenis_kelamin
- kepemilikan: id_kepemilikan, id_barang, id_karyawan, tanggal_perolehan, status_kepemilikan
- lelang: id_barang, harga_lelang, status_lelang, waktu_mulai, waktu_selesai, status_konfirmasi_atasan, id_atasan, waktu_konfirmasi_atasan
`;
    }
}

function sanitizeSQL(sqlQuery) {
    sqlQuery = sqlQuery.replace(/```sql\n?/g, '').replace(/```\n?/g, '').trim();

    const upperQuery = sqlQuery.toUpperCase().trim();
    if (!upperQuery.startsWith('SELECT')) {
        throw new Error('Only SELECT queries are allowed');
    }
    const dangerousKeywords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE'];
    for (const keyword of dangerousKeywords) {
        if (upperQuery.includes(keyword)) {
            throw new Error(`Dangerous keyword detected: ${keyword}`);
        }
    }

    return sqlQuery;
}

async function chatWithGemini(userMessage, conversationHistory = [], context = null) {
    try {
        const dbSchema = getDatabaseSchema();
        
        let contextInfo = '';
        if (context && context.lastItems) {
            contextInfo = `
KONTEKS PERCAKAPAN SEBELUMNYA:
- Barang terakhir dibahas: ${context.lastItems.namaBarang || 'tidak ada'}
- Intent sebelumnya: ${context.lastIntent || 'tidak ada'}
- Jumlah item: ${context.lastItems.count || 0}
- ID barang: ${context.lastItems.ids ? context.lastItems.ids.join(', ') : 'tidak ada'}

PENTING: Jika user bertanya follow-up (seperti "siapa pemiliknya?", "lokasinya dimana?", "harganya berapa?") tanpa menyebut nama barang, gunakan konteks barang terakhir di atas!
`;
        }

        const systemPrompt = `Kamu adalah Helena, asisten chatbot untuk sistem ini yang bernama Inventas. Inventas adalah sistem yang membantu manajemen inventaris barang.

KEPRIBADIAN HELENA:
- Ramah, helpful, dan sedikit ceria (boleh pakai emoji secukupnya 😊)
- Bicara natural dan tidak kaku, tapi tetap profesional
- Paham konteks percakapan sebelumnya
- Jika user bertanya hal di luar inventaris tapi masih wajar (cuaca, kabar, dll), jawab singkat dengan ramah lalu arahkan kembali ke inventaris
- Jangan terlalu strict menolak pertanyaan, jadilah natural
- Sesuaikan dengan bahasa yang diinputkan pengguna
- Jika telah kebanyakan/lebih dari 8192 token dalam konteks, prioritaskan pesan terakhir dan konteks penting, dan beritahu untuk menunggu 1 menit sebelum melakukan pencarian ulang

${dbSchema}

${contextInfo}

TUGAS:
Analisa pertanyaan user dan berikan response dalam format JSON MURNI (tidak ada markdown/backticks).

FORMAT WAJIB:
{
  "intent": "kategori_pertanyaan",
  "needsQuery": true/false,
  "sqlQuery": "SQL query atau null",
  "response": "pesan natural untuk user",
  "displayType": "text|card",
  "isFollowUp": true/false
}

DETEKSI FOLLOW-UP:
- Jika user bertanya tanpa menyebut nama barang ("siapa pemiliknya?", "lokasinya dimana?", "berapa harganya?") DAN ada konteks sebelumnya, set isFollowUp: true dan gunakan info dari konteks
- Generate SQL dengan WHERE id_barang IN (${context?.lastItems?.ids?.join(',') || ''}) untuk follow-up query

INTENT:
- "harga_barang", "lokasi_barang", "jumlah_barang", "status_barang", "kepemilikan_barang", "lelang_barang", "agregasi"
- "sapaan" - halo, hai, selamat pagi/siang/malam
- "kabar" - apa kabar, gimana kabarmu
- "ucapan_terima_kasih" - terima kasih, thanks, makasih
- "off_topic" - pertanyaan di luar inventaris (tapi jawab tetap ramah)
- "bantuan" - minta panduan
- "casual_chat" - ngobrol santai tapi masih relate ke kerja

ATURAN SQL:
- HANYA SELECT, tidak boleh INSERT/UPDATE/DELETE/DROP
- Gunakan pemahaman dari struktur database untuk generate query yang tepat
- Untuk follow-up, gunakan id_barang dari konteks
- Include kolom yang relevan (nama_barang, harga_barang, lokasi_barang, status_barang, kondisi_barang, gambar_barang)
- Untuk kepemilikan JOIN dengan karyawan

STYLE RESPONSE (natural & friendly):
- Sapaan: "Hai! Saya Helena 😊 Siap bantu kamu dengan info barang kantor. Mau cari apa?"
- Harga: "Oke, ini dia info harga [barang]!"
- Tidak ketemu: "Hmm, sepertinya [barang] tidak ada di database nih 🤔 Coba cek ejaan atau cari barang lain?"
- Follow-up: "Oh itu tadi ya! Oke saya carikan info pemiliknya..."
- Off-topic ringan: "Hehe, saya fokus ke inventaris barang sih 😅 Tapi kalo soal [topik], mending tanya yang ahli ya! Anyway, ada yang mau dicek tentang barang kantor?"
- Kabar: "Alhamdulillah baik! Makasih udah tanya 😊 Gimana, ada yang bisa saya bantu hari ini?"

CONTOH:

User: "tampilkan kursi"
{
  "intent": "harga_barang",
  "needsQuery": true,
  "sqlQuery": "SELECT id_barang, nama_barang, harga_barang, lokasi_barang, status_barang, kondisi_barang, gambar_barang FROM barang WHERE LOWER(nama_barang) LIKE LOWER('%kursi%')",
  "response": "Oke, ini dia daftar kursi yang ada!",
  "displayType": "card",
  "isFollowUp": false
}

User: "siapa pemiliknya?" (setelah query kursi sebelumnya)
{
  "intent": "kepemilikan_barang",
  "needsQuery": true,
  "sqlQuery": "SELECT b.id_barang, b.nama_barang, k.nama_karyawan, k.jabatan, b.harga_barang, b.lokasi_barang, b.status_barang, b.kondisi_barang, b.gambar_barang FROM kepemilikan kp JOIN barang b ON kp.id_barang = b.id_barang JOIN karyawan k ON kp.id_karyawan = k.id_karyawan WHERE b.id_barang IN ([IDs dari konteks]) AND kp.status_kepemilikan = 'aktif'",
  "response": "Oh kursi yang tadi ya! Oke, ini dia info pemiliknya:",
  "displayType": "card",
  "isFollowUp": true
}

User: "apa kabar helena?"
{
  "intent": "kabar",
  "needsQuery": false,
  "sqlQuery": null,
  "response": "Alhamdulillah baik! Makasih udah tanya 😊 Saya siap bantu kamu hari ini. Ada yang mau dicek?",
  "displayType": "text",
  "isFollowUp": false
}

User: "cuaca hari ini gimana?"
{
  "intent": "off_topic",
  "needsQuery": false,
  "sqlQuery": null,
  "response": "Wah, saya kurang update soal cuaca nih 😅 Mending cek aplikasi cuaca ya! Btw, ada barang kantor yang mau dicek?",
  "displayType": "text",
  "isFollowUp": false
}

CRITICAL: Response HARUS pure JSON, natural & friendly!`;

        const chat = model.startChat({
            history: conversationHistory,
            generationConfig: {
                maxOutputTokens: 8192,
                temperature: 0.8,
            },
        });

        const result = await chat.sendMessage(systemPrompt + "\n\nUser: " + userMessage);
        const responseText = result.response.text();

        let jsonResponse;
        try {
            let cleanResponse = responseText
                .replace(/```json\n?/gi, '')
                .replace(/```\n?/g, '')
                .trim();
            const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                cleanResponse = jsonMatch[0];
            }

            jsonResponse = JSON.parse(cleanResponse);
            if (!jsonResponse.intent || !jsonResponse.response || jsonResponse.needsQuery === undefined) {
                throw new Error('Invalid response structure');
            }
            if (!jsonResponse.displayType) {
                jsonResponse.displayType = 'text';
            }
            if (jsonResponse.isFollowUp === undefined) {
                jsonResponse.isFollowUp = false;
            }

        } catch (parseError) {
            console.error('Error parsing Gemini response:', parseError);
            console.error('Raw response:', responseText);

            jsonResponse = {
                intent: 'fallback',
                needsQuery: false,
                sqlQuery: null,
                response: 'Waduh, saya agak bingung nih 😅 Coba tanya lagi dengan lebih spesifik ya! Misalnya: "Berapa harga laptop?" atau "Siapa pemilik kursi?"',
                displayType: 'text',
                isFollowUp: false
            };
        }

        return jsonResponse;
    } catch (error) {
        console.error('Gemini API Error:', error);
        throw error;
    }
}

async function executeAndFormatQuery(sqlQuery, intent) {
    try {
        const cleanQuery = sanitizeSQL(sqlQuery);
        console.log('Executing SQL:', cleanQuery);

        const [rows] = await db.query(cleanQuery);

        if (rows.length === 0) {
            return {
                success: false,
                message: 'Tidak ditemukan data yang sesuai.'
            };
        }

        let formattedData = null;

        const cardIntents = ['harga_barang', 'lokasi_barang', 'status_barang',
            'jumlah_barang', 'kepemilikan_barang', 'lelang_barang'];

        if (cardIntents.includes(intent)) {
            formattedData = formatCardData(rows, intent);
        }

        return {
            success: true,
            data: formattedData,
            rows: rows,
            count: rows.length
        };
    } catch (error) {
        console.error('SQL Execution Error:', error);
        return {
            success: false,
            message: 'Terjadi kesalahan saat mengambil data.',
            error: error.message
        };
    }
}

function formatImageData(gambar_barang) {
    if (gambar_barang) {
        return gambar_barang;
    } else {
        return '/img/no-image.svg';
    }
}

function formatCardData(rows, intent) {
    if (!rows || rows.length === 0) {
        return null;
    }

    let groupByField = 'nama_barang';
    if (intent === 'kepemilikan_barang' && rows[0].nama_karyawan) {
        groupByField = 'pemilik';
    } else if (intent === 'lokasi_barang') {
        groupByField = 'lokasi_barang';
    } else if (intent === 'status_barang') {
        groupByField = 'status_barang';
    }

    const grouped = {};

    rows.forEach(row => {
        let groupKey;

        if (groupByField === 'pemilik' && row.nama_karyawan) {
            groupKey = `${row.nama_karyawan} (${row.jabatan || 'Staff'})`;
        } else if (groupByField === 'lokasi_barang') {
            groupKey = row.lokasi_barang || 'Lokasi Tidak Diketahui';
        } else if (groupByField === 'status_barang') {
            groupKey = row.status_barang || 'Tidak Ada Status';
        } else {
            groupKey = row.nama_barang || 'Barang Tidak Diketahui';
        }

        if (!grouped[groupKey]) {
            grouped[groupKey] = [];
        }

        grouped[groupKey].push({
            id_barang: row.id_barang,
            nama_barang: row.nama_barang,
            gambar: formatImageData(row.gambar_barang),
            harga_barang: row.harga_barang,
            lokasi_barang: row.lokasi_barang,
            status_barang: row.status_barang,
            kondisi_barang: row.kondisi_barang,
            pemilik: row.nama_karyawan || null,
            jabatan: row.jabatan || null
        });
    });

    return {
        type: intent,
        grouped: true,
        groupBy: groupByField,
        groups: Object.keys(grouped).map(key => ({
            groupName: key,
            items: grouped[key]
        }))
    };
}

const responses = {
    helpResponse: `🤖 Hai! Saya Helena, asisten inventaris PT Sumber Rejeki Abadi

Saya bisa bantu kamu dengan:

💰 Harga Barang - "Berapa harga laptop?" 
📍 Lokasi Barang - "Printer ada di mana?"
👤 Kepemilikan - "Siapa pemilik kursi rapat?"
📊 Status & Kondisi - "Gimana kondisi AC ruang meeting?"
🔢 Jumlah Barang - "Ada berapa unit komputer?"
🏷️ Lelang - "Barang apa yang dilelang?"

Tips: Tinggal tanya aja natural, saya paham kok! 😊`,
    
    greetingResponse: "Hai! Saya Helena 👋 Siap bantu kamu dengan info barang kantor. Mau cari apa hari ini?",
    thanksResponse: "Sama-sama! Senang bisa bantu 😊 Ada lagi yang mau ditanyakan?",
    fallbackGeneral: "Hmm, saya kurang paham nih 🤔 Coba tanya tentang harga, lokasi, atau pemilik barang yuk!",
    noDataFound: "Waduh, kayaknya tidak ada data yang cocok deh 😅 Coba cek lagi atau tanya yang lain ya!",
    
    fallbackSpecific: {
        harga_barang: "Untuk cek harga, sebutkan nama barangnya ya! Contoh: 'Berapa harga laptop?'",
        jumlah_barang: "Untuk cek jumlah, sebutkan nama barangnya ya! Contoh: 'Ada berapa unit printer?'",
        lokasi_barang: "Untuk cek lokasi, sebutkan nama barangnya ya! Contoh: 'Di mana lokasi lemari?'",
        status_barang: "Untuk cek status, sebutkan nama barangnya ya! Contoh: 'Gimana status laptop?'",
        kepemilikan_barang: "Untuk cek pemilik, sebutkan nama barangnya ya! Contoh: 'Siapa pemilik laptop?'"
    },
    owned_by: "dimiliki oleh",
    position: "jabatan",
    price: "harga",
    currency: "Rp",
    quantity: "jumlah",
    units: "unit",
    location: "lokasi",
    status: "status",
    available_for_auction: "Barang yang tersedia untuk lelang",
    no_auction_items: "Saat ini tidak ada barang yang sedang dilelang.",
    items_found: "Berikut barang yang ditemukan",
    below: "di bawah",
    above: "di atas",
    between: "antara",
    and: "dan",
    aggregationFallback: "Sebutkan nama barang atau lokasinya ya! Contoh: 'Total harga laptop' atau 'Rata-rata harga kursi'",
    rankingFallback: "Sebutkan jenis ranking yang diinginkan ya! Contoh: 'Barang termahal' atau 'Top 5 termurah'",
    groupingFallback: "Sebutkan cara pengelompokannya ya! Contoh: 'Jumlah barang per lokasi' atau 'Barang yang dimiliki Mutiara'"
};

router.post('/chat', async (req, res) => {
    try {
        const { message, history = [], sessionId = 'default' } = req.body;

        console.log('\n=== CHAT REQUEST ===');
        console.log('User:', message);
        console.log('Session ID:', sessionId);

        const context = getConversationContext(sessionId);
        console.log('Context:', JSON.stringify(context, null, 2));

        const geminiResponse = await chatWithGemini(message, history, context);

        console.log('Gemini Intent:', geminiResponse.intent);
        console.log('Needs Query:', geminiResponse.needsQuery);
        console.log('Is Follow-Up:', geminiResponse.isFollowUp);
        console.log('Display Type:', geminiResponse.displayType);

        let finalResponse = geminiResponse.response;
        let responseData = null;

        const noQueryIntents = ['sapaan', 'ucapan_terima_kasih', 'off_topic', 'bantuan', 'kabar', 'casual_chat'];

        if (noQueryIntents.includes(geminiResponse.intent)) {
            console.log('No query needed');
            console.log('===================\n');

            return res.json({
                intent: geminiResponse.intent,
                confidence: 1.0,
                response: finalResponse,
                data: null,
                displayType: geminiResponse.displayType,
                suggestions: generateSmartSuggestions(geminiResponse.intent, context),
                status: 'success'
            });
        }

        if (geminiResponse.needsQuery && geminiResponse.sqlQuery) {
            console.log('SQL Query:', geminiResponse.sqlQuery);

            let finalQuery = geminiResponse.sqlQuery;
            if (geminiResponse.isFollowUp && context.lastItems && context.lastItems.ids) {
                finalQuery = finalQuery.replace('[IDs dari konteks]', context.lastItems.ids.join(','));
            }

            const queryResult = await executeAndFormatQuery(
                finalQuery,
                geminiResponse.intent
            );

            if (queryResult.success) {
                responseData = queryResult.data;

                const itemIds = queryResult.rows.map(r => r.id_barang).filter(Boolean);
                const itemNames = [...new Set(queryResult.rows.map(r => r.nama_barang).filter(Boolean))];

                updateConversationContext(sessionId, {
                    lastItems: {
                        ids: itemIds,
                        namaBarang: itemNames.join(', '),
                        count: queryResult.count
                    },
                    lastIntent: geminiResponse.intent,
                    lastQuery: finalQuery
                });

                if (queryResult.count > 0) {
                    if (geminiResponse.intent === 'agregasi' && queryResult.rows[0]) {
                        const row = queryResult.rows[0];
                        if (row.total !== undefined) {
                            const totalFormatted = new Intl.NumberFormat('id-ID').format(row.total || 0);
                            finalResponse = `${geminiResponse.response}\n💰 Total: Rp ${totalFormatted}`;
                            if (row.jumlah) {
                                finalResponse += ` dari ${row.jumlah} barang`;
                            }
                        } else if (row.rata !== undefined || row.average !== undefined) {
                            const avg = row.rata || row.average || 0;
                            const avgFormatted = new Intl.NumberFormat('id-ID').format(Math.round(avg));
                            finalResponse = `${geminiResponse.response}\n📊 Rata-rata: Rp ${avgFormatted}`;
                            if (row.jumlah) {
                                finalResponse += ` dari ${row.jumlah} barang`;
                            }
                        }
                    } else {
                        if (queryResult.count === 1) {
                            finalResponse = `${geminiResponse.response}`;
                        } else if (queryResult.count <= 5) {
                            finalResponse = `${geminiResponse.response} Ada ${queryResult.count} item nih 📦`;
                        } else {
                            finalResponse = `${geminiResponse.response} Wah lumayan banyak, ada ${queryResult.count} item! 📦`;
                        }
                    }
                }
            } else {
                finalResponse = queryResult.message || 'Hmm, sepertinya data tidak ditemukan 🤔';
                responseData = null;
            }
        }

        console.log('Final Response:', finalResponse);
        console.log('===================\n');

        res.json({
            intent: geminiResponse.intent,
            confidence: 1.0,
            response: finalResponse,
            data: responseData,
            displayType: geminiResponse.displayType,
            suggestions: generateSmartSuggestions(geminiResponse.intent, context),
            status: 'success',
            sessionId: sessionId
        });

    } catch (error) {
        console.error('Chat Error:', error);

        res.status(500).json({
            intent: 'error',
            confidence: 0,
            response: 'Waduh, ada error nih 😅 Coba lagi ya atau hubungi tim IT!',
            data: null,
            status: 'error',
            error: error.message
        });
    }
});

function generateSmartSuggestions(intent, context = null) {
    if (context && context.lastItems && context.lastItems.namaBarang) {
        const barang = context.lastItems.namaBarang.split(',')[0].trim();
        return [
            { icon: 'owner', text: 'Siapa pemiliknya?', query: 'Siapa pemilik barang tersebut?' },
            { icon: 'location', text: 'Lokasinya dimana?', query: 'Di mana lokasi barang tersebut?' },
            { icon: 'price', text: 'Berapa harganya?', query: 'Berapa harga barang tersebut?' }
        ];
    }

    const suggestions = {
        'harga_barang': [
            { icon: 'location', text: 'Lokasi barang?', query: 'Di mana lokasinya?' },
            { icon: 'owner', text: 'Siapa pemiliknya?', query: 'Siapa pemiliknya?' }
        ],
        'lokasi_barang': [
            { icon: 'price', text: 'Berapa harganya?', query: 'Berapa harganya?' },
            { icon: 'owner', text: 'Siapa pemiliknya?', query: 'Siapa pemiliknya?' }
        ],
        'kepemilikan_barang': [
            { icon: 'price', text: 'Berapa harganya?', query: 'Berapa harganya?' },
            { icon: 'location', text: 'Di mana lokasinya?', query: 'Di mana lokasinya?' }
        ],
        'sapaan': [
            { icon: 'price', text: 'Cek harga barang', query: 'Berapa harga laptop?' },
            { icon: 'location', text: 'Cari lokasi barang', query: 'Di mana lokasi printer?' },
            { icon: 'owner', text: 'Cek kepemilikan', query: 'Siapa pemilik kursi?' }
        ],
        'kabar': [
            { icon: 'guide', text: 'Lihat panduan', query: 'Bantuan' },
            { icon: 'price', text: 'Cek barang', query: 'Tampilkan laptop' }
        ],
        'off_topic': [
            { icon: 'guide', text: 'Lihat Panduan', query: 'Bantuan' },
            { icon: 'price', text: 'Cari barang', query: 'Tampilkan kursi' }
        ]
    };

    return suggestions[intent] || [
        { icon: 'price', text: 'Cari barang', query: 'Berapa harga laptop?' },
        { icon: 'guide', text: 'Lihat Panduan', query: 'Bantuan' }
    ];
}

router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Chatbot router is running',
        timestamp: new Date().toISOString()
    });
});

router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Chatbot router test endpoint',
        endpoints: {
            chat: 'POST /chat',
            health: 'GET /health',
            test: 'GET /test'
        },
        example_request: {
            url: '/chat',
            method: 'POST',
            body: {
                message: 'Berapa harga kursi rapat?',
                sessionId: 'user123'
            }
        }
    });
});

router.use((req, res, next) => {
    res.locals.currentUser = req.session.email || req.session.atasanEmail || 'guest';
    res.locals.userType = req.session.email ? 'admin' : req.session.atasanEmail ? 'atasan' : 'guest';
    next();
});

router.post('/clear-chat', (req, res) => {
    const { sessionId = 'default' } = req.body;
    if (conversationContexts.has(sessionId)) {
        conversationContexts.delete(sessionId);
    }
    res.json({ success: true, message: 'Chat dan konteks berhasil dihapus' });
});

router.get('/chatbot', (req, res) => {
    res.render('chatbot', {
        user: req.session.user,
        role: req.session.role || (req.session.atasanEmail ? 'atasan' : 'admin')
    });
});

router.post('/clear-session', (req, res) => {
    res.json({ success: true, message: 'Session cleared' });
});

module.exports = router;