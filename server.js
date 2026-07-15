const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const session = require('express-session'); // Paket Sesi
const bcrypt = require('bcryptjs');         // Paket Enkripsi
const Package = require('./models/Package');
const Gallery = require('./models/Gallery');
const Article = require('./models/Article');
const Banner = require('./models/Banner'); // Model Baru
const Admin = require('./models/Admin');    // Model Admin


const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

// --- KONFIGURASI SESI (SESSION) ---
app.use(session({
    secret: 'kunci-rahasia-abba-tour-2026', // Kunci enkripsi sesi
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // Sesi login bertahan 1 hari (24 jam)
}));

mongoose.connect('mongodb://127.0.0.1:27017/abbatour');

// --- BUAT AKUN ADMIN BAWAAN JIKA KOSONG ---
const setupDefaultAdmin = async () => {
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
        const hashedPassword = await bcrypt.hash('admin', 10);
        await Admin.create({ username: 'admin', password: hashedPassword });
        console.log('=========================================');
        console.log('AKUN ADMIN DEFAULT DIBUAT: admin / admin');
        console.log('=========================================');
    }
};
setupDefaultAdmin();

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/assets/'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

// --- ROUTES PENGUNJUNG ---
app.get('/', async (req, res) => {
    const banners = await Banner.find().sort({ createdAt: -1 }); // Ambil banner
    const umrohPackages = await Package.find({ type: 'Umroh', isActive: true }).sort({ departureDate: 1 });
    const hajiPackages = await Package.find({ type: 'Haji', isActive: true }).sort({ departureDate: 1 });
    const galleries = await Gallery.find();
    const articles = await Article.find().sort({ createdAt: -1 });
    res.render('index2', { banners, umrohPackages, hajiPackages, galleries, articles });
});
app.get('/v2', async (req, res) => {
    const banners = await Banner.find().sort({ createdAt: -1 }); // Ambil banner
    const umrohPackages = await Package.find({ type: 'Umroh', isActive: true }).sort({ departureDate: 1 });
    const hajiPackages = await Package.find({ type: 'Haji', isActive: true }).sort({ departureDate: 1 });
    const galleries = await Gallery.find();
    const articles = await Article.find().sort({ createdAt: -1 });
    res.render('index2', { banners, umrohPackages, hajiPackages, galleries, articles });
});

app.get('/paket/:id', async (req, res) => {
    try {
        const pkg = await Package.findById(req.params.id);
        let umrohPackages = await Package.find({ type: 'Umroh', isActive: true }).sort({ departureDate: 1 });
        umrohPackages = umrohPackages.filter(item => item.id !== pkg.id)
        if (!pkg) return res.status(404).send('Paket tidak ditemukan');
        res.render('detail2', { pkg, umrohPackages });
    } catch (err) {
        res.status(500).send('Terjadi kesalahan server.');
    }
});

app.get('/artikel/:slug', async (req, res) => {
  try {
    const article = await Article.findOne({ slug: req.params.slug });
    if (!article) return res.status(404).send('Artikel tidak ditemukan');
    res.render('article-detail2', { article });
  } catch (err) {
    res.status(500).send('Terjadi kesalahan server saat memuat artikel.');
  }
});
app.get('/profile', async (req, res) => {
  try {
    res.render('profile');
  } catch (err) {
    res.status(500).send('Terjadi kesalahan server saat memuat profil.');
  }
});

