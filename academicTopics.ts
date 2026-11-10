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
const clean=(name:string)=>name.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function majorTopic(name:string) {
  const value=clean(name);
  return academicTopics.find(topic=>topic.aliases.some(alias=>value.includes(alias)))?.id;
}
export function courseTopic(name:string) {
  const value=clean(name);
  return [...new Set(academicTopics.flatMap(topic=>topic.courses))].find(label=>
    [label,...(courseAliases[label]||[])].some(alias=>clean(alias)===value));
}
export function simpleMajorName(name:string) {
  const label=name.normalize('NFC').replace(/\s+/g,' ').trim()
    .replace(/^Bachelor of (?:Science|Arts) in Business Administration\s*(?:Major in|[-\u2013])\s*/i,'')
    .replace(/^Bachelor of (?:Science|Arts)(?: in)?\s+/i,'')
    .replace(/^(?:Bachelor of|Associate Degree in|Doctor of)\s+/i,'')
    .replace(/^بكالوريوس (?:الآداب في|التربية في|في)\s+/u,'')
    .replace(/\s*\((?:[A-Z]{2,10}|BPharm|BArch|BSc|BEng|BBA|BID)\)/g,'').replace(/;.*$/,'').trim();
  const aliases:Record<string,string>={'dental surgery':'Dentistry','dental medicine':'Dentistry','medicine and bachelor of surgery':'Medicine and Surgery'};
  return aliases[clean(label)]||label;
}
function majorKey(name:string) {
  const label=simpleMajorName(name);
  const topic=academicTopics.find(t=>[t.name,...t.aliases].some(alias=>clean(alias)===clean(label)));
  return topic?'topic:'+topic.id:'major:'+clean(label);
}
type RawCatalog = {
  majors:{id:string;name:string;universityId:string;sourceUrl?:string}[];
  courses:{id:string;name:string;universityId:string;majorIds:string[];isShared:boolean;sourceUrl?:string}[];
};
type AcademicOption={id:string;name:string;ids:string[]};
export function simpleAcademicOptions(data:RawCatalog,university='',major='') {
  const scoped=data.majors.filter(m=>!university||m.universityId===university);
  const officialUniversities=new Set(scoped.filter(m=>m.sourceUrl).map(m=>m.universityId));
  const majorGroups=new Map<string,AcademicOption>();
  // Old starter records remain in the database, but cannot advertise nonexistent degrees.
  for(const m of scoped.filter(m=>!officialUniversities.has(m.universityId)||m.sourceUrl)){
    const id=majorKey(m.name),entry=majorGroups.get(id)||{id,name:simpleMajorName(m.name),ids:[]};
    majorGroups.set(id,entry);
  }
  for(const m of scoped)majorGroups.get(majorKey(m.name))?.ids.push(m.id);
  const chosen=majorGroups.get(major)||[...majorGroups.values()].find(m=>m.ids.includes(major));
  const allowedMajors=new Set(chosen?.ids||[]);
  const eligible=data.courses.filter(c=>(!university||c.universityId===university)&&
    (major==='shared'?c.isShared:!major||!!chosen&&c.majorIds.some(id=>allowedMajors.has(id))));
  const courseGroups=new Map<string,AcademicOption>();
  const courseName=(name:string)=>courseTopic(name)||name.replace(/\s+/g,' ').trim();
  for(const c of eligible.filter(c=>!officialUniversities.has(c.universityId)||c.sourceUrl)){
    const name=courseName(c.name),key=clean(name),id=courseTopic(c.name)?'topic:'+name:'course:'+key;
    if(!courseGroups.has(key))courseGroups.set(key,{id,name,ids:[]});
  }
  // Prefer a published course ID when a form needs one; include legacy IDs for searching old content.
  for(const c of [...eligible].sort((a,b)=>Number(!!b.sourceUrl)-Number(!!a.sourceUrl))){
    const entry=courseGroups.get(clean(courseName(c.name)));
    entry?.ids.push(c.id);
  }
  return {majors:[...majorGroups.values()].sort((a,b)=>a.name.localeCompare(b.name)),courses:[...courseGroups.values()].sort((a,b)=>a.name.localeCompare(b.name))};
}

