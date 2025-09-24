import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Lang = "en" | "hi";

type Dict = Record<string, string>;

const dicts: Record<Lang, Dict> = {
  en: {
    menu_home: "Home",
    menu_report_issue: "Report Issue",
    menu_track_reports: "Track Reports",
    account: "Account",

    recent_updates: "Recent Updates",
    no_recent_notifications: "No recent notifications",

    welcome_title: "Welcome to CivicSeva",
    welcome_subtitle: "Making our city better, one report at a time",

    total_reports: "Total Reports",
    resolved: "Resolved",
    in_progress: "In Progress",

    report_issues: "Report Issues",
    report_issues_subtitle: "Report civic issues in your area and help improve our community",
    report_new_issue: "Report New Issue",

    track_issues: "Track Issues",
    track_issues_subtitle: "Monitor the progress of your reported issues and community updates",
    view_my_reports: "View My Reports",
    no_recent_reports: "No recent reports",
    votes: "votes",

    community_leaderboard: "Community Leaderboard",
    leaderboard_subtitle: "Top contributors making a difference in our community",
    no_leaderboard: "No leaderboard data yet",
    view_full_leaderboard: "View Full Leaderboard",

    quick_categories: "Quick Categories",
    category_roads: "Roads",
    category_lighting: "Lighting",
    category_sanitation: "Sanitation",
    category_water: "Water",

    city_assistant: "City Assistant",
    type_message: "Type your message…",
    send: "Send",
    assistant_typing: "Assistant is typing…",

    tts_test: "Text-to-Speech test (ElevenLabs)",
    tts_placeholder: "Type something to speak...",
    tts_generating: "Generating...",
    tts_speak: "Speak",
    voice_input: "Voice input",
    listening: "Listening...",
    stt_not_supported: "Speech recognition not supported in this browser.",

    lang_english: "English",
    lang_hindi: "हिंदी",
    
    login_title: "Login with Mobile OTP",
    country: "Country",
    select: "Select",
    phone_number: "Phone number",
    sms_send_to: "We will send an SMS OTP to",
    sending: "Sending...",
    send_otp: "Send OTP",
    continue_guest: "Continue as Guest",
    enter_otp: "Enter OTP",
    otp_placeholder: "6-digit code",
    sent_to: "Sent to",
    verifying: "Verifying...",
    verify_continue: "Verify & Continue",
    edit_number: "Edit number",
    resend_otp: "Resend OTP",
    otp_sent_check_phone: "OTP sent. Please check your phone.",
    failed_send_otp: "Failed to send OTP",
    logged_in_success: "Logged in successfully.",
    invalid_or_expired_code: "Invalid or expired code",
    verification_failed: "Verification failed",

    back: "Back",
    track_reports: "Track Reports",
    find_your_report: "Find your report",
    enter_report_id: "Enter Report ID",
    search: "Search",
    report_not_found: "Report not found. Please check the ID and try again.",
    failed_fetch_report_details: "Failed to fetch report details. Please try again.",
    loading: "Loading...",
    enter_report_id_help: "Enter your report ID to view status. You can also tap any recent report from the Home screen.",
    my_reports: "My Reports",
    sign_in_to_see_reports: "Sign in to see your reports.",
    no_reports_yet: "You have not submitted any reports yet.",

    priority_label: "Priority:",
    eta_label: "ETA:",
    voted: "Voted",
    upvote: "Upvote",
    community_verified: "Community verified",

    updates: "Updates",
    no_updates_yet: "No updates yet.",
    attachments: "Attachments",
    no_attachments: "No attachments.",
    download: "Download",

    your_feedback: "Your Feedback",
    leave_comment_optional: "Leave a comment (optional)",
    submit_feedback: "Submit Feedback",
    thank_you_feedback: "Thank you for your feedback!",
    failed_submit_feedback: "Failed to submit feedback. Please try again.",

    categories: "Categories",
    status: "Status",
    your_location: "Your location",

    status_pending: "Pending",
    status_in_progress: "In Progress",
    status_resolved: "Resolved",
    status_submitted: "Submitted",
    status_acknowledged: "Acknowledged",
    status_closed: "Closed",
    status_rejected: "Rejected",
  },
  hi: {
    menu_home: "होम",
    menu_report_issue: "समस्या दर्ज करें",
    menu_track_reports: "रिपोर्ट ट्रैक करें",
    account: "खाता",

    recent_updates: "हाल के अपडेट",
    no_recent_notifications: "कोई हाल के नोटिफिकेशन नहीं",

    welcome_title: "CivicSeva में आपका स्वागत है",
    welcome_subtitle: "हमारे शहर को बेहतर बनाने के लिए आपकी रिपोर्ट अहम है",

    total_reports: "कुल रिपोर्ट",
    resolved: "Resolved",
    in_progress: "प्रगति पर",

    report_issues: "समस्याएँ दर्ज करें",
    report_issues_subtitle: "अपने क्षेत्र की नागरिक समस्याएँ रिपोर्ट करें और समुदाय की मदद करें",
    report_new_issue: "नई समस्या रिपोर्ट करें",

    track_issues: "समस्याएँ ट्रैक करें",
    track_issues_subtitle: "अपनी रिपोर्ट और सामुदायिक अपडेट देखें",
    view_my_reports: "मेरी रिपोर्ट देखें",
    no_recent_reports: "कोई हाल की रिपोर्ट नहीं",
    votes: "वोट",

    community_leaderboard: "समुदाय लीडरबोड",
    leaderboard_subtitle: "समुदाय में अंतर लाने वाले शीर्ष योगदानकर्ता",
    no_leaderboard: "अभी कोई लीडरबोर्ड डेटा नहीं",
    view_full_leaderboard: "पूरा लीडरबोर्ड देखें",

    quick_categories: "त्वरित श्रेणियाँ",
    category_roads: "सड़कें",
    category_lighting: "प्रकाश",
    category_sanitation: "स्वच्छता",
    category_water: "पानी",

    city_assistant: "सिटी असिस्टेंट",
    type_message: "अपना संदेश लिखें…",
    send: "भेजें",
    assistant_typing: "सहायक लिख रहा है…",

    tts_test: "टेक्स्ट-टू-स्पीच परीक्षा (ElevenLabs)",
    tts_placeholder: "बोलने हेतु कुछ लिखें...",
    tts_generating: "तैयार हो रहा है...",
    tts_speak: "बोलें",
    voice_input: "आवाज़ इनपुट",
    listening: "सुन रहा है...",
    stt_not_supported: "इस ब्राउज़र में वॉइस रिकॉग्निशन उपलब्ध नहीं है।",

    lang_english: "English",
    lang_hindi: "हिंदी",
    
    login_title: "मोबाइल ओटीपी से लॉगिन",
    country: "देश",
    select: "चयन करें",
    phone_number: "फोन नंबर",
    sms_send_to: "हम एसएमएस ओटीपी भेजेंगे",
    sending: "भेजा जा रहा है...",
    send_otp: "ओटीपी भेजें",
    continue_guest: "अतिथि के रूप में जारी रखें",
    enter_otp: "ओटीपी दर्ज करें",
    otp_placeholder: "6-अंकीय कोड",
    sent_to: "भेजा गया",
    verifying: "सत्यापित हो रहा है...",
    verify_continue: "सत्याप��त करें और आगे बढ़ें",
    edit_number: "नंबर संपादित करें",
    resend_otp: "ओटीपी पुनः भेजें",
    otp_sent_check_phone: "ओटीपी भेजा गया। कृपया अपना फोन देखें।",
    failed_send_otp: "ओटीपी भेजें में विफल",
    logged_in_success: "सफलतापूर्वक लॉगिन हुआ।",
    invalid_or_expired_code: "अमान्य या समाप्त कोड",
    verification_failed: "सत्यापन असफल",

    back: "वापस",
    track_reports: "रिपोर्ट ट्रैक करें",
    find_your_report: "अपनी रिपोर्ट खोजें",
    enter_report_id: "रिपोर्ट आईडी दर्ज करें",
    search: "खोजें",
    report_not_found: "रिपोर्ट नहीं मिली। कृपया आईडी जांचें और पुनः प्रयास करें।",
    failed_fetch_report_details: "रिपोर्ट विवरण लाने में विफल। कृपया पुनः प्रयास करें।",
    loading: "लोड हो रहा है...",
    enter_report_id_help: "स्थिति देखने के लिए अपनी रिपोर्ट आईडी दर्ज करें। आप होम स्क्रीन से हाल की रिपोर्ट भी चुन सकते हैं।",
    my_reports: "मेरी रिपोर्ट",
    sign_in_to_see_reports: "अपनी रिपोर्ट देखने के लिए साइन इन करें।",
    no_reports_yet: "आपने अभी तक कोई रिपोर्ट सबमिट नहीं की है।",

    priority_label: "प्राथमिकता:",
    eta_label: "अनुमानित समय:",
    voted: "वोट किया",
    upvote: "वोट करें",
    community_verified: "समुदाय द्वारा सत्यापित",

    updates: "अपडेट्स",
    no_updates_yet: "अभी तक कोई अपडेट नहीं।",
    attachments: "संलग्नक",
    no_attachments: "कोई संलग्नक नहीं।",
    download: "डाउनलोड",

    your_feedback: "आपकी प्रतिक्रिया",
    leave_comment_optional: "���िप्पणी छोड़ें (वैकल्पिक)",
    submit_feedback: "प्रतिक्रिया सबमिट करें",
    thank_you_feedback: "आपकी प्रतिक्रिया के लिए धन्यवाद!",
    failed_submit_feedback: "प्रतिक्रिया सबमिट करने में विफल। कृपया पुनः प्रयास करें।",

    categories: "श्रेणियाँ",
    status: "स्थिति",
    your_location: "आपका स्थान",

    status_pending: "लंबित",
    status_in_progress: "प्रगति में",
    status_resolved: "निपटाया गया",
    status_submitted: "सबमिट किया गया",
    status_acknowledged: "स्वीकार किया गया",
    status_closed: "बंद किया गया",
    status_rejected: "अस्वीकृत",
  },
};

