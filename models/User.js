const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true, // This stops two people from registering with the same email!
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['Consumer', 'Admin'], // Only allows these two options
        default: 'Consumer' // If not specified, they are a regular user
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('User', UserSchema);