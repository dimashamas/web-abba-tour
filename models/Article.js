const mongoose = require('mongoose');
const slugify = require('slugify');

const articleSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    image: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    slug: {type: String }
});

// Hook pre-save untuk generate slug
articleSchema.pre('save', function() {
  if (this.title) {
    this.slug = slugify(this.title, { lower: true, strict: true });
  }
});


module.exports = mongoose.model('Article', articleSchema);