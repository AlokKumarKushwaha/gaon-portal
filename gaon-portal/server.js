// Hamara Gaon Portal - Backend Server

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== MONGODB =====
let MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI .env file me nahi mila');
    process.exit(1);
}

// Clean up: agar galti se MONGODB_URI= ya quotes ya spaces paste ho gaye hon
MONGODB_URI = MONGODB_URI.trim();
if (MONGODB_URI.startsWith('MONGODB_URI=')) {
    MONGODB_URI = MONGODB_URI.slice('MONGODB_URI='.length).trim();
}
MONGODB_URI = MONGODB_URI.replace(/^["']|["']$/g, '').trim();

const client = new MongoClient(MONGODB_URI);

let db;
let samasyaCollection;
let suchnaCollection;
let jaankariCollection;
let yojanaCollection;
let chaupalCollection;

// ===== PRADHAN (ADMIN) LOGIN =====
const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD || 'jagdishpur2026';

function requireAdmin(req, res, next) {
    const key = req.headers['x-admin-key'];

    if (key !== ADMIN_PASSWORD) {
        return res.status(401).json({
            error: 'Sirf Pradhan hi ye dekh sakte hain'
        });
    }

    next();
}

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// Browser cache control
app.use((req, res, next) => {
    if (
        req.path === '/sw.js' ||
        req.path === '/' ||
        req.path === '/index.html'
    ) {
        res.set(
            'Cache-Control',
            'no-cache, no-store, must-revalidate'
        );
    }

    next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Database readiness check middleware
app.use('/api', (req, res, next) => {
    if (req.path === '/admin/login') return next();
    if (!db) {
        return res.status(503).json({
            error: 'Database se connection ban raha hai, kripya 5 second baad dobara koshish karein.'
        });
    }
    next();
});

// ===== DEFAULT DATA =====

const DEFAULT_JAANKARI = {
    history: 'Yahan gaon ka itihaas likhein — gaon kab basa, kya khaasiyat hai, kaunse tyohar manaye jaate hain.',
    population: 'Jansankhya yahan darj karein.',
    contacts: [
        { who: 'Pradhan / Sarpanch', num: '—' },
        { who: 'Doctor / Swasthya Kendra', num: '—' },
        { who: 'Police Station', num: '100' },
        { who: 'Bijli Vibhag', num: '—' },
        { who: 'School', num: '—' }
    ]
};

const DEFAULT_YOJANA = [{
        id: 'y1',
        name: 'PM Awas Yojana',
        desc: 'Gareeb parivaron ke liye pakka ghar banane ke liye sarkari sahayata.',
        apply: 'Gram Panchayat ya CSC center me sampark karein.'
    },
    {
        id: 'y2',
        name: 'Ration Card',
        desc: 'Sasti dar par anaaj paane ke liye ration card banwayein.',
        apply: 'Block ke khadya vibhag karyalay me aavedan karein.'
    }
];

function uid() {
    return (
        Date.now().toString(36) +
        Math.random().toString(36).slice(2, 8)
    );
}

// =====================================================
// SAMASYA (Problem Reports)
// =====================================================

// Sirf Pradhan complaints dekh sakte hain
app.get('/api/samasya', requireAdmin, async(req, res) => {
    try {
        const data = await samasyaCollection
            .find({})
            .sort({ date: -1 })
            .toArray();

        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Complaints load nahi ho paayi' });
    }
});

// Koi bhi gaon wala complaint kar sakta hai
app.post('/api/samasya', async(req, res) => {
    try {
        const { category, desc, name, photo } = req.body;

        if (!category || !desc) {
            return res.status(400).json({
                error: 'category aur desc zaruri hai'
            });
        }

        const item = {
            id: uid(),
            category,
            desc,
            name: name || '',
            photo: photo || null,
            status: 'nayi',
            date: Date.now()
        };

        await samasyaCollection.insertOne(item);

        res.json({ ok: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Complaint save nahi ho paayi'
        });
    }
});

// Sirf Pradhan status badal sakte hain
app.patch('/api/samasya/:id', requireAdmin, async(req, res) => {
    try {
        const item = await samasyaCollection.findOne({
            id: req.params.id
        });

        if (!item) {
            return res.status(404).json({
                error: 'nahi mila'
            });
        }

        if (req.body.status) {
            await samasyaCollection.updateOne({ id: req.params.id }, {
                $set: {
                    status: req.body.status
                }
            });
        }

        const updated = await samasyaCollection.findOne({
            id: req.params.id
        });

        res.json(updated);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Status update nahi hua'
        });
    }
});

// Sirf Pradhan delete kar sakte hain
app.delete('/api/samasya/:id', requireAdmin, async(req, res) => {
    try {
        await samasyaCollection.deleteOne({
            id: req.params.id
        });

        res.json({ ok: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Complaint delete nahi hui'
        });
    }
});

// =====================================================
// SUCHNA (Announcements)
// =====================================================

app.get('/api/suchna', async(req, res) => {
    try {
        const data = await suchnaCollection
            .find({})
            .sort({ date: -1 })
            .toArray();

        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Suchna load nahi hui'
        });
    }
});

