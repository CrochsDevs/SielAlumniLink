// A local, cross-discipline catalog: typing never sends an API request.
// Users can also add a skill that is not in this catalog.
const categories = {
  'Technology': [
    'React JS', 'React Native', 'JavaScript', 'TypeScript', 'HTML', 'CSS', 'Node.js', 'Express JS',
    'Python', 'Java', 'C#', 'C++', 'PHP', 'SQL', 'MongoDB', 'PostgreSQL', 'MySQL',
    'Vue.js', 'Angular', 'Next.js', 'Laravel', 'Django', 'Flutter', 'Swift', 'Kotlin',
    'Web Development', 'Mobile App Development', 'Software Testing', 'Quality Assurance',
    'Git', 'GitHub', 'Docker', 'Cloud Computing', 'AWS', 'Azure', 'Cybersecurity',
    'Network Administration', 'Technical Support', 'Data Analysis', 'Data Science',
    'Machine Learning', 'Artificial Intelligence', 'Power BI', 'Tableau', 'UI Design', 'UX Research',
    'REST API', 'RESTful API Development', 'GraphQL', 'SOAP API', 'gRPC',
    'WebSocket', 'Webhooks', 'API Development', 'API Integration', 'API Testing',
    'API Documentation', 'API Security', 'API Design', 'API Management',
    'OpenAPI', 'Swagger', 'Postman', 'OAuth 2.0', 'JWT Authentication',
  ],
  'Agriculture & Environment': [
    'Crop Production', 'Crop Management', 'Organic Farming', 'Sustainable Agriculture',
    'Precision Agriculture', 'Agricultural Extension', 'Agribusiness', 'Farm Management',
    'Soil Science', 'Soil Testing', 'Irrigation Management', 'Pest Management',
    'Plant Breeding', 'Plant Propagation', 'Horticulture', 'Seed Technology',
    'Animal Husbandry', 'Livestock Management', 'Poultry Production', 'Dairy Production',
    'Aquaculture', 'Fisheries Management', 'Food Processing', 'Food Safety',
    'Environmental Management', 'Waste Management', 'Forestry', 'GIS', 'Climate Research',
  ],
  'Business & Finance': [
    'Accounting', 'Bookkeeping', 'Financial Analysis', 'Financial Reporting', 'Budgeting',
    'Tax Preparation', 'Auditing', 'Payroll Management', 'Cost Accounting', 'QuickBooks',
    'Business Planning', 'Business Development', 'Entrepreneurship', 'Operations Management',
    'Project Management', 'Product Management', 'Supply Chain Management',
    'Inventory Management', 'Procurement', 'Logistics', 'Risk Management',
    'Human Resources', 'Recruitment', 'Employee Relations', 'Training and Development',
    'Strategic Planning', 'Sales', 'Customer Service', 'Customer Relationship Management',
    'Negotiation', 'Market Research', 'Digital Marketing', 'Social Media Marketing',
    'Content Marketing', 'SEO', 'Email Marketing', 'Brand Management', 'E-commerce',
    'Microsoft Excel', 'Microsoft Word', 'Microsoft PowerPoint', 'Google Workspace',
  ],
  'Education & Research': [
    'Teaching', 'Lesson Planning', 'Curriculum Development', 'Classroom Management',
    'Student Assessment', 'Special Education', 'Early Childhood Education',
    'Educational Technology', 'Online Teaching', 'Tutoring', 'Academic Advising',
    'Instructional Design', 'Learning Management Systems', 'Research', 'Research Design',
    'Qualitative Research', 'Quantitative Research', 'Statistical Analysis',
    'Academic Writing', 'Technical Writing', 'Laboratory Techniques', 'SPSS', 'R Programming',
  ],
  'Healthcare & Community': [
    'Patient Care', 'Nursing', 'First Aid', 'Basic Life Support', 'CPR',
    'Health Education', 'Public Health', 'Community Health', 'Nutrition',
    'Dietetics', 'Medical Laboratory Testing', 'Phlebotomy', 'Infection Control',
    'Medical Records Management', 'Caregiving', 'Mental Health Support',
    'Counseling', 'Psychological Assessment', 'Social Work', 'Case Management',
    'Community Development', 'Community Organizing', 'Disaster Preparedness',
  ],
  'Engineering & Skilled Trades': [
    'AutoCAD', 'SolidWorks', 'Revit', 'CAD Drafting', 'Civil Engineering',
    'Structural Design', 'Construction Management', 'Construction Estimating',
    'Land Surveying', 'Electrical Installation', 'Electrical Troubleshooting',
    'Electronics Repair', 'Mechanical Design', 'Machine Maintenance',
    'Welding', 'Carpentry', 'Plumbing', 'HVAC', 'CNC Machining',
    'Manufacturing', 'Quality Control', 'Occupational Safety', 'Lean Manufacturing',
    'Six Sigma', 'Process Improvement', 'Renewable Energy', 'Robotics',
  ],
  'Creative Arts & Communication': [
    'Graphic Design', 'Adobe Photoshop', 'Adobe Illustrator', 'Adobe InDesign',
    'Canva', 'Figma', 'Photography', 'Videography', 'Video Editing', 'Animation',
    'Illustration', '3D Modeling', 'Blender', 'Creative Writing', 'Copywriting',
    'Journalism', 'Public Relations', 'Public Speaking', 'Translation',
    'Filipino Language', 'English Language', 'Event Planning', 'Music Production',
  ],
  'Hospitality & Services': [
    'Hospitality Management', 'Hotel Operations', 'Front Office Operations',
    'Housekeeping', 'Tourism Management', 'Tour Guiding', 'Travel Planning',
    'Food and Beverage Service', 'Culinary Arts', 'Cooking', 'Baking',
    'Pastry Making', 'Menu Planning', 'Catering', 'Barista Skills',
    'Retail Management', 'Merchandising', 'Office Administration', 'Data Entry',
    'Records Management', 'Virtual Assistance',
  ],
  'Professional Skills': [
    'Communication', 'Teamwork', 'Leadership', 'Problem Solving', 'Critical Thinking',
    'Time Management', 'Adaptability', 'Decision Making', 'Conflict Resolution',
    'Collaboration', 'Attention to Detail', 'Creativity', 'Presentation Skills',
    'Mentoring', 'Coaching', 'Organization', 'Interpersonal Skills',
  ],
};

