import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Users, Shield, UserX, Trash2, Search, BarChart3, Bot, Activity,
  ChevronDown, CheckCircle, XCircle, Crown
} from "lucide-react";
import { isAuthenticated } from "@/lib/auth";
import { api, type User } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";

const AdminUsers = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'user'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setUsers(await api.admin.users.list());
    } catch {
      toast({ title: "Error", description: "Failed to load users", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!isAuthenticated()) { navigate("/login"); return; }
    load();
  }, [navigate, load]);

  const handleSetRole = async (user: User, role: 'admin' | 'user') => {
    try {
      await api.admin.users.setRole(user.id, role);
      toast({ title: `✅ Role changed`, description: `${user.username} → ${role}` });
      load();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      await api.admin.users.setStatus(user.id, !user.is_active);
      toast({ title: user.is_active ? "User deactivated" : "User activated" });
      load();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.admin.users.delete(deleteTarget.id);
      toast({ title: "User deleted", description: `${deleteTarget.username} has been deleted` });
      setDeleteTarget(null);
      load();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    }
  };

  const filtered = users.filter(u => {
    const matchSearch = u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.full_name || '').toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === 'all' || u.role === filterRole;
    const matchStatus = filterStatus === 'all' || (filterStatus === 'active' ? u.is_active : !u.is_active);
    return matchSearch && matchRole && matchStatus;
  });

  const formatDate = (s: string) => { try { return new Date(s).toLocaleDateString('vi-VN'); } catch { return s; } };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-amber-50/30 p-6">
      <div className="container mx-auto max-w-7xl">
        <AppHeader title="User Management 👥" />

        {/* Admin Nav */}
        <div className="flex gap-3 mb-6 flex-wrap">
          {[
            { label: 'Overview', href: '/admin', icon: BarChart3 },
            { label: 'Users', href: '/admin/users', icon: Users, active: true },
            { label: 'All Drones', href: '/admin/drones', icon: Bot },
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
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Users', value: users.length, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Admins', value: users.filter(u => u.role === 'admin').length, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Inactive', value: users.filter(u => !u.is_active).length, color: 'text-red-600', bg: 'bg-red-50' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className="bg-card rounded-xl border shadow-sm p-4 text-center">
              <p className={`text-3xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-card rounded-xl border shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by username, email, name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 rounded-xl h-9"
            />
          </div>
          <select
            value={filterRole}
            onChange={e => setFilterRole(e.target.value as typeof filterRole)}
            className="rounded-xl border px-3 h-9 text-sm bg-background"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}
            className="rounded-xl border px-3 h-9 text-sm bg-background"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <span className="text-sm text-muted-foreground">{filtered.length} users</span>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden animate-slide-up">
          {loading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Loading users...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-amber-50/50">
                  <TableHead className="w-10">ID</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Drones</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(user => (
                  <TableRow key={user.id} className="hover:bg-accent/20 transition-colors">
                    <TableCell className="text-xs text-muted-foreground font-mono">#{user.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {user.username[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{user.full_name || user.username}</p>
                          <p className="text-xs text-muted-foreground">@{user.username} • {user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        user.role === 'admin'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        {user.role === 'admin' ? <Crown className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                        {user.role}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                        user.is_active
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {user.is_active ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-center">{user.drone_count ?? 0}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(user.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1.5">
                        {/* Role toggle */}
                        <div className="relative group">
                          <Button size="sm" variant="outline" className="text-xs h-7 px-2 gap-1 rounded-lg">
                            <Shield className="w-3 h-3" />
                            <ChevronDown className="w-3 h-3" />
                          </Button>
                          <div className="absolute right-0 top-full mt-1 bg-card border rounded-xl shadow-lg hidden group-hover:block z-10 w-36">
                            <button
                              onClick={() => handleSetRole(user, 'admin')}
                              disabled={user.role === 'admin'}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-amber-50 hover:text-amber-700 flex items-center gap-2 disabled:opacity-40"
                            >
                              <Crown className="w-3 h-3" /> Make Admin
                            </button>
                            <button
                              onClick={() => handleSetRole(user, 'user')}
                              disabled={user.role === 'user'}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 disabled:opacity-40"
                            >
                              <Users className="w-3 h-3" /> Make User
                            </button>
                          </div>
                        </div>

                        {/* Toggle active */}
                        <Button
                          size="sm"
                          variant={user.is_active ? "outline" : "default"}
                          className={`text-xs h-7 px-2 rounded-lg ${user.is_active ? 'text-orange-600 border-orange-200 hover:bg-orange-50' : 'bg-green-600 hover:bg-green-700'}`}
                          onClick={() => handleToggleStatus(user)}
                        >
                          {user.is_active ? <UserX className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                        </Button>

                        {/* Delete */}
                        <Button
                          size="sm"
                          variant="destructive"
                          className="text-xs h-7 px-2 rounded-lg"
                          onClick={() => setDeleteTarget(user)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <AppFooter />

        <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-destructive flex items-center gap-2">
                <Trash2 className="w-5 h-5" /> Delete User
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm">Delete user <strong>@{deleteTarget?.username}</strong>?</p>
            <p className="text-sm text-muted-foreground">All their drones and predictions will also be deleted.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default AdminUsers;