app.post('/api/suchna', async(req, res) => {
    try {
        const { title, text, name } = req.body;

        if (!title || !text) {
            return res.status(400).json({
                error: 'title aur text zaruri hai'
            });
        }

        const item = {
            id: uid(),
            title,
            text,
            name: name || '',
            date: Date.now()
        };

        await suchnaCollection.insertOne(item);

        res.json(item);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Suchna save nahi hui'
        });
    }
});

// Sirf Pradhan edit kar sakte hain
app.put('/api/suchna/:id', requireAdmin, async(req, res) => {
    try {
        const item = await suchnaCollection.findOne({
            id: req.params.id
        });

        if (!item) {
            return res.status(404).json({
                error: 'nahi mila'
            });
        }

        const update = {};

        if (req.body.title) {
            update.title = req.body.title;
        }

        if (req.body.text) {
            update.text = req.body.text;
        }

        await suchnaCollection.updateOne({ id: req.params.id }, { $set: update });

        const updated = await suchnaCollection.findOne({
            id: req.params.id
        });

        res.json(updated);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Suchna update nahi hui'
        });
    }
});

// Sirf Pradhan delete kar sakte hain
app.delete('/api/suchna/:id', requireAdmin, async(req, res) => {
    try {
        await suchnaCollection.deleteOne({
            id: req.params.id
        });

        res.json({ ok: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Suchna delete nahi hui'
        });
    }
});

// =====================================================
// JAANKARI (Village Information)
// =====================================================

app.get('/api/jaankari', async(req, res) => {
    try {
        let data = await jaankariCollection.findOne({
            type: 'main'
        });

        if (!data) {
            data = {
                type: 'main',
                ...DEFAULT_JAANKARI
            };

            await jaankariCollection.insertOne(data);
        }

        delete data._id;

        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Jaankari load nahi hui'
        });
    }
});

app.put('/api/jaankari', async(req, res) => {
    try {
        let data = await jaankariCollection.findOne({
            type: 'main'
        });

        if (!data) {
            data = {
                type: 'main',
                ...DEFAULT_JAANKARI
            };
        }

        const updatedData = {
            ...data,
            ...req.body,
            type: 'main'
        };

        delete updatedData._id;

        await jaankariCollection.replaceOne({ type: 'main' },
            updatedData, { upsert: true }
        );

        res.json(updatedData);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Jaankari update nahi hui'
        });
    }
});

// =====================================================
// YOJANA (Government Schemes)
// =====================================================

app.get('/api/yojana', async(req, res) => {
    try {
        let data = await yojanaCollection
            .find({})
            .sort({ id: 1 })
            .toArray();

        if (data.length === 0) {
            await yojanaCollection.insertMany(DEFAULT_YOJANA);
            data = DEFAULT_YOJANA;
        }

        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Yojana load nahi hui'
        });
    }
});

app.post('/api/yojana', async(req, res) => {
    try {
        const { name, desc, apply } = req.body;

        if (!name || !desc) {
            return res.status(400).json({
                error: 'name aur desc zaruri hai'
            });
        }

        const item = {
            id: uid(),
            name,
            desc,
            apply: apply || 'Panchayat karyalay me sampark karein.'
        };

        await yojanaCollection.insertOne(item);

        res.json(item);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Yojana save nahi hui'
        });
    }
});

