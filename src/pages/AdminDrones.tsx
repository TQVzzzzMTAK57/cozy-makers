import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bot, Search, BarChart3, Users, Activity } from "lucide-react";
import { isAuthenticated } from "@/lib/auth";
import { api, type DroneAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";

const AdminDrones = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [drones, setDrones] = useState<DroneAPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setDrones(await api.admin.drones.list());
    } catch {
      toast({ title: "Error", description: "Failed to load drones", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!isAuthenticated()) { navigate("/login"); return; }
    load();
  }, [navigate, load]);

  const filtered = drones.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.serial_number.toLowerCase().includes(search.toLowerCase()) ||
      (d.owner_username || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || d.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const statusConfig: Record<string, { color: string; bg: string; text: string }> = {
    Active: { color: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700' },
    Idle: { color: 'bg-yellow-400', bg: 'bg-yellow-50', text: 'text-yellow-700' },
    Maintenance: { color: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700' },
    Offline: { color: 'bg-gray-400', bg: 'bg-gray-50', text: 'text-gray-600' },
  };

  const formatDate = (s: string) => { try { return new Date(s).toLocaleDateString('vi-VN'); } catch { return s; } };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-amber-50/30 p-6">
      <div className="container mx-auto max-w-7xl">
        <AppHeader title="All Drones — System View 🤖" />

        {/* Admin Nav */}
        <div className="flex gap-3 mb-6 flex-wrap">
          {[
            { label: 'Overview', href: '/admin', icon: BarChart3 },
            { label: 'Users', href: '/admin/users', icon: Users },
            { label: 'All Drones', href: '/admin/drones', icon: Bot, active: true },
            { label: 'Dashboard', href: '/dashboard', icon: Activity },
          ].map(({ label, href, icon: Icon, active }) => (
            <Link key={href} to={href}>
              <Button variant={active ? "default" : "outline"} size="sm"
                className={`rounded-xl gap-2 ${active ? 'bg-amber-600 hover:bg-amber-700' : ''}`}>
                <Icon className="w-4 h-4" /> {label}
              </Button>
            </Link>
          ))}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {['Active', 'Idle', 'Maintenance', 'Offline'].map(s => {
            const sc = statusConfig[s];
            const count = drones.filter(d => d.status === s).length;
            return (
              <div key={s} className={`bg-card rounded-xl border shadow-sm p-4 text-center`}>
                <p className={`text-3xl font-bold ${sc.text}`}>{count}</p>
                <p className="text-xs text-muted-foreground mt-1">{s}</p>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="bg-card rounded-xl border shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, serial, owner..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 rounded-xl h-9"
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="rounded-xl border px-3 h-9 text-sm bg-background"
          >
            <option value="all">All Status</option>
            {['Active', 'Idle', 'Maintenance', 'Offline'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <span className="text-sm text-muted-foreground">{filtered.length} drones</span>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Bot className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No drones found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-amber-50/50">
                  <TableHead>Name</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Serial</TableHead>
                  <TableHead>Firmware</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Predictions</TableHead>
                  <TableHead>Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(drone => {
                  const sc = statusConfig[drone.status] || statusConfig.Offline;
                  return (
                    <TableRow key={drone.id} className="hover:bg-accent/20 transition-colors">
                      <TableCell className="font-semibold">{drone.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                            {drone.owner_username?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm">@{drone.owner_username}</p>
                            <p className="text-xs text-muted-foreground">{drone.owner_email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{drone.model}</TableCell>
                      <TableCell className="text-xs font-mono">{drone.serial_number}</TableCell>
                      <TableCell className="text-xs">{drone.firmware_version}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.color}`} />
                          {drone.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-sm">{drone.prediction_count ?? 0}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(drone.created_at)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <AppFooter />
      </div>
    </div>
  );
};

export default AdminDrones;
