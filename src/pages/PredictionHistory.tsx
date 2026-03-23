import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Eye, Trash2, AlertCircle } from "lucide-react";
import { getDrone, getPredictions, deletePrediction, type Prediction } from "@/lib/drone-store";
import { isAuthenticated } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";

const PredictionHistory = () => {
  const { droneId } = useParams();
  const navigate = useNavigate();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [droneName, setDroneName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<Prediction | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) { navigate("/login"); return; }
    const id = Number(droneId);
    const drone = getDrone(id);
    if (drone) setDroneName(drone.name);
    setPredictions(getPredictions(id));
  }, [droneId, navigate]);

  const refresh = () => setPredictions(getPredictions(Number(droneId)));

  const handleDelete = () => {
    if (deleteConfirm) {
      deletePrediction(deleteConfirm.id);
      setDeleteConfirm(null);
      refresh();
    }
  };

  return (
    <div className="min-h-screen bg-primary/10 p-6">
      <div className="container mx-auto max-w-5xl">
        <div className="bg-card rounded-xl border shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="rounded-full">← Back</Button>
              <h1 className="text-xl font-bold">🕐 History Predictions of Drone - {droneName}</h1>
            </div>
            <div className="flex gap-3">
              <Button size="sm" className="rounded-full" onClick={() => navigate(`/upload/${droneId}`)}>
                <Plus className="w-4 h-4 mr-1" /> New Video
              </Button>
            </div>
          </div>
        </div>

        {predictions.length === 0 ? (
          <div className="bg-warning/10 border border-warning/30 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-warning" />
              <div>
                <p className="font-semibold">No predictions found</p>
                <p className="text-sm text-muted-foreground">Your Drone haven't sent any videos yet. Try creating a new prediction by uploading.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-card rounded-xl border shadow-sm p-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">No.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Uploaded at</TableHead>
                  <TableHead>Video</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {predictions.map((p, idx) => (
                  <TableRow key={p.id}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.uploadedAt}</TableCell>
                    <TableCell>
                      <div className="w-32 h-20 bg-muted rounded-lg flex items-center justify-center text-xs text-muted-foreground">
                        🎬 Video
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" className="rounded-full text-xs" onClick={() => navigate(`/result/${p.id}`)}>
                          <Eye className="w-3 h-3 mr-1" /> View Result
                        </Button>
                        <Button size="sm" variant="destructive" className="rounded-full text-xs" onClick={() => setDeleteConfirm(p)}>
                          <Trash2 className="w-3 h-3 mr-1" /> Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <AppFooter />

        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>⚠️ Delete Confirmation</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">Are you sure you want to delete this prediction?</p>
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

export default PredictionHistory;
