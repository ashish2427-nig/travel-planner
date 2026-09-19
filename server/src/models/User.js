import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 120 },
  email: { type: String, sparse: true, unique: true, maxlength: 254 },
  googleId: { type: String, sparse: true, unique: true },
  avatar: { type: String, default: '' },
  passwordHash: { type: String, select: false },
  authProvider: { type: String, enum: ['email', 'google'], default: 'email' },
}, { timestamps: true });

export default mongoose.model('User', userSchema);


