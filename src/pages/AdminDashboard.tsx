import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Users, Bot, Activity, AlertTriangle, BarChart3,
  TrendingUp, Target, Clock, ChevronRight, Shield, CheckCircle
} from "lucide-react";
import { isAuthenticated } from "@/lib/auth";
import { api, type AdminStats, type AlertAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [alerts, setAlerts] = useState<AlertAPI[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [statsData, alertsData] = await Promise.all([
        api.admin.stats(),
        api.admin.alerts.list(),
      ]);
      setStats(statsData);
      setAlerts(alertsData.filter(a => !a.resolved).slice(0, 6));
    } catch {
      toast({ title: "Error", description: "Failed to load admin data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!isAuthenticated()) { navigate("/login"); return; }
    load();
  }, [navigate, load]);

  const handleResolveAlert = async (id: number) => {
    await api.admin.alerts.resolve(id);
    setAlerts(prev => prev.filter(a => a.id !== id));
    toast({ title: "Alert resolved" });
  };

  const formatDate = (str: string) => {
    try { return new Date(str).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
    catch { return str; }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-amber-50/30 p-6">
      <div className="container mx-auto max-w-7xl">
        <AppHeader title="Admin Control Panel 👑" />

        {/* Admin Nav */}
        <div className="flex gap-3 mb-6 flex-wrap">
          {[
            { label: 'Overview', href: '/admin', icon: BarChart3, active: true },
            { label: 'Users', href: '/admin/users', icon: Users },
            { label: 'All Drones', href: '/admin/drones', icon: Bot },
            { label: 'Dashboard (User)', href: '/dashboard', icon: Activity },
          ].map(({ label, href, icon: Icon, active }) => (
            <Link key={href} to={href}>
              <Button
                variant={active ? "default" : "outline"}
                size="sm"
                className={`rounded-xl gap-2 ${active ? 'bg-amber-600 hover:bg-amber-700' : ''}`}
              >
                <Icon className="w-4 h-4" /> {label}
              </Button>
            </Link>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : stats && (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Total Users', value: stats.users.total, sub: `${stats.users.admins} admin`, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
                { label: 'Active Users', value: stats.users.active, sub: `${stats.users.inactive} inactive`, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
                { label: 'Total Drones', value: stats.drones.total, sub: `${stats.drones.byStatus?.Active || 0} active`, icon: Bot, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
                { label: 'Total Predictions', value: stats.predictions.total, sub: `${stats.predictions.withFeedback} with feedback`, icon: Target, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
              ].map(({ label, value, sub, icon: Icon, color, bg, border }) => (
                <div key={label} className={`bg-card rounded-xl border ${border} shadow-sm p-5 card-hover`}>
                  <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-3`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <p className="text-3xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">{sub}</p>
                </div>
              ))}
            </div>

            {/* Drone Status Distribution */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div className="bg-card rounded-xl border shadow-sm p-6">
                <h3 className="font-bold mb-4 flex items-center gap-2 text-amber-700">
                  <Bot className="w-5 h-5" /> Drone Status Distribution
                </h3>
                <div className="space-y-3">
                  {Object.entries({
                    Active: { color: 'bg-green-500', text: 'text-green-700' },
                    Idle: { color: 'bg-yellow-400', text: 'text-yellow-700' },
                    Maintenance: { color: 'bg-red-500', text: 'text-red-700' },
                    Offline: { color: 'bg-gray-400', text: 'text-gray-600' },
                  }).map(([status, style]) => {
                    const count = stats.drones.byStatus?.[status] || 0;
                    const pct = stats.drones.total > 0 ? (count / stats.drones.total) * 100 : 0;
                    return (
                      <div key={status}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className={`font-medium ${style.text}`}>{status}</span>
                          <span className="text-muted-foreground">{count} drones ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full ${style.color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Alerts Panel */}
              <div className="bg-card rounded-xl border border-red-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold flex items-center gap-2 text-red-700">
                    <AlertTriangle className="w-5 h-5" /> Active Alerts
                  </h3>
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">
                    {stats.alerts.unresolved} unresolved
                  </span>
                </div>
                {alerts.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-400" />
                    <p className="text-sm">No active alerts 🎉</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {alerts.map(alert => (
                      <div
                        key={alert.id}
                        className={`flex items-start justify-between gap-2 p-3 rounded-lg border text-sm ${
                          alert.severity === 'CRITICAL' ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs leading-tight truncate">{alert.message}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            @{alert.username} • {formatDate(alert.created_at)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleResolveAlert(alert.id)}
                          className="text-xs px-2 py-1 rounded bg-white border hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-colors flex-shrink-0"
                        >
                          Resolve
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
              <div className="p-5 border-b flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" /> Recent Activity
                </h3>
                <Link to="/admin/drones">
                  <Button variant="ghost" size="sm" className="text-xs gap-1">
                    View All <ChevronRight className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
              {stats.recentActivity.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">No activity yet</div>
              ) : (
                <div className="divide-y">
                  {stats.recentActivity.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 hover:bg-accent/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-xs font-bold text-primary">
                          {item.username?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            <span className="text-primary">@{item.username}</span> uploaded "{item.name}"
                          </p>
                          <p className="text-xs text-muted-foreground">Drone: {item.drone_name}</p>
                        </div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        {item.detections?.length > 0 && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full mr-2">
                            {item.detections.length} detected
                          </span>
                        )}
                        {formatDate(item.uploaded_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <AppFooter />
      </div>
    </div>
  );
};

export default AdminDashboard;
