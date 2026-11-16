// Narrow student-support catalogue. These are coaching/editing services, not substitute submissions.
export const STUDENT_OFFERS = Object.freeze([
  {
    id: 'assignment-support',
    title: 'Assignments & Coursework Support',
    summary: 'Understand the brief, structure your approach, strengthen your own draft and improve citations.',
    deliverables: ['Assignment planning session', 'Draft feedback and editing', 'Referencing and structure review'],
    questions: 'Share the assignment brief, subject, marking criteria and the particular help you need.'
  },
  {
    id: 'thesis-support',
    title: 'Thesis & Dissertation Support',
    summary: 'Research planning, chapter feedback, literature-search guidance, methodology coaching and formatting.',
    deliverables: ['Research plan and milestone guidance', 'Chapter-level editorial feedback', 'Formatting and reference checks'],
    questions: 'Share your degree level, topic, supervisor guidance, current stage and support requirements.'
  },
  {
    id: 'research-project-support',
    title: 'Research Projects & Data Support',
    summary: 'Project planning, research methods, data cleaning, analysis coaching and presentation support.',
    deliverables: ['Research-method consultation', 'Data analysis guidance', 'Project report and presentation feedback'],
    questions: 'Share your project question, dataset status, research methods and learning goals.'
  }
]);
export const getStudentOffer = id => STUDENT_OFFERS.find(item => item.id === id) || null;
export const isStudentSupportRequest = request => request?.category === 'Academic Support' && request?.family === 'professional';
