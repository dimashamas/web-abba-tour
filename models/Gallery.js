const mongoose = require('mongoose');

const gallerySchema = new mongoose.Schema({
    // Nama atau Judul Keberangkatan (Contoh: "Observasi Gerhana Matahari Total - Arab Saudi 2027")
    albumName: { type: String, required: true }, 
    
    // Gambar utama yang akan tampil sebagai perwakilan di dashboard depan
    coverImage: { type: String, required: true }, 
    
    // Array (kumpulan) path gambar-gambar yang ada di dalam album tersebut
    photos: [{ type: String }], 
    
    // Tanggal album dibuat agar bisa diurutkan dari yang terbaru
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Gallery', gallerySchema);