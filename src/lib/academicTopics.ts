export const academicTopics: {id:string;name:string;aliases:string[];courses:string[]}[] = [
  {
    "id": "cs",
    "name": "Computer Science",
    "aliases": [
      "computer science"
    ],
    "courses": [
      "Programming",
      "Data Structures",
      "Algorithms",
      "Operating Systems",
      "Cloud Computing",
      "Database Systems"
    ]
  },
  {
    "id": "software",
    "name": "Software Engineering",
    "aliases": [
      "software engineering"
    ],
    "courses": [
      "Programming",
      "Software Design",
      "Software Testing",
      "Cloud Computing"
    ]
  },
  {
    "id": "ai",
    "name": "Artificial Intelligence",
    "aliases": [
      "artificial intelligence"
    ],
    "courses": [
      "Programming",
      "Artificial Intelligence",
      "Machine Learning",
      "Statistics"
    ]
  },
  {
    "id": "computer",
    "name": "Computer Engineering",
    "aliases": [
      "computer engineering"
    ],
    "courses": [
      "Programming",
      "Digital Logic Design",
      "Computer Architecture"
    ]
  },
  {
    "id": "electrical",
    "name": "Electrical Engineering",
    "aliases": [
      "electrical engineering",
      "electrical and electronics"
    ],
    "courses": [
      "Circuit Analysis",
      "Electronics",
      "Digital Logic Design"
    ]
  },
  {
    "id": "mechanical",
    "name": "Mechanical Engineering",
    "aliases": [
      "mechanical engineering"
    ],
    "courses": [
      "Thermodynamics",
      "Fluid Mechanics",
      "Engineering Mechanics"
    ]
  },
  {
    "id": "civil",
    "name": "Civil Engineering",
    "aliases": [
      "civil engineering"
    ],
    "courses": [
      "Engineering Mechanics",
      "Structural Analysis"
    ]
  },
  {
    "id": "physio",
    "name": "Physiotherapy",
    "aliases": [
      "physiotherapy",
      "physical therapy"
    ],
    "courses": [
      "Anatomy",
      "Physiology",
      "Rehabilitation"
    ]
  },
  {
    "id": "dentistry",
    "name": "Dentistry",
    "aliases": [
      "dentistry",
      "dental surgery",
      "dental medicine"
    ],
    "courses": [
      "Anatomy",
      "Dental Anatomy",
      "Oral Biology"
    ]
  },
  {
    "id": "nursing",
    "name": "Nursing",
    "aliases": [
      "nursing"
    ],
    "courses": [
      "Anatomy",
      "Physiology",
      "Fundamentals of Nursing"
    ]
  },
  {
    "id": "pharmacy",
    "name": "Pharmacy",
    "aliases": [
      "pharmacy"
    ],
    "courses": [
      "Pharmacology",
      "Chemistry",
      "Introduction to Pharmacy"
    ]
  },
  {
    "id": "biology",
    "name": "Biology",
    "aliases": [
      "biology",
      "biotechnology"
    ],
    "courses": [
      "Biology",
      "Genetics"
    ]
  },
  {
    "id": "chemistry",
    "name": "Chemistry",
    "aliases": [
      "chemistry"
    ],
    "courses": [
      "Chemistry",
      "Organic Chemistry"
    ]
  },
  {
    "id": "math",
    "name": "Mathematics",
    "aliases": [
      "mathematics"
    ],
    "courses": [
      "Calculus",
      "Linear Algebra",
      "Statistics"
    ]
  },
  {
    "id": "physics",
    "name": "Physics",
    "aliases": [
      "physics"
    ],
    "courses": [
      "Physics",
      "Electricity and Magnetism"
    ]
  },
  {
    "id": "accounting",
    "name": "Accounting",
    "aliases": [
      "accounting"
    ],
    "courses": [
      "Financial Accounting",
      "Management Accounting"
    ]
  },
  {
    "id": "finance",
    "name": "Finance",
    "aliases": [
      "finance"
    ],
    "courses": [
      "Finance",
      "Financial Management"
    ]
  },
  {
    "id": "marketing",
    "name": "Marketing",
    "aliases": [
      "marketing"
    ],
    "courses": [
      "Marketing",
      "Consumer Behaviour"
    ]
  },
  {
    "id": "management",
    "name": "Management",
    "aliases": [
      "management"
    ],
    "courses": [
      "Management",
      "Organisational Behaviour"
    ]
  },
  {
    "id": "psychology",
    "name": "Psychology",
    "aliases": [
      "psychology"
    ],
    "courses": [
      "Psychology",
      "Developmental Psychology"
    ]
  },
  {
    "id": "english",
    "name": "English",
    "aliases": [
      "english"
    ],
    "courses": [
      "Academic Writing",
      "Literature"
    ]
  },
  {
    "id": "economics",
    "name": "Economics",
    "aliases": [
      "economics"
    ],
    "courses": [
      "Microeconomics",
      "Macroeconomics"
    ]
  }
];
const courseAliases: Record<string,string[]> = {
  Programming:['introduction to programming','programming fundamentals','computer programming','programming i','programming 1'],
  'Digital Logic Design':['digital logic'],
  Anatomy:['human anatomy','anatomy and physiology','anatomy i'],
  Calculus:['calculus i','calculus 1','calculus ii','calculus 2'],
  Physics:['general physics','physics i','physics 1'],
  Biology:['general biology','biology i','biology 1'],
  Chemistry:['general chemistry','chemistry i','chemistry 1'],
  Finance:['principles of finance','introduction to finance'],
  Marketing:['principles of marketing','introduction to marketing'],
  Management:['principles of management','introduction to management'],
  Psychology:['introduction to psychology'],
  Literature:['introduction to literature']
};
const clean=(name:string)=>name.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function majorTopic(name:string) {
  const value=clean(name);
  return academicTopics.find(topic=>topic.aliases.some(alias=>value.includes(alias)))?.id;
}
export function courseTopic(name:string) {
  const value=clean(name);
  return [...new Set(academicTopics.flatMap(topic=>topic.courses))].find(label=>
    [label,...(courseAliases[label]||[])].some(alias=>clean(alias)===value));
}
type RawCatalog = {
  majors:{id:string;name:string;universityId:string}[];
  courses:{id:string;name:string;universityId:string;majorIds:string[];isShared:boolean}[];
};
export function simpleAcademicOptions(data:RawCatalog,university='',major='') {
  const majorId=major.startsWith('topic:')?major.slice(6):majorTopic(data.majors.find(m=>m.id===major)?.name||'');
  const majors=academicTopics.map(topic=>({id:'topic:'+topic.id,name:topic.name,ids:data.majors.filter(m=>(!university||m.universityId===university)&&majorTopic(m.name)===topic.id).map(m=>m.id)}));
  const labels=majorId?academicTopics.find(t=>t.id===majorId)?.courses||[]:[...new Set(academicTopics.flatMap(t=>t.courses))];
  const courses=labels.map(label=>({id:'topic:'+label,name:label,ids:data.courses.filter(c=>(!university||c.universityId===university)&&courseTopic(c.name)===label&&(major!=='shared'||c.isShared)).map(c=>c.id)}));
  return {majors:majors.sort((a,b)=>a.name.localeCompare(b.name)),courses:courses.sort((a,b)=>a.name.localeCompare(b.name))};
}

