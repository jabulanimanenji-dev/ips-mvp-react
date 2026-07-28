import mongoose from 'mongoose';

const ServiceRequestSchema = new mongoose.Schema({
  request_id: { type: String, required: true, unique: true },
  client_id: { type: String, required: true, index: true },
  client_name: { type: String, required: true },
  client_email: { type: String, required: true },
  family: { type: String, enum: ['professional', 'odd_job'], required: true },
  category: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  desired_outcome: { type: String, default: '' },
  delivery_mode: { type: String, enum: ['remote', 'in_person', 'hybrid'], default: 'remote' },
  location: { type: String, default: '' },
  deadline: Date,
  budget_min: { type: Number, default: 0 },
  budget_max: { type: Number, default: 0 },
  urgency: { type: String, enum: ['standard', 'priority', 'urgent'], default: 'standard' },
  status: { type: String, default: 'New Request' },
  quote: {
    labor: { type: Number, default: 0 },
    service_fee: { type: Number, default: 0 },
    expenses: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
    notes: { type: String, default: '' },
    accepted: { type: Boolean, default: false },
    version: { type: Number, default: 0 },
    accepted_by: { type: String, default: '' },
    accepted_at: Date,
    expires_at: Date
  },
  provider_id: { type: String, default: '' },
  provider_name: { type: String, default: '' },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  schedule_at: Date,
  admin_notes: { type: String, default: '' },
  provider_notes: { type: String, default: '' },
  direct_contact_enabled: { type: Boolean, default: false },
  status_history: [{
    status: String,
    actor_id: String,
    actor_role: String,
    reason: String,
    changed_at: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

export default mongoose.model('ServiceRequest', ServiceRequestSchema);
