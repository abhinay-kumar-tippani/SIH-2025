import React, { useState, useEffect, useMemo } from "react";
import { Filter, Search, Users, Clock, CheckCircle, AlertTriangle, MapPin, Calendar, Download, Eye, MessageSquare, User, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import supabase from "@/lib/supabaseClient";
import { useI18n } from "@/lib/i18n";

interface Report {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  location_address: string;
  reporter_name: string;
  reporter_email: string;
  department: string;
  assigned_to: string;
  created_at: string;
  updated_at: string;
}

interface DashboardStats {
  total: number;
  submitted: number;
  acknowledged: number;
  in_progress: number;
  resolved: number;
  closed: number;
  rejected: number;
  avgResolutionTime: number;
}

const STATUS_COLORS = {
  submitted: "bg-blue-100 text-blue-800",
  acknowledged: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-orange-100 text-orange-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
  rejected: "bg-red-100 text-red-800"
};

const PRIORITY_COLORS = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800"
};

const DEPARTMENTS = [
  "Public Works",
  "Utilities", 
  "Sanitation",
  "Water Department",
  "Parks",
  "Safety",
  "Environmental",
  "General"
];

const STAFF_MEMBERS = [
  "John Smith - Public Works",
  "Sarah Johnson - Utilities",
  "Mike Davis - Sanitation", 
  "Lisa Chen - Water Department",
  "Tom Wilson - Parks",
  "Anna Rodriguez - Safety",
  "David Kim - Environmental"
];

