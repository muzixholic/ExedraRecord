-- 반복 공격의 1회 조건을 수치로 명시
UPDATE memories SET payload = replace(payload, '매회 무작위', '1회마다 무작위') WHERE id = 'sayaka-venusta-dissonanza';
