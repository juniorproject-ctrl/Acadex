import type {PoolConnection} from 'mysql2/promise';

export type PublishedMajor={id:string;name:string;sourceUrl:string;courses:{code:string;name:string;isShared:boolean;sourceUrl?:string}[]};
export type PublishedUniversity={id:string;name:string;website:string;majors:PublishedMajor[]};

export async function importPublishedUniversity(connection:PoolConnection,institution:PublishedUniversity) {
  await connection.execute('INSERT INTO universities (id,name,website) VALUES (?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),website=VALUES(website)',[institution.id,institution.name,institution.website]);
  for(const major of institution.majors){
    await connection.execute('INSERT INTO majors (id,university_id,name,source_url) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),source_url=VALUES(source_url)',[major.id,institution.id,major.name,major.sourceUrl]);
    for(const course of major.courses){
      const code=course.code.replace(/\s+/g,'').toUpperCase();
      const proposedId=institution.id+'-'+code;
      await connection.execute('INSERT INTO courses (id,university_id,code,name,is_shared,source_url) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),source_url=VALUES(source_url),is_shared=GREATEST(is_shared,VALUES(is_shared))',[proposedId,institution.id,code,course.name,course.isShared,course.sourceUrl||major.sourceUrl]);
      // A manually added course may already own this code under a different ID.
      const [existing]=await connection.query<any[]>('SELECT id FROM courses WHERE university_id=? AND code=?',[institution.id,code]);
      await connection.execute('INSERT IGNORE INTO course_majors (course_id,major_id) VALUES (?,?)',[existing[0].id,major.id]);
    }
  }
}
