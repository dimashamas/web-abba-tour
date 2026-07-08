const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: String, required: true },
    image: { type: String, required: true },
    type: { type: String, enum: ['Umroh', 'Haji'], default: 'Umroh' }, // Membedakan Umroh dan Haji
    departureDate: { type: Date, required: true }, // Tanggal keberangkatan
    duration: { type: String, required: true },    // Program berapa hari (contoh: "9 Hari")
    isActive: { type: Boolean, default: true }
});

module.exports = mongoose.model('Package', packageSchema);