app.delete('/api/yojana/:id', async(req, res) => {
    try {
        await yojanaCollection.deleteOne({
            id: req.params.id
        });

        res.json({ ok: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Yojana delete nahi hui'
        });
    }
});

// =====================================================
// CHAUPAL (Community Social Feed)
// =====================================================

// Sabhi chaupal posts laayein (date ke hisaab se descending)
app.get('/api/chaupal', async(req, res) => {
    try {
        const data = await chaupalCollection
            .find({})
            .sort({ date: -1 })
            .limit(100)
            .toArray();

        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Chaupal posts load nahi ho paaye'
        });
    }
});

// Naya post jodein (koi bhi gaon wasi post kar sakta hai)
app.post('/api/chaupal', async(req, res) => {
    try {
        const { name, text, media, mediaType, link } = req.body;

        if (!text && !media && !link) {
            return res.status(400).json({
                error: 'Kripya sandesh likhein, photo/video chunein ya link daalein'
            });
        }

        const authorKey = req.body.authorKey || uid();
        const item = {
            id: uid(),
            name: (name && name.trim()) || 'Gaon wasi',
            text: (text && text.trim()) || '',
            media: media || null,
            mediaType: mediaType || (media ? 'photo' : null),
            link: (link && link.trim()) || null,
            authorKey,
            likes: 0,
            date: Date.now()
        };

        await chaupalCollection.insertOne(item);

        res.json(item);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Chaupal post save nahi ho paayi'
        });
    }
});

// Post par Like badhayein
app.post('/api/chaupal/:id/like', async(req, res) => {
    try {
        const result = await chaupalCollection.findOneAndUpdate(
            { id: req.params.id },
            { $inc: { likes: 1 } },
            { returnDocument: 'after' }
        );

        if (!result) {
            return res.status(404).json({ error: 'Post nahi mili' });
        }

        const likesCount = result.value ? result.value.likes : result.likes;
        res.json({ ok: true, likes: likesCount });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Like nahi ho paaya'
        });
    }
});

// Post delete karein: Pradhan ya Post karne wala vyakti (author)
app.delete('/api/chaupal/:id', async(req, res) => {
    try {
        const id = req.params.id;
        const post = await chaupalCollection.findOne({ id });
        if (!post) {
            return res.status(404).json({ error: 'Post nahi mili' });
        }

        const adminKey = req.headers['x-admin-key'];
        const authorKey = req.headers['x-author-key'];

        const isAdmin = adminKey && adminKey === ADMIN_PASSWORD;
        const isAuthor = authorKey && (post.authorKey === authorKey);

        if (!isAdmin && !isAuthor) {
            return res.status(403).json({
                error: 'Sirf post karne wale ya Pradhan ji hi sabhi ke liye delete kar sakte hain'
            });
        }

        await chaupalCollection.deleteOne({ id });

        res.json({ ok: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Chaupal post delete nahi ho paayi'
        });
    }
});

// =====================================================
// PRADHAN LOGIN
// =====================================================

app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;

    if (password === ADMIN_PASSWORD) {
        res.json({ ok: true });
    } else {
        res.status(401).json({
            error: 'Galat password'
        });
    }
});

// =====================================================
// START SERVER + CONNECT MONGODB
// =====================================================

// Pehle web server start karein taaki Render port detect kar sake aur deploy turant pass ho
app.listen(PORT, () => {
    console.log(
        `✅ Hamara Gaon Portal chal raha hai: http://localhost:${PORT}`
    );
});

async function connectDB() {
    try {
        console.log('🔄 Connecting to MongoDB Atlas...');
        await client.connect();

        db = client.db('gaonportal');

        samasyaCollection = db.collection('samasya');
        suchnaCollection = db.collection('suchna');
        jaankariCollection = db.collection('jaankari');
        yojanaCollection = db.collection('yojana');
        chaupalCollection = db.collection('chaupal');

        console.log('✅ MongoDB connected successfully');
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message || error);
        console.log('⚠️ Kripya check karein ki MongoDB Atlas Network Access me 0.0.0.0/0 allowed hai ya nahi.');
        // 5 second baad dobara koshish karein
        setTimeout(connectDB, 5000);
    }
}

connectDB();