// --- ROUTES AUTENTIKASI (LOGIN / LOGOUT) ---
app.get('/login', (req, res) => {
    // Jika sudah login, langsung arahkan ke admin
    if (req.session.adminId) return res.redirect('/admin');
    res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username: username });
    
    // Cek apakah username ada dan password cocok
    if (admin && await bcrypt.compare(password, admin.password)) {
        req.session.adminId = admin._id; // Simpan sesi
        res.redirect('/admin');
    } else {
        res.render('login', { error: 'Username atau password salah!' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(); // Hapus sesi
    res.redirect('/login');
});

// --- MIDDLEWARE PROTEKSI HALAMAN ADMIN ---
// Semua route di bawah baris ini wajib login terlebih dahulu
const requireLogin = (req, res, next) => {
    if (req.session.adminId) {
        next(); // Lanjutkan
    } else {
        res.redirect('/login'); // Tolak, kembalikan ke halaman login
    }
};
app.use('/admin', requireLogin); 

// --- ROUTES ADMIN DASHBOARD (TERLINDUNGI) ---
app.get('/admin', async (req, res) => {
    const banners = await Banner.find().sort({ createdAt: -1 });
    const packages = await Package.find().sort({ departureDate: 1 });
    const galleries = await Gallery.find();
    const articles = await Article.find().sort({ createdAt: -1 });
    const admins = await Admin.find(); // Ambil data admin
    res.render('admin', { banners, packages, galleries, articles, admins });
});

// Tambah Akun Admin Baru
app.post('/admin/add-account', async (req, res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        await Admin.create({ username: req.body.username, password: hashedPassword });
        res.redirect('/admin');
    } catch (err) {
        res.send("Gagal menambah admin. Username mungkin sudah dipakai.");
    }
});

// Hapus Akun Admin
app.post('/admin/delete-account/:id', async (req, res) => {
    // Cegah admin menghapus dirinya sendiri (opsional tapi disarankan)
    if (req.params.id === req.session.adminId) {
        return res.send("Anda tidak bisa menghapus akun yang sedang Anda gunakan saat ini.");
    }
    await Admin.findByIdAndDelete(req.params.id);
    res.redirect('/admin');
});

// --- ROUTES TAMBAH DATA ---
app.post('/admin/add-banner', upload.single('image'), async (req, res) => {
    await Banner.create({ title: req.body.title, image: '/assets/' + req.file.filename });
    res.redirect('/admin');
});

app.post('/admin/add-package', upload.single('image'), async (req, res) => {
    await Package.create({ ...req.body, image: '/assets/' + req.file.filename });
    res.redirect('/admin');
});

// --- PERUBAHAN ROUTE TAMBAH GALERI (ALBUM MULTIPLE UPLOAD) ---
app.post('/admin/add-gallery', upload.fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'photos', maxCount: 30 } // Maksimal 30 foto per keberangkatan
]), async (req, res) => {
    try {
        // 1. Ambil nama file untuk Cover Image
        const coverPath = '/assets/' + req.files['coverImage'][0].filename;
        
        // 2. Ambil semua nama file untuk isi Album Photos
        let photoPaths = [];
        if (req.files['photos']) {
            photoPaths = req.files['photos'].map(file => '/assets/' + file.filename);
        }

        // 3. Simpan ke Database
        await Gallery.create({
            albumName: req.body.albumName,
            coverImage: coverPath,
            photos: photoPaths
        });

        res.redirect('/admin');
    } catch (err) {
        console.log(err);
        res.status(500).send('Gagal membuat album galeri keberangkatan.');
    }
});
// --- ROUTE DETAIL ALBUM GALERI (Halaman Baru) ---
app.get('/galeri/:id', async (req, res) => {
    try {
        const album = await Gallery.findById(req.params.id);
        if (!album) return res.status(404).send('Album keberangkatan tidak ditemukan');
        
        res.render('album-detail', { album });
    } catch (err) {
        res.status(500).send('Terjadi kesalahan server saat memuat album.');
    }
});

app.post('/admin/add-article', upload.single('image'), async (req, res) => {
    await Article.create({ ...req.body, image: '/assets/' + req.file.filename });
    res.redirect('/admin');
});

// --- ROUTES EDIT (TAMPILKAN FORM) ---
app.get('/admin/edit/:type/:id', async (req, res) => {
    const { type, id } = req.params;
    let data = null;
    
    if (type === 'banner') data = await Banner.findById(id);
    else if (type === 'package') data = await Package.findById(id);
    else if (type === 'gallery') data = await Gallery.findById(id);
    else if (type === 'article') data = await Article.findById(id);

    if (!data) return res.status(404).send('Data tidak ditemukan');
    res.render('edit', { type, data });
});

