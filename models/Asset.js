const mongoose = require('mongoose');

// Define the blueprint rules for an Asset
const AssetSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true, // The asset MUST have a name
        trim: true
    },
    category: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    quantityAvailable: {
        type: Number,
        required: true,
        min: 0, // Quantity cannot be a negative number!
        default: 1
    },
    status: {
        type: String,
        enum: ['Available', 'Out of Stock', 'Maintenance'], // Only allows these exact choices
        default: 'Available'
    }
}, {
    timestamps: true // This automatically records exactly when an asset was created or updated
});

// Create and export the model so other files can use it
module.exports = mongoose.model('Asset', AssetSchema);