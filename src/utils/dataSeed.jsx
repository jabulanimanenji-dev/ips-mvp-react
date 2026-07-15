import { DEMO_CLIENT } from './constants';

export function seedDemoData() {
  if (!localStorage.getItem('ips-clients')) {
    localStorage.setItem('ips-clients', JSON.stringify([
      { ...DEMO_CLIENT, total_orders: 3, total_spent: 1250, status: 'Active', notes: 'VIP client. Always pays on time.' },
      { client_id: 'CID-002', full_name: 'James Mitchell', email: 'james@example.com', phone: '+44 7700 900123', country: 'United Kingdom', registration_date: '2026-02-03', total_orders: 1, total_spent: 400, status: 'Active', notes: '' },
      { client_id: 'CID-003', full_name: 'Priya Sharma', email: 'priya@example.com', phone: '+91 98765 43210', country: 'India', registration_date: '2026-02-20', total_orders: 2, total_spent: 780, status: 'Active', notes: 'PhD student. High-value orders.' },
      { client_id: 'CID-004', full_name: 'Liam Chen', email: 'liam@example.com', phone: '+1 416 555 0199', country: 'Canada', registration_date: '2026-03-05', total_orders: 0, total_spent: 0, status: 'Active', notes: '' },
      { client_id: 'CID-005', full_name: 'Zara Mensah', email: 'zara@example.com', phone: '+233 24 123 4567', country: 'Ghana', registration_date: '2026-03-12', total_orders: 1, total_spent: 200, status: 'Suspended', notes: 'Dispute pending. Do not accept new orders.' },
    ]));
  }

  if (!localStorage.getItem('ips-orders')) {
    localStorage.setItem('ips-orders', JSON.stringify([
      {
        order_id: 1001, client_id: 'CID-001', client_name: 'Amara Okafor', service_type: 'Thesis', academic_level: 'Master',
        subject: 'Business Administration', topic_title: 'Impact of Fintech on SME Growth in West Africa',
        word_count: 15000, deadline: '2026-05-20', total_fee_usd: 375, status: 'In Progress',
        writer_id: 'W001', writer_name: 'Dr. Sarah Williams', created_date: '2026-03-01',
        milestones: [
          { stage: 1, name: 'Proposal / Outline', status: 'completed', paid: true, due_date: '2026-03-15' },
          { stage: 2, name: 'Literature Review', status: 'completed', paid: true, due_date: '2026-04-01' },
          { stage: 3, name: 'Methodology', status: 'active', paid: false, due_date: '2026-04-20' },
          { stage: 4, name: 'Data Analysis', status: 'pending', paid: false, due_date: '2026-05-05' },
          { stage: 5, name: 'Final Draft & Editing', status: 'pending', paid: false, due_date: '2026-05-18' },
        ]
      },
      {
        order_id: 1002, client_id: 'CID-002', client_name: 'James Mitchell', service_type: 'Assignment', academic_level: 'Bachelor',
        subject: 'Marketing', topic_title: 'Digital Marketing Strategy Case Study',
        word_count: 3000, deadline: '2026-04-10', total_fee_usd: 36, status: 'Under Review',
        writer_id: 'W003', writer_name: 'Maria González', created_date: '2026-03-20',
        milestones: [
          { stage: 1, name: 'Draft', status: 'completed', paid: true, due_date: '2026-04-01' },
          { stage: 2, name: 'Final', status: 'active', paid: false, due_date: '2026-04-08' },
        ]
      },
      {
        order_id: 1003, client_id: 'CID-001', client_name: 'Amara Okafor', service_type: 'Project Report', academic_level: 'N/A',
        subject: 'Data Science', topic_title: 'Predictive Analytics for Retail Inventory',
        word_count: 8000, deadline: '2026-04-25', total_fee_usd: 200, status: 'New',
        writer_id: null, writer_name: null, created_date: '2026-03-22',
        milestones: [
          { stage: 1, name: 'Outline', status: 'pending', paid: false, due_date: '2026-04-01' },
          { stage: 2, name: 'Draft', status: 'pending', paid: false, due_date: '2026-04-15' },
          { stage: 3, name: 'Final', status: 'pending', paid: false, due_date: '2026-04-23' },
        ]
      },
      {
        order_id: 1004, client_id: 'CID-003', client_name: 'Priya Sharma', service_type: 'Thesis', academic_level: 'PhD',
        subject: 'Biotechnology', topic_title: 'CRISPR Applications in Crop Resistance',
        word_count: 45000, deadline: '2026-08-15', total_fee_usd: 1800, status: 'In Progress',
        writer_id: 'W002', writer_name: 'Prof. Kenji Tanaka', created_date: '2026-03-10',
        milestones: [
          { stage: 1, name: 'Proposal', status: 'completed', paid: true, due_date: '2026-04-01' },
          { stage: 2, name: 'Chapters 1-3', status: 'active', paid: false, due_date: '2026-05-15' },
          { stage: 3, name: 'Chapters 4-5', status: 'pending', paid: false, due_date: '2026-06-20' },
          { stage: 4, name: 'Data Analysis', status: 'pending', paid: false, due_date: '2026-07-20' },
          { stage: 5, name: 'Final Review & Defense Prep', status: 'pending', paid: false, due_date: '2026-08-10' },
        ]
      },
      {
        order_id: 1005, client_id: 'CID-003', client_name: 'Priya Sharma', service_type: 'Odd Job', academic_level: 'N/A',
        subject: 'Administration', topic_title: 'University Accommodation Search - London',
        word_count: 0, deadline: '2026-04-05', total_fee_usd: 100, status: 'Completed',
        writer_id: 'W004', writer_name: 'Adebayo Fashola', created_date: '2026-02-25',
        milestones: [
          { stage: 1, name: 'Search & Shortlist', status: 'completed', paid: true, due_date: '2026-03-15' },
          { stage: 2, name: 'Completion', status: 'completed', paid: true, due_date: '2026-04-01' },
        ]
      },
      {
        order_id: 1006, client_id: 'CID-005', client_name: 'Zara Mensah', service_type: 'Assignment', academic_level: 'Bachelor',
        subject: 'Economics', topic_title: 'Macroeconomic Policy Analysis',
        word_count: 2500, deadline: '2026-03-30', total_fee_usd: 30, status: 'Disputed',
        writer_id: 'W005', writer_name: 'Emily Rostova', created_date: '2026-03-15',
        milestones: [
          { stage: 1, name: 'Draft', status: 'completed', paid: true, due_date: '2026-03-25' },
          { stage: 2, name: 'Final', status: 'active', paid: false, due_date: '2026-03-29' },
        ]
      },
    ]));
  }

  if (!localStorage.getItem('ips-admin-writers')) {
    localStorage.setItem('ips-admin-writers', JSON.stringify([
      { writer_id: 'W001', full_name: 'Dr. Sarah Williams', email: 'sarah.w@ips.internal', country: 'United Kingdom', primary_expertise: 'Business & Finance', secondary_expertise: 'Economics', academic_level: 'PhD', rating: 4.8, projects_completed: 47, projects_active: 3, availability: 'Available', rate_per_page_usd: 18, status: 'Active', nda_signed: 'Y', nda_date: '2025-01-10' },
      { writer_id: 'W002', full_name: 'Prof. Kenji Tanaka', email: 'kenji.t@ips.internal', country: 'Japan', primary_expertise: 'Computer Science', secondary_expertise: 'Data Science', academic_level: 'PhD', rating: 4.9, projects_completed: 62, projects_active: 2, availability: 'Limited', rate_per_page_usd: 22, status: 'Active', nda_signed: 'Y', nda_date: '2025-02-15' },
      { writer_id: 'W003', full_name: 'Maria González', email: 'maria.g@ips.internal', country: 'Spain', primary_expertise: 'Literature & Humanities', secondary_expertise: 'History', academic_level: 'Master', rating: 4.6, projects_completed: 31, projects_active: 4, availability: 'Busy', rate_per_page_usd: 14, status: 'Active', nda_signed: 'Y', nda_date: '2025-03-01' },
      { writer_id: 'W004', full_name: 'Adebayo Fashola', email: 'ade.f@ips.internal', country: 'Nigeria', primary_expertise: 'Law & Policy', secondary_expertise: 'Political Science', academic_level: 'PhD', rating: 4.7, projects_completed: 28, projects_active: 1, availability: 'Available', rate_per_page_usd: 20, status: 'Active', nda_signed: 'Y', nda_date: '2025-01-20' },
      { writer_id: 'W005', full_name: 'Emily Rostova', email: 'emily.r@ips.internal', country: 'Poland', primary_expertise: 'Psychology', secondary_expertise: 'Sociology', academic_level: 'Master', rating: 4.5, projects_completed: 19, projects_active: 0, availability: 'On Leave', rate_per_page_usd: 12, status: 'On Leave', nda_signed: 'N', nda_date: null },
    ]));
  }
}