Object.assign(dicts.en, {
  municipal_admin_portal: "Municipal Admin Portal",
  admin_subtitle: "Manage citizen reports and track departmental performance",
  dashboard_tab: "Dashboard",
  reports_tab: "Reports",
  analytics_tab: "Analytics",
  settings_tab: "Settings",
  total_reports_label: "Total Reports",
  pending_label: "Pending",
  resolved_label: "Resolved",
  avg_days: "Avg Days",
  recent_reports: "Recent Reports",
  filter_reports: "Filter Reports",
  export_csv: "Export CSV",
  search_reports_placeholder: "Search reports...",
  all_status: "All Status",
  all_priority: "All Priority",
  all_departments: "All Departments",
  all_time: "All Time",
  today: "Today",
  week: "Last Week",
  month: "Last Month",
  priority: "Priority",
  department: "Department",
  date_range: "Date Range",
  clear_filters: "Clear Filters",
  reports_title: "Reports",
  loading_reports: "Loading reports...",
  table_title: "Title",
  table_reporter: "Reporter",
  table_category: "Category",
  table_status: "Status",
  table_priority: "Priority",
  table_department: "Department",
  table_created: "Created",
  table_actions: "Actions",
  report_details: "Report Details",
  description: "Description",
  location: "Location",
  reporter: "Reporter",
  assigned_to: "Assigned To",
  unassigned: "Unassigned",
  new_status: "New Status",
  select_new_status: "Select new status",
  assign_to: "Assign To",
  select_staff_member: "Select staff member",
  update_message: "Update Message",
  update_message_placeholder: "Enter update message for citizen...",
  update_report: "Update Report",
  report_updated_success: "Report updated successfully!",
  failed_update_report: "Failed to update report. Please try again.",
  performance_analytics: "Performance Analytics",
  reports_by_status: "Reports by Status",
  department_performance: "Department Performance",
  system_settings: "System Settings",
  notification_settings: "Notification Settings",
  notification_settings_desc: "Configure how and when notifications are sent to citizens and staff.",
  department_configuration: "Department Configuration",
  department_configuration_desc: "Manage departments, staff assignments, and routing rules.",
  data_export: "Data Export",
  data_export_desc: "Schedule automated reports and data exports.",
  current_location: "Current Location",
  selected_location_on_map: "Selected location on map",
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
});

