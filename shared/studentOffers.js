// Student-facing products share the existing governed ServiceRequest and quote workflow.
// Fulfillment is limited to legitimate academic support and independently commissioned work.
export const STUDENT_DEPARTMENTS = Object.freeze([
  {id:'all',label:'All services'},
  {id:'coursework',label:'Assignments & coursework'},
  {id:'research',label:'Theses & research'},
  {id:'methods',label:'Methods & data'},
  {id:'editorial',label:'Editing & references'},
  {id:'presentation',label:'Presentations & projects'}
]);

export const STUDENT_OFFERS = Object.freeze([
  {
    id:'assignment-support', department:'coursework', icon:'book', title:'Assignments & Coursework',
    short:'Get clear on your brief, your argument and your next steps.',
    summary:'Understand the brief, structure your approach, strengthen your own draft and improve citations.',
    deliverables:['Assignment brief and marking-rubric review','Planning and tutoring sessions','Feedback on your own draft'],
    questions:'Share your brief, assessment criteria, subject, stage and the support you need.'
  },
  {
    id:'thesis-support', department:'research', icon:'graduation', title:'Thesis & Dissertation Guidance',
    short:'From research questions to a confident final review.',
    summary:'Research planning, chapter feedback, literature-search guidance, methodology coaching and formatting.',
    deliverables:['Research roadmap and chapter planning','Literature-search and methodology guidance','Editorial feedback on student-authored chapters'],
    questions:'Share your degree level, topic, supervisor guidance, current chapter and next milestone.'
  },
  {
    id:'research-project-support', department:'presentation', icon:'layers', title:'Research & Capstone Projects',
    short:'A more organized route through complex projects.',
    summary:'Project planning, research methods, data cleaning, analysis coaching and presentation support.',
    deliverables:['Project scope and planning review','Technical or research-method consultation','Report structure and presentation feedback'],
    questions:'Share the project brief, specifications, tools, current progress and where you need help.'
  },
  {
    id:'research-proposals', department:'research', icon:'compass', title:'Research Proposals',
    short:'Clarify your problem, approach and proposal structure.',
    summary:'Proposal planning, research-question refinement, scope, feasibility and methods coaching.',
    deliverables:['Proposal structure checklist','Research-question and scope feedback','Feasibility and methods consultation'],
    questions:'Share your topic, proposal criteria, supervisor comments and research aim.'
  },
  {
    id:'literature-reviews', department:'research', icon:'library', title:'Literature Review Coaching',
    short:'Find, organize and critically assess better sources.',
    summary:'Search strategy design, source screening, thematic organization and literature-review feedback.',
    deliverables:['Search terms and database strategy','Source-screening and synthesis guidance','Feedback on your own review'],
    questions:'Share your research question, discipline, available literature and draft if any.'
  },
  {
    id:'research-methods', department:'methods', icon:'flask', title:'Research Methods Consultation',
    short:'Choose and explain a defensible research approach.',
    summary:'Qualitative, quantitative and mixed-method research design, sampling and methods guidance.',
    deliverables:['Research design consultation','Sampling and instrument guidance','Methodology section feedback'],
    questions:'Share your study aim, proposed design, participants or data and institutional requirements.'
  },
  {
    id:'statistics-support', department:'methods', icon:'chart', title:'Statistics & SPSS / R / Python',
    short:'Understand your data and what your results mean.',
    summary:'Statistics tutoring, analysis planning, interpreting outputs and reproducible analysis coaching.',
    deliverables:['Statistical approach consultation','Walkthrough of analysis outputs','Interpretation and visualization coaching'],
    questions:'Share your research questions, variables, permitted dataset and software preferences.'
  },
  {
    id:'data-preparation', department:'methods', icon:'table', title:'Data Cleaning & Visualization',
    short:'Prepare clearer, usable data and well-explained charts.',
    summary:'Legitimate data preparation, spreadsheet organization and custom analytical graphics.',
    deliverables:['Dataset quality assessment','Agreed cleanup and transformation','Explained charts and analysis notes'],
    questions:'Describe your dataset, permissions, outputs and desired visualizations.'
  },
  {
    id:'qualitative-analysis', department:'methods', icon:'message', title:'Qualitative Research Support',
    short:'Organize themes, codes and the reasoning behind them.',
    summary:'Interview coding methodology, thematic analysis guidance and qualitative interpretation.',
    deliverables:['Coding approach guidance','Theme development consultation','Analysis feedback and documentation'],
    questions:'Share the research question, consented data type, methodology and current coding stage.'
  },
  {
    id:'proofreading-editing', department:'editorial', icon:'pen', title:'Proofreading & Academic Editing',
    short:'Make your own writing clearer and more consistent.',
    summary:'Language, clarity, cohesion and academic style editing for student-authored material.',
    deliverables:['Tracked editorial changes','Language and consistency checks','Editing notes and revision guidance'],
    questions:'Share the document type, length, editing level, style guide and delivery deadline.'
  },
  {
    id:'citation-referencing', department:'editorial', icon:'quote', title:'Referencing & Formatting',
    short:'Present your sources and documents consistently.',
    summary:'APA, Harvard, Vancouver and institutional style checks, citations and document formatting.',
    deliverables:['Citation and bibliography consistency check','Style-guide formatting','List of missing or unverifiable citation details'],
    questions:'Share the required style, institution formatting rules and your own draft and reference list.'
  },
  {
    id:'academic-presentations', department:'presentation', icon:'screen', title:'Academic Presentations & Posters',
    short:'Make research easier to understand and communicate.',
    summary:'Slide, poster and visual presentation design from materials the student is authorized to use.',
    deliverables:['Presentation structure and slide design','Visual hierarchy and accessibility','Speaker notes coaching or design revisions'],
    questions:'Share your audience, content, slide/poster size, format and presentation date.'
  },
  {
    id:'defense-preparation', department:'presentation', icon:'mic', title:'Viva & Defense Preparation',
    short:'Practice explaining and defending your own research.',
    summary:'Mock questions, confidence coaching, presentation planning and academic defense rehearsal.',
    deliverables:['Defense practice framework','Likely question themes','Presentation and explanation feedback'],
    questions:'Share your project summary, defense format, timing and difficult areas.'
  },
  {
    id:'academic-coaching', department:'coursework', icon:'calendar', title:'Study Planning & Mentoring',
    short:'A manageable plan for demanding academic workloads.',
    summary:'Study schedules, milestones, accountability structure and time-management coaching.',
    deliverables:['Study and milestone plan','Check-in or revision framework','Prioritization and progress guidance'],
    questions:'Share your courses, academic goals, available time and upcoming deadlines.'
  },
  {
    id:'technical-projects', department:'presentation', icon:'code', title:'Computing & Technical Project Support',
    short:'Work through technical decisions with practical guidance.',
    summary:'Software project mentoring, debugging walkthroughs, technical documentation review and demonstration coaching.',
    deliverables:['Architecture and approach consultation','Debugging or testing walkthrough','Technical report and demo feedback'],
    questions:'Share the assignment boundaries, current code/project and the engineering concepts involved.'
  },
  {
    id:'academic-translation', department:'editorial', icon:'globe', title:'Academic Language & Translation',
    short:'Express your ideas accurately across languages.',
    summary:'Translation, language polishing and terminology checks for permissible academic materials.',
    deliverables:['Scoped translation or language review','Terminology consistency','Document formatting as agreed'],
    questions:'Share the source language, target language, document length and allowed use.'
  }
]);

export const getStudentOffer = id => STUDENT_OFFERS.find(item => item.id === id) || null;
export const isStudentSupportRequest = request => request?.category === 'Academic Support' && request?.family === 'professional';
