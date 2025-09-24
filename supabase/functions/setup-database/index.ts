import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Create reports table
    const { error: reportsError } = await supabaseClient.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS reports (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL,
          description TEXT,
          category TEXT,
          status TEXT DEFAULT 'submitted',
          priority TEXT DEFAULT 'medium',
          location_lat DECIMAL(10, 8),
          location_lng DECIMAL(11, 8),
          location_address TEXT,
          reporter_name TEXT,
          reporter_email TEXT,
          reporter_phone TEXT,
          assigned_to TEXT,
          department TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    })

    if (reportsError) {
      console.error('Reports table error:', reportsError)
    }

    // Create report_updates table
    const { error: updatesError } = await supabaseClient.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS report_updates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
          status TEXT NOT NULL,
          message TEXT,
          updated_by_name TEXT,
          is_public BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    })

    if (updatesError) {
      console.error('Updates table error:', updatesError)
    }

    // Enable realtime
    const { error: realtimeError } = await supabaseClient.rpc('exec_sql', {
      sql: `
        ALTER PUBLICATION supabase_realtime ADD TABLE reports;
        ALTER PUBLICATION supabase_realtime ADD TABLE report_updates;
      `
    })

    if (realtimeError) {
      console.error('Realtime error:', realtimeError)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Database setup completed',
        errors: {
          reports: reportsError?.message,
          updates: updatesError?.message,
          realtime: realtimeError?.message
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})