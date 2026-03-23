import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Eye, Pencil, Trash2, Plug } from "lucide-react";
import { getDrones, addDrone, updateDrone, deleteDrone, type Drone } from "@/lib/drone-store";
import { isAuthenticated } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import DroneModal from "@/components/DroneModal";

const Dashboard = () => {
  const navigate = useNavigate();
  const [drones, setDrones] = useState<Drone[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | 'connect'>('add');
  const [selectedDrone, setSelectedDrone] = useState<Drone | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Drone | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) { navigate("/login"); return; }
    setDrones(getDrones());
  }, [navigate]);

  const refresh = () => setDrones(getDrones());

  const handleAdd = () => { setSelectedDrone(null); setModalMode('add'); setModalOpen(true); };
  const handleEdit = (d: Drone) => { setSelectedDrone(d); setModalMode('edit'); setModalOpen(true); };
  const handleConnect = (d: Drone) => { setSelectedDrone(d); setModalMode('connect'); setModalOpen(true); };

  const handleSave = (data: Omit<Drone, 'id'>) => {
    if (modalMode === 'edit' && selectedDrone) {
      updateDrone(selectedDrone.id, data);
    } else {
      addDrone(data);
    }
    setModalOpen(false);
    refresh();
  };

  const handleDelete = () => {
    if (deleteConfirm) {
      deleteDrone(deleteConfirm.id);
      setDeleteConfirm(null);
      refresh();
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'Idle': return 'bg-warning';
      case 'Active': return 'bg-success';
      case 'Maintenance': return 'bg-destructive';
      default: return 'bg-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-primary/10 p-6">
      <div className="container mx-auto max-w-5xl">
        <AppHeader title="Home" onNewDrone={handleAdd} />

        <div className="bg-card rounded-xl border shadow-sm p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">🤖 Drone List</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">No.</TableHead>
                <TableHead>Ready to FLY</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drones.map((drone, idx) => (
                <TableRow key={drone.id}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" className="rounded-full text-xs" onClick={() => handleConnect(drone)}>
                      <Plug className="w-3 h-3 mr-1" /> Connect
                    </Button>
                  </TableCell>
                  <TableCell className="font-medium">{drone.name}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${statusColor(drone.status)}`} />
                      {drone.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="text-xs rounded-full" onClick={() => navigate(`/predictions/${drone.id}`)}>
                        <Eye className="w-3 h-3 mr-1" /> View
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs rounded-full" onClick={() => handleEdit(drone)}>
                        <Pencil className="w-3 h-3 mr-1" /> Edit
                      </Button>
                      <Button size="sm" variant="destructive" className="text-xs rounded-full" onClick={() => setDeleteConfirm(drone)}>
                        <Trash2 className="w-3 h-3 mr-1" /> Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <AppFooter />

        <DroneModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} drone={selectedDrone} mode={modalMode} />

        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>⚠️ Delete Confirmation</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this drone? This action cannot be undone.
            </p>
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
