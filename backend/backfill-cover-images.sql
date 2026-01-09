-- Backfill coverImageUrl for playlists from their first scenario
UPDATE playlist p
INNER JOIN (
    SELECT pi.playlistId, sv.coverImageUrl, pi.sortOrder
    FROM playlist_item pi
    INNER JOIN scenario_version sv ON pi.scenarioVersionId = sv.id
    WHERE sv.coverImageUrl IS NOT NULL 
      AND sv.status = 'approved' 
      AND sv.isArchived = 0
    ORDER BY pi.playlistId, pi.sortOrder
) AS first_scenario ON p.id = first_scenario.playlistId
SET p.coverImageUrl = first_scenario.coverImageUrl
WHERE p.coverImageUrl IS NULL
  AND first_scenario.sortOrder = (
    SELECT MIN(pi2.sortOrder)
    FROM playlist_item pi2
    WHERE pi2.playlistId = p.id
  );

-- Backfill coverImageUrl for career paths from their first scenario
UPDATE career_path cp
INNER JOIN (
    SELECT cpi.careerPathId, sv.coverImageUrl, cpi.sortOrder
    FROM career_path_item cpi
    INNER JOIN scenario_version sv ON cpi.scenarioVersionId = sv.id
    WHERE sv.coverImageUrl IS NOT NULL 
      AND sv.status = 'approved' 
      AND sv.isArchived = 0
    ORDER BY cpi.careerPathId, cpi.sortOrder
) AS first_scenario ON cp.id = first_scenario.careerPathId
SET cp.coverImageUrl = first_scenario.coverImageUrl
WHERE cp.coverImageUrl IS NULL
  AND first_scenario.sortOrder = (
    SELECT MIN(cpi2.sortOrder)
    FROM career_path_item cpi2
    WHERE cpi2.careerPathId = cp.id
  );

-- Backfill coverImageUrl for events from their first scenario
UPDATE event e
INNER JOIN (
    SELECT es.eventId, sv.coverImageUrl, es.sortOrder
    FROM event_scenario es
    INNER JOIN scenario_version sv ON es.scenarioVersionId = sv.id
    WHERE sv.coverImageUrl IS NOT NULL 
      AND sv.status = 'approved' 
      AND sv.isArchived = 0
    ORDER BY es.eventId, es.sortOrder
) AS first_scenario ON e.id = first_scenario.eventId
SET e.coverImageUrl = first_scenario.coverImageUrl
WHERE e.coverImageUrl IS NULL
  AND first_scenario.sortOrder = (
    SELECT MIN(es2.sortOrder)
    FROM event_scenario es2
    WHERE es2.eventId = e.id
  );

-- Verify the updates
SELECT 'Playlists with covers' AS type, COUNT(*) AS count FROM playlist WHERE coverImageUrl IS NOT NULL
UNION ALL
SELECT 'Career Paths with covers', COUNT(*) FROM career_path WHERE coverImageUrl IS NOT NULL
UNION ALL
SELECT 'Events with covers', COUNT(*) FROM event WHERE coverImageUrl IS NOT NULL;
