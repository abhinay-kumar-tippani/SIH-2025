import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AnalyticsQuery {
  type: 'overview' | 'department_performance' | 'response_times' | 'citizen_satisfaction' | 'trending_issues';
  dateRange?: {
    start: string;
    end: string;
  };
  department?: string;
  category?: string;
}

async function getOverviewAnalytics(supabase: any, dateRange?: { start: string; end: string }) {
  let query = supabase.from('reports').select('*');
  
  if (dateRange) {
    query = query.gte('created_at', dateRange.start).lte('created_at', dateRange.end);
  }

  const { data: reports } = await query;
  
  if (!reports) return null;

  const totalReports = reports.length;
  const statusCounts = reports.reduce((acc: any, report: any) => {
    acc[report.status] = (acc[report.status] || 0) + 1;
    return acc;
  }, {});

  const priorityCounts = reports.reduce((acc: any, report: any) => {
    acc[report.priority] = (acc[report.priority] || 0) + 1;
    return acc;
  }, {});

  const categoryCounts = reports.reduce((acc: any, report: any) => {
    acc[report.category] = (acc[report.category] || 0) + 1;
    return acc;
  }, {});

  // Calculate resolution rate
  const resolvedCount = (statusCounts.resolved || 0) + (statusCounts.closed || 0);
  const resolutionRate = totalReports > 0 ? (resolvedCount / totalReports) * 100 : 0;

  // Calculate average response time
  const resolvedReports = reports.filter((r: any) => r.status === 'resolved' || r.status === 'closed');
  const avgResponseTime = resolvedReports.length > 0 
    ? resolvedReports.reduce((acc: number, report: any) => {
        const created = new Date(report.created_at);
        const updated = new Date(report.updated_at);
        return acc + (updated.getTime() - created.getTime());
      }, 0) / resolvedReports.length / (1000 * 60 * 60 * 24) // Convert to days
    : 0;

  return {
    totalReports,
    statusCounts,
    priorityCounts,
    categoryCounts,
    resolutionRate: Math.round(resolutionRate * 10) / 10,
    avgResponseTime: Math.round(avgResponseTime * 10) / 10
  };
}

async function getDepartmentPerformance(supabase: any, dateRange?: { start: string; end: string }) {
  let query = supabase.from('reports').select('department, status, created_at, updated_at');
  
  if (dateRange) {
    query = query.gte('created_at', dateRange.start).lte('created_at', dateRange.end);
  }

  const { data: reports } = await query;
  
  if (!reports) return null;

  const departmentStats = reports.reduce((acc: any, report: any) => {
    const dept = report.department || 'Unknown';
    if (!acc[dept]) {
      acc[dept] = {
        total: 0,
        resolved: 0,
        avgResponseTime: 0,
        responseTimes: []
      };
    }
    
    acc[dept].total += 1;
    
    if (report.status === 'resolved' || report.status === 'closed') {
      acc[dept].resolved += 1;
      const responseTime = (new Date(report.updated_at).getTime() - new Date(report.created_at).getTime()) / (1000 * 60 * 60 * 24);
      acc[dept].responseTimes.push(responseTime);
    }
    
    return acc;
  }, {});

  // Calculate averages
  Object.keys(departmentStats).forEach(dept => {
    const stats = departmentStats[dept];
    stats.resolutionRate = stats.total > 0 ? (stats.resolved / stats.total) * 100 : 0;
    stats.avgResponseTime = stats.responseTimes.length > 0 
      ? stats.responseTimes.reduce((a: number, b: number) => a + b, 0) / stats.responseTimes.length 
      : 0;
    stats.avgResponseTime = Math.round(stats.avgResponseTime * 10) / 10;
    stats.resolutionRate = Math.round(stats.resolutionRate * 10) / 10;
    delete stats.responseTimes; // Remove raw data
  });

  return departmentStats;
}

async function getCitizenSatisfaction(supabase: any, dateRange?: { start: string; end: string }) {
  let query = supabase.from('reports').select('citizen_rating, citizen_feedback, department, category');
  
  if (dateRange) {
    query = query.gte('created_at', dateRange.start).lte('created_at', dateRange.end);
  }

  const { data: reports } = await query.not('citizen_rating', 'is', null);
  
  if (!reports || reports.length === 0) return null;

  const totalRatings = reports.length;
  const avgRating = reports.reduce((acc: number, report: any) => acc + (report.citizen_rating || 0), 0) / totalRatings;
  
  const ratingDistribution = reports.reduce((acc: any, report: any) => {
    const rating = report.citizen_rating || 0;
    acc[rating] = (acc[rating] || 0) + 1;
    return acc;
  }, {});

  const departmentRatings = reports.reduce((acc: any, report: any) => {
    const dept = report.department || 'Unknown';
    if (!acc[dept]) {
      acc[dept] = { total: 0, sum: 0 };
    }
    acc[dept].total += 1;
    acc[dept].sum += report.citizen_rating || 0;
    return acc;
  }, {});

  Object.keys(departmentRatings).forEach(dept => {
    const stats = departmentRatings[dept];
    departmentRatings[dept] = {
      avgRating: Math.round((stats.sum / stats.total) * 10) / 10,
      totalRatings: stats.total
    };
  });

  return {
    totalRatings,
    avgRating: Math.round(avgRating * 10) / 10,
    ratingDistribution,
    departmentRatings
  };
}

async function getTrendingIssues(supabase: any, dateRange?: { start: string; end: string }) {
  const defaultRange = dateRange || {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
    end: new Date().toISOString()
  };

  const { data: reports } = await supabase
    .from('reports')
    .select('category, title, description, created_at, location_address')
    .gte('created_at', defaultRange.start)
    .lte('created_at', defaultRange.end);

  if (!reports) return null;

  const categoryTrends = reports.reduce((acc: any, report: any) => {
    const category = report.category || 'other';
    if (!acc[category]) {
      acc[category] = {
        count: 0,
        recentReports: []
      };
    }
    acc[category].count += 1;
    acc[category].recentReports.push({
      title: report.title,
      location: report.location_address,
      date: report.created_at
    });
    return acc;
  }, {});

  // Sort by count and limit recent reports
  Object.keys(categoryTrends).forEach(category => {
    categoryTrends[category].recentReports = categoryTrends[category].recentReports
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  });

  const sortedTrends = Object.entries(categoryTrends)
    .sort(([,a]: any, [,b]: any) => b.count - a.count)
    .slice(0, 10);

  return Object.fromEntries(sortedTrends);
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

    const query: AnalyticsQuery = await req.json();

    if (!query.type) {
      return new Response(
        JSON.stringify({ error: 'Analytics type is required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    let result;

    switch (query.type) {
      case 'overview':
        result = await getOverviewAnalytics(supabaseClient, query.dateRange);
        break;
      
      case 'department_performance':
        result = await getDepartmentPerformance(supabaseClient, query.dateRange);
        break;
      
      case 'citizen_satisfaction':
        result = await getCitizenSatisfaction(supabaseClient, query.dateRange);
        break;
      
      case 'trending_issues':
        result = await getTrendingIssues(supabaseClient, query.dateRange);
        break;
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid analytics type' }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400 
          }
        );
    }

    // Log analytics request
    await supabaseClient
      .from('analytics_events')
      .insert([{
        event_type: 'analytics_query',
        metadata: {
          query_type: query.type,
          date_range: query.dateRange,
          department: query.department,
          category: query.category
        }
      }]);

    return new Response(
      JSON.stringify({
        success: true,
        type: query.type,
        data: result,
        generatedAt: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Analytics error:', error);
    
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