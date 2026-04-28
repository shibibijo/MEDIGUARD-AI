const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
    filename: { type: String, required: true },
    extractedText: { type: String, required: true },
    fraud: { type: Number, required: true },
    probability: { type: Number, required: true },
    decision: { type: String, required: true },
    rejectionReason: { type: String, default: "" },
    // NLP Fields
    patientName: { type: String, default: "" },
    doctorName: { type: String, default: "" },
    dateOfTreatment: { type: String, default: "" },
    diagnosisKeywords: [{ type: String }],
    timestamp: { type: Date, default: Date.now }
});

const Claim = mongoose.model('Claim', claimSchema);
module.exports = Claim;