const aliases = {
  'React JS': 'reactjs react.js',
  'Node.js': 'nodejs node js',
  'Express JS': 'express express.js expressjs',
  'REST API': 'restful representational state transfer',
  'GraphQL': 'graphql api graph query language',
  'gRPC': 'grpc api remote procedure call',
  'WebSocket': 'websocket api real time realtime',
  'Webhooks': 'webhook api callback',
  'OpenAPI': 'open api documentation specification',
  'Swagger': 'swagger api documentation',
  'Postman': 'postman api testing',
  'OAuth 2.0': 'oauth api authorization authentication',
  'JWT Authentication': 'jwt api security json web token',
  'Vue.js': 'vuejs vue js',
  'Next.js': 'nextjs next js',
  'Microsoft Excel': 'ms excel spreadsheet spreadsheets',
  'Microsoft Word': 'ms word',
  'Microsoft PowerPoint': 'ms powerpoint',
  'SEO': 'search engine optimization',
  'GIS': 'geographic information systems mapping',
  'CPR': 'cardiopulmonary resuscitation',
  'HVAC': 'heating ventilation air conditioning',
};

export const normalizeSkill = (value) => value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
const catalog = Object.entries(categories).flatMap(([category, skills]) =>
  skills.map((label) => ({ label, category, search: normalizeSkill(`${label} ${aliases[label] || ''}`) }))
);

export function suggestSkills(query, selected = []) {
  const term = normalizeSkill(query);
  if (!term) return [];
  const existing = new Set(selected.map(normalizeSkill));
  const words = term.split(' ');
  return catalog
    .filter((skill) => !existing.has(normalizeSkill(skill.label)) && words.every((word) => skill.search.includes(word)))
    .sort((a, b) => Number(normalizeSkill(b.label).startsWith(term)) - Number(normalizeSkill(a.label).startsWith(term)) || a.label.localeCompare(b.label))
    .slice(0, 25);
}
