import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Eye, Pencil, Trash2, Wifi, Bot, Activity, Server, RefreshCw } from "lucide-react";
import { isAuthenticated, getUser } from "@/lib/auth";
import { api, type DroneAPI } from "@/lib/api";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import DroneModal from "@/components/DroneModal";
import ConnectDroneModal from "@/components/ConnectDroneModal";
import { useToast } from "@/hooks/use-toast";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [drones, setDrones] = useState<DroneAPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedDrone, setSelectedDrone] = useState<DroneAPI | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DroneAPI | null>(null);
  const [connectDrone, setConnectDrone] = useState<DroneAPI | null>(null);
  const user = getUser();

  const fetchDrones = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.drones.list();
      setDrones(data);
    } catch {
      toast({ title: "Error", description: "Failed to load drones", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!isAuthenticated()) { navigate("/login"); return; }
    fetchDrones();
  }, [navigate, fetchDrones]);

  const handleAdd = () => { setSelectedDrone(null); setModalMode('add'); setModalOpen(true); };
  const handleEdit = (d: DroneAPI) => { setSelectedDrone(d); setModalMode('edit'); setModalOpen(true); };

  const handleSave = async (data: { name: string; serialNumber: string; model: string; firmwareVersion: string; status: string }) => {
    try {
      if (modalMode === 'edit' && selectedDrone) {
        await api.drones.update(selectedDrone.id, data);
        toast({ title: "✅ Updated", description: `Drone "${data.name}" updated successfully` });
      } else {
        await api.drones.create(data);
        toast({ title: "✅ Added", description: `Drone "${data.name}" added successfully` });
      }
      setModalOpen(false);
      fetchDrones();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to save", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await api.drones.delete(deleteConfirm.id);
      toast({ title: "🗑️ Deleted", description: `Drone "${deleteConfirm.name}" deleted` });
      setDeleteConfirm(null);
      fetchDrones();
    } catch {
      toast({ title: "Error", description: "Failed to delete drone", variant: "destructive" });
    }
  };

  const statusConfig = {
    Idle: { color: 'bg-yellow-400', text: 'text-yellow-700', bg: 'bg-yellow-50', label: 'Idle' },
    Active: { color: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50', label: 'Active' },
    Maintenance: { color: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50', label: 'Maintenance' },
    Offline: { color: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-50', label: 'Offline' },
  };

  const stats = [
    { label: 'Total Drones', value: drones.length, icon: Bot, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Active', value: drones.filter(d => d.status === 'Active').length, icon: Activity, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Idle', value: drones.filter(d => d.status === 'Idle').length, icon: Server, color: 'text-yellow-600', bg: 'bg-yellow-50' },
    { label: 'Maintenance', value: drones.filter(d => d.status === 'Maintenance').length, icon: RefreshCw, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="container mx-auto max-w-6xl">
        <AppHeader title={`Welcome back, ${user?.username || 'User'} 👋`} onNewDrone={handleAdd} />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {stats.map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-card rounded-xl border shadow-sm p-5 card-hover animate-fade-in">
              <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Drone List */}
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden animate-slide-up">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              Drone Fleet
            </h2>
            <span className="text-sm text-muted-foreground">{drones.length} drone{drones.length !== 1 ? 's' : ''} registered</span>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Loading drones...</p>
            </div>
          ) : drones.length === 0 ? (
            <div className="p-12 text-center">
              <Bot className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <p className="font-semibold text-muted-foreground">No drones registered yet</p>
              <p className="text-sm text-muted-foreground mt-1">Click "+ New Drone" to add your first drone</p>
              <Button onClick={handleAdd} className="mt-4 rounded-full">Add First Drone</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  <TableHead className="w-12">No.</TableHead>
                  <TableHead>Ready to FLY</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Model / Serial</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drones.map((drone, idx) => {
                  const sc = statusConfig[drone.status] || statusConfig.Offline;
                  return (
                    <TableRow key={drone.id} className="hover:bg-accent/30 transition-colors">
                      <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full text-xs border-primary/30 text-primary hover:bg-primary hover:text-white transition-all"
                          onClick={() => setConnectDrone(drone)}
                        >
                          <Wifi className="w-3 h-3 mr-1" /> Connect
                        </Button>
                      </TableCell>
                      <TableCell className="font-semibold">{drone.name}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p className="font-medium">{drone.model}</p>
                          <p className="text-xs text-muted-foreground">{drone.serial_number}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.color} ${drone.status === 'Active' ? 'animate-blink' : ''}`} />
                          {sc.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs rounded-lg h-8 px-3"
                            onClick={() => navigate(`/predictions/${drone.id}`)}
                          >
                            <Eye className="w-3 h-3 mr-1" /> View
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs rounded-lg h-8 px-3"
                            onClick={() => handleEdit(drone)}
                          >
                            <Pencil className="w-3 h-3 mr-1" /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="text-xs rounded-lg h-8 px-3"
                            onClick={() => setDeleteConfirm(drone)}
                          >
                            <Trash2 className="w-3 h-3 mr-1" /> Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <AppFooter />

        <DroneModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          drone={selectedDrone}
          mode={modalMode}
        />

        <ConnectDroneModal
          drone={connectDrone}
          open={!!connectDrone}
          onClose={() => setConnectDrone(null)}
        />

        {/* Delete Confirmation */}
        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="w-5 h-5" /> Delete Drone
              </DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <p className="text-sm">Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>?</p>
              <p className="text-sm text-muted-foreground mt-1">This will delete all predictions associated with this drone. This action cannot be undone.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Dashboard;
