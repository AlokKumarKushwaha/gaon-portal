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
let krishiCollection;

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

const DEFAULT_KRISHI = [
  {
    id: 'dhan',
    name: 'धान (Dhan / Paddy)',
    icon: '🌾',
    season: 'kharif',
    seasonLabel: 'खरीफ (गर्मी/बरसात)',
    image: '/images/crops/dhan.jpg',
    sowing: 'जून से जुलाई (पौधशाला: मई-जून, रोपाई: 21-25 दिन पर)',
    harvest: 'अक्टूबर से नवंबर',
    production: '20 से 25 कुंतल प्रति बीघा (उन्नत किस्मों में)',
    khadSchedule: [
      { name: 'DAP (फास्फोरस)', dose: '20 से 25 किलो प्रति बीघा', timing: 'अंतिम जुताई या रोपाई के समय (शुरुआत में ही पूरा डालें)', badge: 'dap' },
      { name: 'पोटाश (MOP)', dose: '12 से 15 किलो प्रति बीघा', timing: 'रोपाई के समय (इससे दाना चमकदार, भारी और रोगमुक्त बनता है)', badge: 'potash' },
      { name: 'यूरिया (नाइट्रोजन)', dose: '30 से 35 किलो प्रति बीघा (3 बार में बांटकर)', timing: '1/3 रोपाई के 10 दिन बाद, 1/3 कल्ले फूटते समय (30 दिन), 1/3 बालियां निकलने से ठीक पहले', badge: 'urea' },
      { name: 'जिंक सल्फेट (21%)', dose: '5 किलो प्रति बीघा', timing: 'खैरा रोग से बचाव के लिए (यूरिया के साथ दें, DAP के साथ कभी न मिलाएं)', badge: 'zinc' }
    ],
    irrigation: [
      'रोपाई के बाद शुरुआती 15-20 दिनों तक खेत में 2-3 इंच पानी भरा रहना चाहिए ताकि पौधे अच्छे से जड़ पकड़ सकें।',
      'कल्ले फूटने (Tillering) और बालियां निकलने व दाना भरने के समय खेत में नमी होना बहुत ज़रूरी है।'
    ],
    diseases: [
      { name: 'खैरा रोग', symptoms: 'पत्तियां नीचे से पीली पड़कर कत्थई/भूरे धब्बे बनने लगते हैं।', medicine: 'जिंक सल्फेट 5 ग्राम + बुझा चूना 2.5 ग्राम', sprayDose: 'प्रति 1 लीटर पानी में घोलकर स्प्रे करें (15 लीटर की टंकी में 75g जिंक + 35g चूना)।' },
      { name: 'तना छेदक व पत्ती लपेटक सुंडी', symptoms: 'मुख्य तना सूख जाता है (डेड हार्ट) या पत्तियां मुड़कर सफेद हो जाती हैं।', medicine: 'कोराजन (Coragen) या कार्टाप (Cartap 4G)', sprayDose: 'कोराजन 6ml प्रति 15 लीटर टंकी स्प्रे करें या कार्टाप 4G (4 किलो/बीघा) खेत में डालें।' },
      { name: 'शीथ ब्लाइट (झुलसा रोग)', symptoms: 'तने व पत्तियों पर सांप की खाल जैसे भूरे धब्बे।', medicine: 'हेक्साकोनाजोल (Hexaconazole 5% EC)', sprayDose: '30ml प्रति 15 लीटर पानी की टंकी में मिलाकर छिड़काव करें।' }
    ],
    kisanTips: 'यूरिया और DAP को कभी भी मिलाकर ज्यादा देर तक न रखें। जिंक को हमेशा यूरिया के साथ अलग से छिड़कें। बालियां निकलते समय पानी की कमी न होने दें।'
  },
  {
    id: 'gehun',
    name: 'गेहूं (Gehun / Wheat)',
    icon: '🌾',
    season: 'rabi',
    seasonLabel: 'रबी (सर्दियां)',
    image: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?auto=format&fit=crop&w=600&q=80',
    sowing: '15 नवंबर से 30 नवंबर (अगेती) / दिसंबर प्रथम सप्ताह (पछेती)',
    harvest: 'मार्च से अप्रैल',
    production: '18 से 22 कुंतल प्रति बीघा',
    khadSchedule: [
      { name: 'DAP (फास्फोरस)', dose: '25 से 30 किलो प्रति बीघा', timing: 'अंतिम जुताई व बुवाई के समय कतारों में बीज के नीचे डालें', badge: 'dap' },
      { name: 'पोटाश (MOP)', dose: '10 से 12 किलो प्रति बीघा', timing: 'बुवाई के समय ही जमीन में दें', badge: 'potash' },
      { name: 'यूरिया (नाइट्रोजन)', dose: '35 से 40 किलो प्रति बीघा', timing: '1/3 बुवाई पर, 1/3 पहली सिंचाई पर (21 दिन), 1/3 दूसरी सिंचाई पर', badge: 'urea' },
      { name: 'सल्फर (Sulfur 80% or 90%)', dose: '3 से 4 किलो प्रति बीघा', timing: 'पहली सिंचाई पर यूरिया के साथ (दानों में चमक व प्रोटीन बढ़ती है)', badge: 'sulfur' }
    ],
    irrigation: [
      'पहली सिंचाई: बुवाई के ठीक 21 दिन बाद (CRI स्टेज - मुकुट जड़ निकलने पर) — यह सबसे महत्वपूर्ण सिंचाई है, इसे कभी न छोड़ें!',
      'दूसरी सिंचाई: कल्ले फूटते समय (40-45 दिन बाद)।',
      'तीसरी सिंचाई: गांठ बनते समय (60-65 दिन बाद)।',
      'चौथी व पांचवीं सिंचाई: फूल आने व दाना दूधिया भरने के समय।'
    ],
    diseases: [
      { name: 'दीमक (Termites)', symptoms: 'पौधे सूखने लगते हैं और जड़ों को दीमक काट देती है।', medicine: 'क्लोरपायरीफॉस (Chlorpyrifos 20% EC)', sprayDose: 'सिंचाई के पानी के साथ 500ml प्रति बीघा बहाएं या बीज उपचार करें।' },
      { name: 'पीला रतुआ / गेरुआ (Yellow Rust)', symptoms: 'पत्तियों पर पीले रंग की पाउडर जैसी धारियां बन जाती हैं, हाथ लगाने पर पीला रंग लगता है।', medicine: 'टिल्ट (Tilt / Propiconazole 25% EC)', sprayDose: '15-20ml प्रति 15 लीटर टंकी में मिलाकर छिड़काव करें।' },
      { name: 'गुल्ली डंडा / मंडूसी खरपतवार', symptoms: 'गेहूं जैसा खरपतवार जो गेहूं को दबा देता है।', medicine: 'क्लोडिनाफॉप (Clodinafop 15% WP)', sprayDose: '160 ग्राम प्रति एकड़ पहली सिंचाई के बाद जब खरपतवार 2-3 पत्ती की हो।' }
    ],
    kisanTips: 'गेहूं में पहली सिंचाई 21 दिन पर हल्की करें, ज्यादा जलभराव न करें। जब बालियों में दाना भर रहा हो तब तेज हवा चलने पर पानी न लगाएं, नहीं तो फसल गिर सकती है।'
  },
  {
    id: 'ganna',
    name: 'गन्ना (Ganna / Sugarcane)',
    icon: '🎋',
    season: 'cash',
    seasonLabel: 'नगदी फसल (वार्षिक)',
    image: '/images/crops/ganna.jpg',
    sowing: 'शरदकालीन: अक्टूबर-नवंबर / बसंतकालीन: फरवरी-मार्च',
    harvest: 'नवंबर से मार्च (10-12 महीने बाद)',
    production: '250 से 350 कुंतल प्रति बीघा',
    khadSchedule: [
      { name: 'गोबर की सड़ी खाद', dose: '2 से 3 ट्रॉली प्रति बीघा', timing: 'खेत की पहली गहरी जुताई के समय अच्छे से मिलाएं', badge: 'gobar' },
      { name: 'DAP (फास्फोरस)', dose: '35 से 40 किलो प्रति बीघा', timing: 'नाली/कूड़ में गन्ने के टुकड़ों के नीचे बुवाई के समय', badge: 'dap' },
      { name: 'पोटाश (MOP)', dose: '20 से 25 किलो प्रति बीघा', timing: 'बुवाई के समय (गन्ने में मिठास और वजन बढ़ाता है)', badge: 'potash' },
      { name: 'यूरिया (नाइट्रोजन)', dose: '50 से 60 किलो प्रति बीघा', timing: '3-4 बार में: 45 दिन, 75 दिन, 105 दिन और अंतिम मिट्टी चढ़ाते समय (बरसात से पहले पूरा कर लें)', badge: 'urea' }
    ],
    irrigation: [
      'गर्मी के दिनों में: हर 10 से 15 दिन के अंतराल पर सिंचाई ज़रूर करें।',
      'सर्दियों में: 20-25 दिन के अंतराल पर पानी दें।',
      'बरसात में: जल निकासी की उचित व्यवस्था रखें ताकि खेत में पानी न भरे।'
    ],
    diseases: [
      { name: 'कंसुआ / तना छेदक', symptoms: 'जमीन की सतह के पास तने में छेद और बीच की पत्ती (गोब) सूख जाती है।', medicine: 'फिप्रोनिल (Fipronil 0.3% GR / Regent) या कोराजन', sprayDose: 'फिप्रोनिल 5 किलो प्रति बीघा खाद में मिलाकर जड़ों में डालें या कोराजन ड्रेंचिंग करें।' },
      { name: 'लाल सड़न रोग (Red Rot)', symptoms: 'गन्ना बीच से चीरने पर लाल रंग और शराब जैसी गंध आती है।', medicine: 'कार्बेन्डाजिम (Bavistin) से बीज शोधन', sprayDose: 'बुवाई से पहले गन्ने के टुकड़ों को 2 ग्राम प्रति लीटर पानी के घोल में 15 मिनट डुबोएं।' },
      { name: 'सफेद सुंडी (White Grub)', symptoms: 'गन्ने की जड़ें कट जाती हैं और पूरा पौधा सूख जाता है।', medicine: 'क्लोरपायरीफॉस 50% EC', sprayDose: '500ml प्रति बीघा सिंचाई के पानी के साथ चलाएं।' }
    ],
    kisanTips: 'गन्ने की बुवाई हमेशा ट्रेंच विधि (नाली विधि) से 4 फीट की दूरी पर करें। जुलाई में बरसात शुरू होने से पहले गन्ने पर मिट्टी ज़रूर चढ़ाएं ताकि गन्ना गिरे नहीं।'
  },
  {
    id: 'chana',
    name: 'चना (Chana / Gram)',
    icon: '🌱',
    season: 'rabi',
    seasonLabel: 'रबी (सर्दियां)',
    image: '/images/crops/chana.jpg',
    sowing: '15 अक्टूबर से 15 नवंबर (उचित नमी में)',
    harvest: 'फरवरी अंत से मार्च',
    production: '8 से 12 कुंतल प्रति बीघा',
    khadSchedule: [
      { name: 'DAP (फास्फोरस)', dose: '15 से 20 किलो प्रति बीघा', timing: 'बुवाई के समय (चना दलहनी फसल है, इसे ज्यादा यूरिया नहीं चाहिए)', badge: 'dap' },
      { name: 'सल्फर (Sulfur)', dose: '3 किलो प्रति बीघा', timing: 'बुवाई के समय (दाने की गुणवत्ता व रोग प्रतिरोधक क्षमता बढ़ाता है)', badge: 'sulfur' },
      { name: 'यूरिया (नाइट्रोजन)', dose: 'सिर्फ 5 किलो प्रति बीघा (या न दें)', timing: 'चना अपनी जड़ों की गांठों से खुद खाद बनाता है, ज्यादा यूरिया से सिर्फ पत्तियां बढ़ती हैं दाना नहीं!', badge: 'urea' }
    ],
    irrigation: [
      'चना में केवल 1 या 2 हल्की सिंचाई की आवश्यकता होती है।',
      'पहली सिंचाई: बुवाई के 45-50 दिन बाद (फूल आने से ठीक पहले)।',
      'दूसरी सिंचाई: फलियों में दाना बनते समय।',
      '⚠️ सावधान: जब चने में फूल आ रहे हों, तब कभी पानी न लगाएं! फूल झड़ जाएंगे।'
    ],
    diseases: [
      { name: 'उकठा रोग (Wilt)', symptoms: 'पौधे हरे-भरे ही अचानक मुरझाकर सूख जाते हैं।', medicine: 'ट्राइकोडर्मा (Trichoderma) से बीज उपचार', sprayDose: '5 ग्राम प्रति किलो बीज को ट्राइकोडर्मा से उपचारित करके ही बोएं।' },
      { name: 'फली छेदक सुंडी (Pod Borer)', symptoms: 'हरी सुंडी फलियों में छेद करके दाने को खा जाती है।', medicine: 'इमामेक्टिन बेंजोएट (Emamectin Benzoate 5% SG)', sprayDose: '8 से 10 ग्राम प्रति 15 लीटर पानी की टंकी में मिलाकर छिड़कें।' }
    ],
    kisanTips: 'जब चना 25-30 दिन का हो जाए, तो ऊपर की कोमल कली (खूंटाई / Nipping) तोड़ दें। इससे पौधे में 4 गुना ज्यादा शाखाएं फूटती हैं और पैदावार दोगुनी होती है।'
  },
  {
    id: 'sarson',
    name: 'सरसों (Sarson / Mustard)',
    icon: '🌼',
    season: 'rabi',
    seasonLabel: 'रबी (सर्दियां)',
    image: '/images/crops/sarson.jpg',
    sowing: '25 सितंबर से 25 अक्टूबर (तापमान 30-32 डिग्री से कम होने पर)',
    harvest: 'फरवरी से मार्च',
    production: '8 से 10 कुंतल प्रति बीघा',
    khadSchedule: [
      { name: 'DAP (फास्फोरस)', dose: '15 से 20 किलो प्रति बीघा', timing: 'बुवाई के समय अंतिम जुताई में', badge: 'dap' },
      { name: 'सल्फर (बेंटोनाइट 90%)', dose: '5 किलो प्रति बीघा (अनिवार्य)', timing: 'बुवाई के समय (सरसों में तेल का प्रतिशत 3-4% बढ़ा देता है)', badge: 'sulfur' },
      { name: 'यूरिया (नाइट्रोजन)', dose: '20 से 25 किलो प्रति बीघा', timing: 'आधी मात्रा बुवाई पर, आधी पहली सिंचाई पर', badge: 'urea' },
      { name: 'पोटाश (MOP)', dose: '8 किलो प्रति बीघा', timing: 'बुवाई के समय', badge: 'potash' }
    ],
    irrigation: [
      'पहली सिंचाई: बुवाई के 25 से 30 दिन बाद (शाखाएं निकलते समय)।',
      'दूसरी सिंचाई: फलियां बनते समय (60-65 दिन बाद)।'
    ],
    diseases: [
      { name: 'माहू / चेपा (Aphids)', symptoms: 'सर्दियों में बादलों के मौसम में छोटे हरे-काले कीड़े फूलों व फलियों का रस चूसते हैं।', medicine: 'इमिडाक्लोप्रिड (Imidacloprid 17.8% SL)', sprayDose: 'इमिडाक्लोप्रिड 8-10ml प्रति 15 लीटर टंकी स्प्रे करें।' },
      { name: 'सफेद रतुआ (White Rust)', symptoms: 'पत्तियों की निचली सतह पर सफेद उभरे हुए चकत्ते।', medicine: 'रिडोमिल गोल्ड (Ridomil Gold)', sprayDose: '30 ग्राम प्रति 15 लीटर टंकी में मिलाकर छिड़कें।' }
    ],
    kisanTips: 'सरसों में सल्फर खाद डालना कभी न भूलें—यह सरसों का मुख्य भोजन है। माहू कीड़े से बचाव के लिए खेत में पीला चिपचिपा ट्रैप (Yellow Sticky Trap) लगाएं।'
  },
  {
    id: 'makka',
    name: 'मक्का (Makka / Maize)',
    icon: '🌽',
    season: 'kharif',
    seasonLabel: 'खरीफ / जायद',
    image: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=600&q=80',
    sowing: 'खरीफ: जून-जुलाई / जायद: फरवरी-मार्च',
    harvest: '80 से 100 दिन बाद',
    production: '20 से 28 कुंतल प्रति बीघा',
    khadSchedule: [
      { name: 'DAP (फास्फोरस)', dose: '25 किलो प्रति बीघा', timing: 'बुवाई के समय कतारों में', badge: 'dap' },
      { name: 'यूरिया (नाइट्रोजन)', dose: '35 किलो प्रति बीघा (3 बार में)', timing: '1/3 बुवाई पर, 1/3 घुटने की ऊंचाई पर (30 दिन), 1/3 नर मंजरी आने पर', badge: 'urea' },
      { name: 'पोटाश (MOP)', dose: '12 किलो प्रति बीघा', timing: 'बुवाई के समय', badge: 'potash' },
      { name: 'जिंक सल्फेट', dose: '5 किलो प्रति बीघा', timing: 'बुवाई के समय (सफेद कली रोग से बचाव)', badge: 'zinc' }
    ],
    irrigation: [
      'मक्का में जलभराव बिल्कुल नहीं होना चाहिए, खेत से पानी तुरंत निकलने की व्यवस्था हो।',
      'नर मंजरी (Tasseling) व भुट्टे में दाना भरते समय नमी बहुत ज़रूरी है।'
    ],
    diseases: [
      { name: 'फॉल आर्मीवर्म (सुंडी)', symptoms: 'पत्तियों में बड़े-बड़े छेद और भुट्टे की गोब में कीड़े का मल दिखता है।', medicine: 'कोराजन (Coragen) या डेलीगेट (Delegate)', sprayDose: 'कोराजन 6ml प्रति 15 लीटर टंकी गोब के अंदर तक स्प्रे करें।' }
    ],
    kisanTips: 'मक्का में जब पौधे घुटने तक ऊंचे हो जाएं तब मिट्टी ज़रूर चढ़ाएं ताकि पौधे आंधी-तूफान में न गिरें।'
  },
  {
    id: 'aloo',
    name: 'आलू (Aloo / Potato)',
    icon: '🥔',
    season: 'rabi',
    seasonLabel: 'रबी (सर्दियां)',
    image: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?auto=format&fit=crop&w=600&q=80',
    sowing: '15 अक्टूबर से 10 नवंबर (अगेती: सितंबर अंत)',
    harvest: 'दिसंबर से फरवरी (75-90 दिन बाद)',
    production: '80 से 120 कुंतल प्रति बीघा',
    khadSchedule: [
      { name: 'सड़ी गोबर की खाद', dose: '3 ट्रॉली प्रति बीघा', timing: 'खेत की तैयारी के समय', badge: 'gobar' },
      { name: 'DAP (फास्फोरस)', dose: '35 से 40 किलो प्रति बीघा', timing: 'बुवाई के समय मेड़ों में', badge: 'dap' },
      { name: 'पोटाश (MOP)', dose: '30 से 35 किलो प्रति बीघा', timing: 'बुवाई पर (आलू का आकार बड़ा, छिलका मजबूत और चमकदार बनता है)', badge: 'potash' },
      { name: 'यूरिया (नाइट्रोजन)', dose: '35 किलो प्रति बीघा', timing: 'आधी बुवाई पर, आधी मिट्टी चढ़ाते समय (25-30 दिन बाद)', badge: 'urea' }
    ],
    irrigation: [
      'पहली सिंचाई: बुवाई के 7-10 दिन बाद हल्की सिंचाई करें (मेड़ 2/3 ही डूबे, ऊपर तक पानी न चढ़े)।',
      'बाद में 10-12 दिन के अंतराल पर नमी बनाए रखें।'
    ],
    diseases: [
      { name: 'पछेती झुलसा रोग (Late Blight)', symptoms: 'कोहरे व ठंड में पत्तियों के किनारों पर काले-भूरे गीले धब्बे और पत्तियों के नीचे सफेद फफूंद।', medicine: 'रिडोमिल गोल्ड (Ridomil Gold) या मैन्कोजेब (Mancozeb 75% WP)', sprayDose: 'मैन्कोजेब 35 ग्राम प्रति 15 लीटर टंकी कोहरे के मौसम में हर 10 दिन पर छिड़कें।' }
    ],
    kisanTips: 'बुवाई के 25-30 दिन बाद आलू पर अच्छी तरह मिट्टी चढ़ाएं ताकि कंद धूप के संपर्क में न आएं (धूप लगने से आलू हरा व जहरीला हो जाता है)।'
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
// KHETI-BAADI (Krishi Advisory & Crops Guide)
// =====================================================

// Sabhi faslon ki jankari laayein
app.get('/api/krishi', async(req, res) => {
    try {
        let data = [];
        if (krishiCollection) {
            data = await krishiCollection.find({}).toArray();
        }
        if (!data || data.length === 0) {
            data = DEFAULT_KRISHI;
        }
        res.json(data);
    } catch (error) {
        console.error('Krishi fetch error:', error);
        res.json(DEFAULT_KRISHI);
    }
});

// Sirf Pradhan fasal jankari add kar sakte hain
app.post('/api/krishi', requireAdmin, async(req, res) => {
    try {
        const item = req.body;
        if (!item.name) {
            return res.status(400).json({ error: 'Fasal ka naam zaruri hai' });
        }
        item.id = item.id || uid();
        await krishiCollection.insertOne(item);
        res.json(item);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Fasal jankari save nahi hui' });
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
        krishiCollection = db.collection('krishi');

        // Sync crop images in database if they were previously stored with older image URLs
        try {
            for (const crop of DEFAULT_KRISHI) {
                await krishiCollection.updateOne({ id: crop.id }, { $set: { image: crop.image } });
            }
        } catch (syncErr) {
            console.warn('Krishi image sync warning:', syncErr.message);
        }

        console.log('✅ MongoDB connected successfully');
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message || error);
        console.log('⚠️ Kripya check karein ki MongoDB Atlas Network Access me 0.0.0.0/0 allowed hai ya nahi.');
        // 5 second baad dobara koshish karein
        setTimeout(connectDB, 5000);
    }
}

connectDB();