// --- ROUTES EDIT (SIMPAN PERUBAHAN) ---
// Kita ubah upload.single menjadi upload.fields agar bisa menerima banyak input file berbeda
app.post('/admin/edit/:type/:id', upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'coverImage', maxCount: 1 },
    { name: 'photos', maxCount: 30 }
]), async (req, res) => {
    const { type, id } = req.params;
    let updateData = { ...req.body };

    // Logika Khusus Tipe Galeri (Album)
    if (type === 'gallery') {
        const album = await Gallery.findById(id);
        
        // Jika ada upload cover baru
        if (req.files && req.files['coverImage']) {
            updateData.coverImage = '/assets/' + req.files['coverImage'][0].filename;
            const oldPath = path.join(__dirname, 'public', album.coverImage);
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
        
        // Jika ada tambahan foto baru
        if (req.files && req.files['photos']) {
            const newPhotos = req.files['photos'].map(file => '/assets/' + file.filename);
            updateData.photos = album.photos.concat(newPhotos); // Gabungkan foto lama dan tambahan baru
        }
        
        await Gallery.findByIdAndUpdate(id, updateData);
    } 
    // Logika Khusus Tipe Lain (Paket, Banner, Artikel)
    else {
        if (req.files && req.files['image']) {
            updateData.image = '/assets/' + req.files['image'][0].filename;
            let oldData;
            if (type === 'banner') oldData = await Banner.findById(id);
            if (type === 'package') oldData = await Package.findById(id);
            if (type === 'article') oldData = await Article.findById(id);

            if (oldData && oldData.image) {
                const oldPath = path.join(__dirname, 'public', oldData.image);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
        }

        if (type === 'banner') await Banner.findByIdAndUpdate(id, updateData);
        else if (type === 'package') {
            updateData.isActive = req.body.isActive === 'on';
            await Package.findByIdAndUpdate(id, updateData);
        } 
        else if (type === 'article') await Article.findByIdAndUpdate(id, updateData);
    }

    res.redirect('/admin');
});

// --- ROUTES HAPUS ---
app.post('/admin/delete/:type/:id', async (req, res) => {
    const { type, id } = req.params;
    let oldData;

    if (type === 'banner') {
        oldData = await Banner.findById(id);
        await Banner.findByIdAndDelete(id);
    } else if (type === 'package') {
        oldData = await Package.findById(id);
        await Package.findByIdAndDelete(id);
    } else if (type === 'gallery') {
        oldData = await Gallery.findById(id);
        await Gallery.findByIdAndDelete(id);
    } else if (type === 'article') {
        oldData = await Article.findById(id);
        await Article.findByIdAndDelete(id);
    }

    if (oldData && oldData.image) {
        const filePath = path.join(__dirname, 'public', oldData.image);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    res.redirect('/admin');
});
// --- ROUTE BARU: HAPUS FOTO SPESIFIK DALAM ALBUM ---
app.post('/admin/delete-album-photo/:id', async (req, res) => {
    try {
        const albumId = req.params.id;
        const photoToRemove = req.body.photoPath;
        
        const album = await Gallery.findById(albumId);
        if (album) {
            // Hapus nama file dari array database
            album.photos = album.photos.filter(photo => photo !== photoToRemove);
            await album.save();
            
            // Hapus file fisik dari folder assets
            const filePath = path.join(__dirname, 'public', photoToRemove);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        // Kembalikan admin ke halaman edit album tersebut
        res.redirect('/admin/edit/gallery/' + albumId);
    } catch (err) {
        res.status(500).send("Gagal menghapus foto");
    }
});

app.listen(PORT, () => console.log(`Server berjalan di http://localhost:${PORT}`));