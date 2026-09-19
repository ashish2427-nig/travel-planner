import mongoose from 'mongoose';
// Separate collection: each place can be updated independently without growing
// the Trip document. Trip deletion explicitly removes its referenced places.
const placeSchema = new mongoose.Schema({
  trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  note: { type: String, default: '', maxlength: 1000 },
  done: { type: Boolean, default: false },
}, { timestamps: true });
export default mongoose.model('Place', placeSchema);
