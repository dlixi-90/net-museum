-- Active PostgreSQL model, 15 read-only statements. Uses the app search_path.
-- 01. Published artifacts: SELECT, WHERE, ORDER BY.
SELECT id,title,material FROM artifacts WHERE status='published' ORDER BY title;
-- 02. LIKE-family search (ILIKE is PostgreSQL's case-insensitive variant).
SELECT id,title FROM artifacts WHERE title ILIKE '%bình%';
-- 03. Multiple JOINs: artist and historical period.
SELECT a.id,a.title,COALESCE(ar.name,'Chưa xác định') AS author,p.name AS period
FROM artifacts a LEFT JOIN artists ar ON ar.id=a.artist_id LEFT JOIN periods p ON p.id=a.period_id;
-- 04. N-N collection membership.
SELECT a.id,a.title,c.name FROM artifacts a JOIN artifact_collections ac ON ac.artifact_id=a.id
JOIN collections c ON c.id=ac.collection_id WHERE c.slug='blue';
-- 05. Keywords, with duplicate artifacts removed.
SELECT DISTINCT a.id,a.title FROM artifacts a JOIN artifact_keywords ak ON ak.artifact_id=a.id
JOIN keywords k ON k.id=ak.keyword_id WHERE k.name ILIKE '%hoa%';
-- 06. Advanced metadata search, distinct resources even when reused.
SELECT DISTINCT r.id,r.title,r.size_bytes FROM resources r
JOIN artifact_resources link ON link.resource_id=r.id JOIN artifacts a ON a.id=link.artifact_id
JOIN topics t ON t.id=a.topic_id
WHERE r.kind='video' AND t.name='Nghệ thuật' AND r.size_bytes<1073741824
AND r.created_at>='2025-01-01T00:00:00+07:00' AND r.created_at<'2027-01-01T00:00:00+07:00';
-- 07. Count and storage by kind.
SELECT kind,COUNT(*) AS total,SUM(size_bytes) AS total_bytes FROM resources GROUP BY kind ORDER BY total DESC;
-- 08. HAVING: collections with at least two artifacts.
SELECT c.name,COUNT(ac.artifact_id) AS total FROM collections c JOIN artifact_collections ac ON ac.collection_id=c.id
GROUP BY c.id,c.name HAVING COUNT(ac.artifact_id)>=2;
-- 09. Top ten videos, including zero views.
SELECT r.id,r.title,COUNT(e.id) AS views FROM resources r LEFT JOIN resource_events e ON e.resource_id=r.id AND e.action='view'
WHERE r.kind='video' GROUP BY r.id,r.title ORDER BY views DESC,r.id LIMIT 10;
-- 10. Most downloaded resources.
SELECT r.id,r.title,COUNT(e.id) AS downloads FROM resources r JOIN resource_events e ON e.resource_id=r.id AND e.action='download'
GROUP BY r.id,r.title ORDER BY downloads DESC,r.id LIMIT 5;
-- 11. Most prolific known artist.
SELECT ar.id,ar.name,COUNT(a.id) AS total FROM artists ar JOIN artifacts a ON a.artist_id=ar.id
GROUP BY ar.id,ar.name ORDER BY total DESC,ar.id LIMIT 1;
-- 12. Resources larger than 500 MiB.
SELECT id,title,kind,size_bytes FROM resources WHERE size_bytes>524288000 ORDER BY size_bytes DESC;
-- 13. Subquery and aggregate: resources larger than the average.
SELECT DISTINCT a.id,a.title FROM artifacts a JOIN artifact_resources link ON link.artifact_id=a.id
JOIN resources r ON r.id=link.resource_id WHERE r.size_bytes>(SELECT AVG(size_bytes) FROM resources);
-- 14. Views per topic. DISTINCT links prevent duplicate counts for resource purposes.
SELECT t.name,COUNT(e.id) AS views FROM topics t LEFT JOIN artifacts a ON a.topic_id=t.id
LEFT JOIN (SELECT DISTINCT artifact_id,resource_id FROM artifact_resources) link ON link.artifact_id=a.id
LEFT JOIN resource_events e ON e.resource_id=link.resource_id AND e.action='view'
GROUP BY t.id,t.name ORDER BY views DESC;
-- 15. CBIR top five, excludes query image and compares matching feature versions.
-- Populate color_vector from real images first; without vectors this returns no rows.
WITH query_image AS (
  SELECT resource_id,color_vector,feature_version FROM images WHERE color_vector IS NOT NULL ORDER BY resource_id LIMIT 1
), similarities AS (
  SELECT i.resource_id,SUM(v.x*q.color_vector[v.n::integer])/
    NULLIF(SQRT(SUM(v.x*v.x))*SQRT(SUM(q.color_vector[v.n::integer]*q.color_vector[v.n::integer])),0) AS similarity
  FROM images i CROSS JOIN query_image q CROSS JOIN LATERAL unnest(i.color_vector) WITH ORDINALITY AS v(x,n)
  WHERE i.resource_id<>q.resource_id AND i.color_vector IS NOT NULL AND i.feature_version=q.feature_version
  GROUP BY i.resource_id
)
SELECT r.id,r.title,s.similarity FROM similarities s JOIN resources r ON r.id=s.resource_id
WHERE s.similarity IS NOT NULL ORDER BY s.similarity DESC,r.id LIMIT 5;
