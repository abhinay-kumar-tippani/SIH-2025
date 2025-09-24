import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Report {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  location_lat?: number;
  location_lng?: number;
  location_address: string;
  department?: string;
}

interface RoutingRule {
  category: string;
  department: string;
  defaultAssignee?: string;
  priorityMultiplier: number;
  keywords: string[];
}

const ROUTING_RULES: RoutingRule[] = [
  {
    category: "roads",
    department: "Public Works",
    defaultAssignee: "John Smith - Public Works",
    priorityMultiplier: 1.2,
    keywords: ["pothole", "road", "street", "pavement", "traffic", "signal"]
  },
  {
    category: "lighting",
    department: "Utilities",
    defaultAssignee: "Sarah Johnson - Utilities",
    priorityMultiplier: 0.8,
    keywords: ["light", "lamp", "dark", "electricity", "power", "bulb"]
  },
  {
    category: "sanitation",
    department: "Sanitation",
    defaultAssignee: "Mike Davis - Sanitation",
    priorityMultiplier: 1.5,
    keywords: ["garbage", "trash", "waste", "dirty", "smell", "litter"]
  },
  {
    category: "water",
    department: "Water Department",
    defaultAssignee: "Lisa Chen - Water Department",
    priorityMultiplier: 2.0,
    keywords: ["water", "leak", "pipe", "drain", "flood", "sewer"]
  },
  {
    category: "parks",
    department: "Parks",
    defaultAssignee: "Tom Wilson - Parks",
    priorityMultiplier: 0.6,
    keywords: ["park", "tree", "grass", "playground", "bench", "garden"]
  },
  {
    category: "safety",
    department: "Safety",
    defaultAssignee: "Anna Rodriguez - Safety",
    priorityMultiplier: 3.0,
    keywords: ["danger", "unsafe", "hazard", "emergency", "accident", "injury"]
  },
  {
    category: "noise",
    department: "Environmental",
    defaultAssignee: "David Kim - Environmental",
    priorityMultiplier: 0.7,
    keywords: ["noise", "loud", "sound", "music", "construction", "disturb"]
  }
];

const PRIORITY_SCORES = {
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4
};

function calculatePriorityScore(report: Report): number {
  const rule = ROUTING_RULES.find(r => r.category === report.category);
  const basePriority = PRIORITY_SCORES[report.priority as keyof typeof PRIORITY_SCORES] || 2;
  const multiplier = rule?.priorityMultiplier || 1;
  
  // Check for urgent keywords in title/description
  const text = `${report.title} ${report.description}`.toLowerCase();
  const urgentKeywords = ["emergency", "urgent", "immediate", "danger", "hazard", "accident"];
  const hasUrgentKeywords = urgentKeywords.some(keyword => text.includes(keyword));
  
  let score = basePriority * multiplier;
  if (hasUrgentKeywords) score *= 1.5;
  
  return Math.min(score, 10); // Cap at 10
}

function determineAssignment(report: Report): { department: string; assignee: string; priority: string } {
  const rule = ROUTING_RULES.find(r => r.category === report.category);
  
  if (!rule) {
    return {
      department: "General",
      assignee: "General Admin",
      priority: report.priority
    };
  }

  const priorityScore = calculatePriorityScore(report);
  
  // Adjust priority based on calculated score
  let adjustedPriority = report.priority;
  if (priorityScore >= 8) adjustedPriority = "urgent";
  else if (priorityScore >= 6) adjustedPriority = "high";
  else if (priorityScore >= 4) adjustedPriority = "medium";
  else adjustedPriority = "low";

  return {
    department: rule.department,
    assignee: rule.defaultAssignee || `${rule.department} Team`,
    priority: adjustedPriority
  };
}

async function createNotification(supabase: any, reportId: string, userId: string, type: string, title: string, message: string) {
  try {
    await supabase
      .from('notifications')
      .insert([{
        user_id: userId,
        report_id: reportId,
        type,
        title,
        message,
        is_read: false
      }]);
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_KEY') ?? ''
    );

    const { reportId } = await req.json();

    if (!reportId) {
      return new Response(
        JSON.stringify({ error: 'Report ID is required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Fetch the report
    const { data: report, error: fetchError } = await supabaseClient
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (fetchError || !report) {
      return new Response(
        JSON.stringify({ error: 'Report not found' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404 
        }
      );
    }

    // Determine routing
    const assignment = determineAssignment(report);
    
    // Update the report with routing information
    const { error: updateError } = await supabaseClient
      .from('reports')
      .update({
        department: assignment.department,
        assigned_to: assignment.assignee,
        priority: assignment.priority,
        status: 'acknowledged',
        updated_at: new Date().toISOString()
      })
      .eq('id', reportId);

    if (updateError) {
      throw updateError;
    }

    // Create status update
    await supabaseClient
      .from('report_updates')
      .insert([{
        report_id: reportId,
        status: 'acknowledged',
        message: `Report has been acknowledged and assigned to ${assignment.department}. Priority level: ${assignment.priority}.`,
        updated_by_name: 'Automated Routing System',
        is_public: true
      }]);

    // Create notification for citizen (if we had user management)
    // This would typically create a notification for the reporter
    
    // Log analytics event
    await supabaseClient
      .from('analytics_events')
      .insert([{
        event_type: 'report_routed',
        report_id: reportId,
        department: assignment.department,
        category: report.category,
        metadata: {
          original_priority: report.priority,
          assigned_priority: assignment.priority,
          assignee: assignment.assignee,
          routing_score: calculatePriorityScore(report)
        }
      }]);

    return new Response(
      JSON.stringify({
        success: true,
        routing: assignment,
        message: 'Report successfully routed and assigned'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Routing error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});