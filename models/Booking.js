const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true }, // This acts as the "Due Date"
    actualReturnDate: { type: Date }, // Track when they actually brought it back
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'Returned', 'Overdue'],
        default: 'Pending'
    }
}, { timestamps: true });

module.exports = mongoose.model('Booking', BookingSchema);