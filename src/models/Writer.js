import mongoose from 'mongoose';

const WriterSchema = new mongoose.Schema({
  writer_id: { type: String, required: true, unique: true },
  full_name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  primary_expertise: { type: String, default: '' },
  secondary_expertise: { type: String, default: '' },
  academic_level: { type: String, default: 'Master' },
  rate_per_page_usd: { type: Number, default: 10 },
  rating: { type: Number, default: 5.0 },
  projects_completed: { type: Number, default: 0 },
  availability: { type: String, default: 'Available' },
  status: { type: String, default: 'Active' }
}, { timestamps: true });

export default mongoose.model('Writer', WriterSchema);