import mongoose from 'mongoose';
// Expenses are embedded so totals and deletion stay within one trip document.
const expenseSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 120 },
  amountMinor: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  category: { type: String, enum: ['Food', 'Stay', 'Transport', 'Activities', 'Shopping', 'Other'], required: true },
  date: { type: String, required: true },
  note: { type: String, default: '', maxlength: 1000 },
}, { timestamps: true });
const tripSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  destination: { type: String, required: true, trim: true, maxlength: 120 },
  startDate: { type: String, required: true },
  endDate: { type: String, required: true },
  currency: { type: String, default: 'INR', enum: ['INR','USD','EUR','GBP','AUD','CAD','SGD','AED','JPY'] },
  budgetMinor: { type: Number, default: null, min: 0 },
  expenses: { type: [expenseSchema], default: [] },
}, { timestamps: true, optimisticConcurrency: true });
export default mongoose.model('Trip', tripSchema);
