INSERT INTO universities (id,name,website) VALUES
 ('uos','University of Sharjah','https://www.sharjah.ac.ae'),
 ('aus','American University of Sharjah','https://www.aus.edu'),
 ('hct','Higher Colleges of Technology','https://hct.ac.ae'),
 ('cuca','City University Ajman','https://cu.ac.ae')
ON DUPLICATE KEY UPDATE name=VALUES(name),website=VALUES(website);
