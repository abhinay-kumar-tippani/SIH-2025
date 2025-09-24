import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotificationPayload {
  reportId: string;
  userId?: string;
  email?: string;
  type: 'report_submitted' | 'status_update' | 'assignment' | 'resolution' | 'feedback_request';
  title: string;
  message: string;
  pushNotification?: boolean;
  emailNotification?: boolean;
}

async function sendPushNotification(title: string, message: string, userId?: string) {
  // In a real implementation, this would integrate with a push notification service
  // like Firebase Cloud Messaging, OneSignal, or similar
  console.log(`Push notification would be sent to user ${userId}: ${title} - ${message}`);
  return true;
}

async function sendEmailNotification(email: string, title: string, message: string, reportId: string) {
  // In a real implementation, this would integrate with an email service
  // like SendGrid, Mailgun, or AWS SES
  console.log(`Email would be sent to ${email}: ${title} - ${message} (Report: ${reportId})`);
  return true;
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

    const payload: NotificationPayload = await req.json();

    if (!payload.reportId || !payload.type || !payload.title || !payload.message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: reportId, type, title, message' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Get report details if needed
    const { data: report } = await supabaseClient
      .from('reports')
      .select('reporter_email, reporter_name, title')
      .eq('id', payload.reportId)
      .single();

    const targetEmail = payload.email || report?.reporter_email;
    const targetUserId = payload.userId;

    // Create notification record
    const notificationData = {
      user_id: targetUserId,
      report_id: payload.reportId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      is_read: false,
      push_sent: false,
      email_sent: false
    };

    const { data: notification, error: notificationError } = await supabaseClient
      .from('notifications')
      .insert([notificationData])
      .select()
      .single();

    if (notificationError) {
      throw notificationError;
    }

    const results = {
      notificationCreated: true,
      pushSent: false,
      emailSent: false
    };

    // Send push notification if requested and user ID is available
    if (payload.pushNotification !== false && targetUserId) {
      try {
        const pushSuccess = await sendPushNotification(payload.title, payload.message, targetUserId);
        if (pushSuccess) {
          await supabaseClient
            .from('notifications')
            .update({ push_sent: true })
            .eq('id', notification.id);
          results.pushSent = true;
        }
      } catch (error) {
        console.error('Push notification failed:', error);
      }
    }

    // Send email notification if requested and email is available
    if (payload.emailNotification !== false && targetEmail) {
      try {
        const emailSuccess = await sendEmailNotification(
          targetEmail, 
          payload.title, 
          payload.message, 
          payload.reportId
        );
        if (emailSuccess) {
          await supabaseClient
            .from('notifications')
            .update({ email_sent: true })
            .eq('id', notification.id);
          results.emailSent = true;
        }
      } catch (error) {
        console.error('Email notification failed:', error);
      }
    }

    // Log analytics event
    await supabaseClient
      .from('analytics_events')
      .insert([{
        event_type: 'notification_sent',
        report_id: payload.reportId,
        metadata: {
          notification_type: payload.type,
          push_sent: results.pushSent,
          email_sent: results.emailSent,
          target_email: targetEmail ? 'provided' : 'missing',
          target_user_id: targetUserId ? 'provided' : 'missing'
        }
      }]);

    return new Response(
      JSON.stringify({
        success: true,
        notificationId: notification.id,
        results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Notification error:', error);
    
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