export default function AdminPortal() {
  const { t } = useI18n();
  const [reports, setReports] = useState<Report[]>([]);
  const [filteredReports, setFilteredReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    submitted: 0,
    acknowledged: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0,
    rejected: 0,
    avgResolutionTime: 0
  });

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  // Selected report for details/actions
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [updateMessage, setUpdateMessage] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [assignTo, setAssignTo] = useState("");

  // Fetch reports
  const fetchReports = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setReports(data);
        calculateStats(data);
      }
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate dashboard statistics
  const calculateStats = (reportsData: Report[]) => {
    const total = reportsData.length;
    const statusCounts = reportsData.reduce((acc, report) => {
      acc[report.status] = (acc[report.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate average resolution time (simplified)
    const resolvedReports = reportsData.filter(r => r.status === "resolved" || r.status === "closed");
    const avgResolutionTime = resolvedReports.length > 0 
      ? resolvedReports.reduce((acc, report) => {
          const created = new Date(report.created_at);
          const updated = new Date(report.updated_at);
          return acc + (updated.getTime() - created.getTime());
        }, 0) / resolvedReports.length / (1000 * 60 * 60 * 24) // Convert to days
      : 0;

    setStats({
      total,
      submitted: statusCounts.submitted || 0,
      acknowledged: statusCounts.acknowledged || 0,
      in_progress: statusCounts.in_progress || 0,
      resolved: statusCounts.resolved || 0,
      closed: statusCounts.closed || 0,
      rejected: statusCounts.rejected || 0,
      avgResolutionTime: Math.round(avgResolutionTime * 10) / 10
    });
  };

  // Apply filters
  const applyFilters = useMemo(() => {
    let filtered = reports;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(report =>
        report.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.reporter_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        report.location_address.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(report => report.status === statusFilter);
    }

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter(report => report.category === categoryFilter);
    }

    // Priority filter
    if (priorityFilter !== "all") {
      filtered = filtered.filter(report => report.priority === priorityFilter);
    }

    // Department filter
    if (departmentFilter !== "all") {
      filtered = filtered.filter(report => report.department === departmentFilter);
    }

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date();
      const filterDate = new Date();
      
      switch (dateFilter) {
        case "today":
          filterDate.setHours(0, 0, 0, 0);
          break;
        case "week":
          filterDate.setDate(now.getDate() - 7);
          break;
        case "month":
          filterDate.setMonth(now.getMonth() - 1);
          break;
      }
      
      if (dateFilter !== "all") {
        filtered = filtered.filter(report => new Date(report.created_at) >= filterDate);
      }
    }

    return filtered;
  }, [reports, searchTerm, statusFilter, categoryFilter, priorityFilter, departmentFilter, dateFilter]);

  // Update report status
  const updateReportStatus = async () => {
    if (!selectedReport || !newStatus) return;

    try {
      // Update report
      const { error: updateError } = await supabase
        .from("reports")
        .update({
          status: newStatus,
          assigned_to: assignTo || selectedReport.assigned_to,
          updated_at: new Date().toISOString()
        })
        .eq("id", selectedReport.id);

      if (updateError) throw updateError;

      // Add status update
      const { error: statusError } = await supabase
        .from("report_updates")
        .insert([{
          report_id: selectedReport.id,
          status: newStatus,
          message: updateMessage || `Status updated to ${newStatus}`,
          updated_by_name: "Admin User", // In real app, get from auth
          is_public: true
        }]);

      if (statusError) throw statusError;

      // Refresh data
      fetchReports();
      setSelectedReport(null);
      setUpdateMessage("");
      setNewStatus("");
      setAssignTo("");
      
      alert(t('report_updated_success'));
    } catch (error) {
      console.error("Error updating report:", error);
      alert(t('failed_update_report'));
    }
  };

  // Export data
  const exportData = () => {
    const csvContent = [
      ["ID", "Title", "Category", "Status", "Priority", "Department", "Reporter", "Created", "Location"].join(","),
      ...filteredReports.map(report => [
        report.id,
        `"${report.title}"`,
        report.category,
        report.status,
        report.priority,
        report.department,
        report.reporter_name,
        new Date(report.created_at).toLocaleDateString(),
        `"${report.location_address}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reports-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Real-time updates
  useEffect(() => {
    fetchReports();

    const channel = supabase
      .channel("admin-reports")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reports" },
        () => {
          fetchReports(); // Refresh on any change
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  // Update filtered reports when filters change
  useEffect(() => {
    setFilteredReports(applyFilters);
  }, [applyFilters]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">{t('municipal_admin_portal')}</h1>
          <p className="text-muted-foreground">{t('admin_subtitle')}</p>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard">{t('dashboard_tab')}</TabsTrigger>
            <TabsTrigger value="reports">{t('reports_tab')}</TabsTrigger>
            <TabsTrigger value="analytics">{t('analytics_tab')}</TabsTrigger>
            <TabsTrigger value="settings">{t('settings_tab')}</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-2xl font-bold">{stats.total}</p>
                      <p className="text-sm text-muted-foreground">{t('total_reports_label')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-foreground" />
                    <div>
                      <p className="text-2xl font-bold">{stats.submitted + stats.acknowledged}</p>
                      <p className="text-sm text-muted-foreground">{t('pending_label')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-[hsl(var(--secondary))]" />
                    <div>
                      <p className="text-2xl font-bold">{stats.resolved + stats.closed}</p>
                      <p className="text-sm text-muted-foreground">{t('resolved_label')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-2xl font-bold">{stats.avgResolutionTime}</p>
                      <p className="text-sm text-muted-foreground">{t('avg_days')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Reports */}
            <Card>
              <CardHeader>
                <CardTitle>{t('recent_reports')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {reports.slice(0, 5).map((report) => (
                    <div key={report.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{report.title}</p>
                        <p className="text-sm text-gray-600">{report.reporter_name} • {formatDate(report.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={STATUS_COLORS[report.status as keyof typeof STATUS_COLORS]}>
                          {t(`status_${report.status}`)}
                        </Badge>
                        <Badge className={PRIORITY_COLORS[report.priority as keyof typeof PRIORITY_COLORS]}>
                          {t(report.priority)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-6">
            {/* Filters */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t('filter_reports')}</CardTitle>
                  <Button onClick={exportData} variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    {t('export_csv')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder={t('search_reports_placeholder')}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('status')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('all_status')}</SelectItem>
                      <SelectItem value="submitted">{t('status_submitted')}</SelectItem>
                      <SelectItem value="acknowledged">{t('status_acknowledged')}</SelectItem>
                      <SelectItem value="in_progress">{t('status_in_progress')}</SelectItem>
                      <SelectItem value="resolved">{t('status_resolved')}</SelectItem>
                      <SelectItem value="closed">{t('status_closed')}</SelectItem>
                      <SelectItem value="rejected">{t('status_rejected')}</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('priority')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('all_priority')}</SelectItem>
                      <SelectItem value="low">{t('low')}</SelectItem>
                      <SelectItem value="medium">{t('medium')}</SelectItem>
                      <SelectItem value="high">{t('high')}</SelectItem>
                      <SelectItem value="urgent">{t('urgent')}</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('department')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('all_departments')}</SelectItem>
                      {DEPARTMENTS.map((dept) => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('date_range')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('all_time')}</SelectItem>
                      <SelectItem value="today">{t('today')}</SelectItem>
                      <SelectItem value="week">{t('week')}</SelectItem>
                      <SelectItem value="month">{t('month')}</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm("");
                      setStatusFilter("all");
                      setCategoryFilter("all");
                      setPriorityFilter("all");
                      setDepartmentFilter("all");
                      setDateFilter("all");
                    }}
                  >
                    {t('clear_filters')}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Reports Table */}
            <Card>
              <CardHeader>
                <CardTitle>{t('reports_title')} ({filteredReports.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">{t('loading_reports')}</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('table_title')}</TableHead>
                        <TableHead>{t('table_reporter')}</TableHead>
                        <TableHead>{t('table_category')}</TableHead>
                        <TableHead>{t('table_status')}</TableHead>
                        <TableHead>{t('table_priority')}</TableHead>
                        <TableHead>{t('table_department')}</TableHead>
                        <TableHead>{t('table_created')}</TableHead>
                        <TableHead>{t('table_actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReports.map((report) => (
                        <TableRow key={report.id}>
                          <TableCell className="font-medium">{report.title}</TableCell>
                          <TableCell>{report.reporter_name}</TableCell>
                          <TableCell>{report.category}</TableCell>
                          <TableCell>
                            <Badge className={STATUS_COLORS[report.status as keyof typeof STATUS_COLORS]}>
                              {t(`status_${report.status}`)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={PRIORITY_COLORS[report.priority as keyof typeof PRIORITY_COLORS]}>
                              {t(report.priority)}
                            </Badge>
                          </TableCell>
                          <TableCell>{report.department}</TableCell>
                          <TableCell>{new Date(report.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedReport(report)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>{t('report_details')}</DialogTitle>
                                </DialogHeader>
                                {selectedReport && (
                                  <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <label className="text-sm font-medium">{t('table_title')}</label>
                                        <p className="text-sm text-gray-600">{selectedReport.title}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">{t('table_status')}</label>
                                        <Badge className={STATUS_COLORS[selectedReport.status as keyof typeof STATUS_COLORS]}>
                                          {t(`status_${selectedReport.status}`)}
                                        </Badge>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">{t('table_priority')}</label>
                                        <Badge className={PRIORITY_COLORS[selectedReport.priority as keyof typeof PRIORITY_COLORS]}>
                                          {t(selectedReport.priority)}</Badge>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">{t('table_department')}</label>
                                        <p className="text-sm text-gray-600">{selectedReport.department}</p>
                                      </div>
                                    </div>

                                    <div>
                                      <label className="text-sm font-medium">{t('description')}</label>
                                      <p className="text-sm text-gray-600 mt-1">{selectedReport.description}</p>
                                    </div>

                                    <div>
                                      <label className="text-sm font-medium">{t('location')}</label>
                                      <p className="text-sm text-gray-600 mt-1">{selectedReport.location_address}</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                      <div>
                                        <label className="text-sm font-medium">{t('reporter')}</label>
                                        <p className="text-sm text-gray-600">{selectedReport.reporter_name}</p>
                                        <p className="text-sm text-gray-600">{selectedReport.reporter_email}</p>
                                      </div>
                                      <div>
                                        <label className="text-sm font-medium">{t('assigned_to')}</label>
                                        <p className="text-sm text-gray-600">{selectedReport.assigned_to || t('unassigned')}</p>
                                      </div>
                                    </div>

                                    <div className="border-t pt-4">
                                      <h4 className="font-medium mb-3">{t('update_report')}</h4>
                                      
                                      <div className="space-y-3">
                                        <div>
                                          <label className="text-sm font-medium">{t('new_status')}</label>
                                          <Select value={newStatus} onValueChange={setNewStatus}>
                                            <SelectTrigger>
                                              <SelectValue placeholder={t('select_new_status')} />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="acknowledged">{t('status_acknowledged')}</SelectItem>
                                              <SelectItem value="in_progress">{t('status_in_progress')}</SelectItem>
                                              <SelectItem value="resolved">{t('status_resolved')}</SelectItem>
                                              <SelectItem value="closed">{t('status_closed')}</SelectItem>
                                              <SelectItem value="rejected">{t('status_rejected')}</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>

                                        <div>
                                          <label className="text-sm font-medium">{t('assign_to')}</label>
                                          <Select value={assignTo} onValueChange={setAssignTo}>
                                            <SelectTrigger>
                                              <SelectValue placeholder={t('select_staff_member')} />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {STAFF_MEMBERS.map((staff) => (
                                                <SelectItem key={staff} value={staff}>{staff}</SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>

                                        <div>
                                          <label className="text-sm font-medium">{t('update_message')}</label>
                                          <Textarea
                                            value={updateMessage}
                                            onChange={(e) => setUpdateMessage(e.target.value)}
                                            placeholder={t('update_message_placeholder')}
                                            rows={3}
                                          />
                                        </div>

                                        <Button onClick={updateReportStatus} className="w-full">
                                          {t('update_report')}
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('performance_analytics')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium mb-3">{t('reports_by_status')}</h4>
                    <div className="space-y-2">
                      {Object.entries(stats).filter(([key]) => !["total", "avgResolutionTime"].includes(key)).map(([status, count]) => (
                        <div key={status} className="flex justify-between items-center">
                          <span className="capitalize">{t(`status_${status}`)}</span>
                          <Badge variant="secondary">{count as number}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3">{t('department_performance')}</h4>
                    <div className="space-y-2">
                      {DEPARTMENTS.map((dept) => {
                        const deptReports = reports.filter(r => r.department === dept);
                        const resolved = deptReports.filter(r => r.status === "resolved" || r.status === "closed").length;
                        const total = deptReports.length;
                        const percentage = total > 0 ? Math.round((resolved / total) * 100) : 0;
                        
                        return (
                          <div key={dept} className="flex justify-between items-center">
                            <span>{dept}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-600">{resolved}/{total}</span>
                              <Badge variant="secondary">{percentage}%</Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('system_settings')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">{t('notification_settings')}</h4>
                    <p className="text-sm text-gray-600">{t('notification_settings_desc')}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">{t('department_configuration')}</h4>
                    <p className="text-sm text-gray-600">{t('department_configuration_desc')}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">{t('data_export')}</h4>
                    <p className="text-sm text-gray-600">{t('data_export_desc')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}