Object.assign(dicts.hi, {
  municipal_admin_portal: "नगरपालिका एडमिन पोर्टल",
  admin_subtitle: "नागरिक रिपोर्ट्स का प्रबंधन करें और विभागीय प्रदर्शन ट्रैक करें",
  dashboard_tab: "डैशबोर्ड",
  reports_tab: "रिपोर्ट्स",
  analytics_tab: "एनालिटिक्स",
  settings_tab: "सेटिंग्स",
  total_reports_label: "कुल रिपोर्ट",
  pending_label: "लंबित",
  resolved_label: "निपटाया गया",
  avg_days: "औसत दिन",
  recent_reports: "हाल की रिपोर्ट्स",
  filter_reports: "रि���ोर्ट्स फ़िल्टर करें",
  export_csv: "CSV एक्सपोर्ट",
  search_reports_placeholder: "रिपोर्ट्स खोजें...",
  all_status: "सभी स्थिति",
  all_priority: "सभी प्राथमिकता",
  all_departments: "सभी विभाग",
  all_time: "सभी समय",
  today: "आज",
  week: "पिछला सप्ताह",
  month: "पिछला महीना",
  priority: "प्राथमिकता",
  department: "विभाग",
  date_range: "तिथि सीमा",
  clear_filters: "फ़िल्टर साफ़ करें",
  reports_title: "रिपोर्ट्स",
  loading_reports: "रिपोर्ट्स लोड हो रही हैं...",
  table_title: "शीर्षक",
  table_reporter: "रिपोर्टर",
  table_category: "श्रेणी",
  table_status: "स्थिति",
  table_priority: "प्राथमिकता",
  table_department: "विभाग",
  table_created: "तारीख",
  table_actions: "कार्रवाइयाँ",
  report_details: "रिपोर्ट विवरण",
  description: "विवरण",
  location: "स्थान",
  reporter: "रिपोर्टर",
  assigned_to: "सौंपा गया",
  unassigned: "असाइन नहीं",
  new_status: "नई स्थिति",
  select_new_status: "नई स्थि���ि चुनें",
  assign_to: "किसे सौंपें",
  select_staff_member: "स्टाफ सदस्य चुनें",
  update_message: "अपडेट संदेश",
  update_message_placeholder: "नागरिक के लिए अपडेट संदेश लिखें...",
  update_report: "रिपोर्ट अपडेट करें",
  report_updated_success: "रिपोर्ट सफलतापूर्वक अपडेट हुई!",
  failed_update_report: "रिपोर्ट अपडेट करने में विफल। कृपया पुनः प्रयास करें।",
  performance_analytics: "प्रदर्शन एनालिटिक्स",
  reports_by_status: "स्थिति के अनुसार रिपोर्ट्स",
  department_performance: "विभाग प्रदर्शन",
  system_settings: "सिस्टम सेटिंग्स",
  notification_settings: "सूचना सेटिंग्स",
  notification_settings_desc: "नागरिकों और स्टाफ को सूचनाएँ कब और कैसे भेजी जाएँ, कॉन्फ़िगर करें।",
  department_configuration: "विभाग कॉन्फ़िगरेशन",
  department_configuration_desc: "विभाग, स्टाफ असाइनमेंट और रूटिंग नियम प्रबंधित करें।",
  data_export: "डेटा एक्सपोर्ट",
  data_export_desc: "स्वचालित रिपोर्ट और डेटा एक्सपोर्ट शेड्यूल करें।",
  current_location: "वर्तमान स्थान",
  selected_location_on_map: "मानचित्र पर चयनित स्थान",
  low: "लो",
  medium: "मध्यम",
  high: "उच्च",
  urgent: "तत्काल",
});

interface I18nContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem("lang") as Lang) || "en");

  useEffect(() => {
    localStorage.setItem("lang", lang);
  }, [lang]);

  const t = useMemo(() => {
    const d = dicts[lang] || dicts.en;
    return (key: string) => d[key] ?? dicts.en[key] ?? key;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  const fallbackT = (key: string) => dicts.en[key] ?? key;
  return { lang: 'en' as Lang, setLang: () => {}, t: fallbackT };
};