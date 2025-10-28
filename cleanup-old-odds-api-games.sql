DELETE FROM factors
WHERE run_id IN (SELECT run_id FROM runs WHERE game_id::text NOT LIKE 'msf_%');

DELETE FROM runs 
WHERE game_id::text NOT LIKE 'msf_%';

DELETE FROM pick_generation_cooldowns 
WHERE game_id::text NOT LIKE 'msf_%';

DELETE FROM games 
WHERE id NOT LIKE 'msf_%';
