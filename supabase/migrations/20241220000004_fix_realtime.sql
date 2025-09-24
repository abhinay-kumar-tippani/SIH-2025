-- Fix realtime publication (only add if not already added)
DO $$
BEGIN
    -- Try to add reports table to realtime
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE reports;
    EXCEPTION WHEN duplicate_object THEN
        -- Table already in publication, ignore
    END;
    
    -- Try to add report_updates table to realtime  
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE report_updates;
    EXCEPTION WHEN duplicate_object THEN
        -- Table already in publication, ignore
    END;
END $$;