-- Set all Favorites playlists to private
UPDATE playlist SET isPublic = 0 WHERE LOWER(title) = 'favorites';

-- Verify the update
SELECT id, title, isPublic, ownerUserId FROM playlist WHERE LOWER(title) = 'favorites';
