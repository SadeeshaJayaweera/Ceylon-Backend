const mongoose = require('mongoose');
const AutoIncrement = require('mongoose-sequence')(mongoose);


const postSchema = new mongoose.Schema({
    customId: { type: Number, unique: true }, 
    adTitle: String,
    adDescription: String,
    adpropertyType: String,
    rentType: String,
    district: String,
    area: Number,
    rooms: Number,
    bathrooms: Number,
    price: Number,
    telephone: String,
    email: String,
    uploaderName:String,
    pending: { type: Boolean },
    imagePaths: [String],
    createdAt: { type: Date, default: Date.now }
});

postSchema.plugin(AutoIncrement, { inc_field: 'customId', start_seq: 1000, inc: 4 });
const Post = mongoose.model('Post', postSchema);

module.exports = Post;
