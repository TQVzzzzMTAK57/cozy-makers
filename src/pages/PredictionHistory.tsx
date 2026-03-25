import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Eye, Trash2, AlertCircle, Film, ChevronLeft, Clock, SlidersHorizontal } from "lucide-react";
import { isAuthenticated } from "@/lib/auth";
import { api, type PredictionAPI, type DroneAPI } from "@/lib/api";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import { useToast } from "@/hooks/use-toast";

const PredictionHistory = () => {
  const { droneId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [predictions, setPredictions] = useState<PredictionAPI[]>([]);
  const [drone, setDrone] = useState<DroneAPI | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<PredictionAPI | null>(null);
  const [confThreshold, setConfThreshold] = useState(0);

  const filteredPredictions = predictions.filter(p => {
    if (confThreshold === 0) return true;
    if (!p.has_result || p.detections.length === 0) return false;
    return p.detections.some(d => d.confidence * 100 >= confThreshold);
  });

  useEffect(() => {
    if (!isAuthenticated()) { navigate("/login"); return; }
    if (!droneId) return;

    const load = async () => {
      try {
        setLoading(true);
        const [droneData, predsData] = await Promise.all([
          api.drones.list().then(d => d.find(x => x.id === Number(droneId)) || null),
          api.predictions.list(Number(droneId)),
        ]);
        setDrone(droneData);
        setPredictions(predsData);
      } catch {
        toast({ title: "Error", description: "Failed to load predictions", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [droneId, navigate, toast]);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await api.predictions.delete(deleteConfirm.id);
      setPredictions(prev => prev.filter(p => p.id !== deleteConfirm.id));
      toast({ title: "Deleted", description: "Prediction deleted" });
      setDeleteConfirm(null);
    } catch {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  };

  const formatDate = (str: string) => {
    try { return new Date(str).toLocaleString('vi-VN'); } catch { return str; }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="bg-card rounded-xl border shadow-sm p-6 mb-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/dashboard")}
                className="rounded-full gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Prediction History
                </h1>
                {drone && <p className="text-sm text-muted-foreground">Drone: <span className="font-medium">{drone.name}</span> • {drone.model}</p>}
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Confidence Filter */}
              <div className="hidden sm:flex items-center gap-3 bg-secondary/60 rounded-xl px-4 py-2 min-w-[220px]">
                <SlidersHorizontal className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Min Confidence</span>
                    <span className="font-semibold text-primary">
                      {confThreshold === 0 ? 'All' : `≥${confThreshold}%`}
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={95}
                    step={5}
                    value={[confThreshold]}
                    onValueChange={([v]) => setConfThreshold(v)}
                    className="w-full"
                  />
                </div>
              </div>
              <Button
                className="rounded-full gap-1"
                onClick={() => navigate(`/upload/${droneId}`)}
              >
                <Plus className="w-4 h-4" /> Upload Video
              </Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Videos', value: predictions.length },
            { label: 'With Results', value: predictions.filter(p => p.has_result).length },
            { label: 'With Feedback', value: predictions.filter(p => p.feedback_accurate !== null).length },
            { label: confThreshold === 0 ? 'Showing All' : `≥${confThreshold}% conf`, value: filteredPredictions.length, highlight: confThreshold > 0 },
          ].map(({ label, value, highlight }) => (
            <div key={label} className={`rounded-xl border shadow-sm p-4 text-center animate-fade-in transition-colors ${
              highlight ? 'bg-primary/10 border-primary/30' : 'bg-card'
            }`}>
              <p className={`text-3xl font-bold ${highlight ? 'text-primary' : 'text-primary'}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* No predictions */}
        {!loading && predictions.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 mb-6 text-center animate-fade-in">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
            <p className="font-semibold text-amber-800">No predictions yet</p>
            <p className="text-sm text-amber-600 mt-1">Upload a video to start AI drowning detection analysis</p>
            <Button
              className="mt-4 rounded-full"
              onClick={() => navigate(`/upload/${droneId}`)}
            >
              <Plus className="w-4 h-4 mr-1" /> Upload First Video
            </Button>
          </div>
        )}

        {loading ? (
          <div className="bg-card rounded-xl border shadow-sm p-12 text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Loading predictions...</p>
          </div>
        ) : predictions.length > 0 && (
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden animate-slide-up">
            {filteredPredictions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <SlidersHorizontal className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No predictions match the confidence filter</p>
                <p className="text-sm mt-1">Try lowering the minimum confidence threshold</p>
                <button
                  className="text-xs text-primary underline mt-2"
                  onClick={() => setConfThreshold(0)}
                >Reset filter</button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50">
                    <TableHead className="w-12">No.</TableHead>
                    <TableHead>Video Name</TableHead>
                    <TableHead>Uploaded At</TableHead>
                    <TableHead>Preview</TableHead>
                    <TableHead>Detections</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPredictions.map((p, idx) => (
                    <TableRow key={p.id} className="hover:bg-accent/30 transition-colors">
                      <TableCell className="font-medium text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Film className="w-4 h-4 text-primary flex-shrink-0" />
                          <span className="font-medium text-sm truncate max-w-[200px]">{p.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{formatDate(p.uploaded_at)}</span>
                      </TableCell>
                      <TableCell>
                        {p.video_url ? (
                          <video
                            src={p.video_url}
                            className="w-28 h-16 object-cover rounded-lg bg-black"
                            muted
                          />
                        ) : (
                          <div className="w-28 h-16 bg-muted rounded-lg flex items-center justify-center">
                            <Film className="w-6 h-6 text-muted-foreground/50" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {p.has_result && p.detections.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {p.detections
                              .filter(d => confThreshold === 0 || d.confidence * 100 >= confThreshold)
                              .map((d, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-medium"
                                >
                                  {d.label} {(d.confidence * 100).toFixed(0)}%
                                </span>
                              ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            className="text-xs rounded-lg h-8 px-3"
                            onClick={() => navigate(`/result/${p.id}`)}
                          >
                            <Eye className="w-3 h-3 mr-1" /> Result
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="text-xs rounded-lg h-8 px-3"
                            onClick={() => setDeleteConfirm(p)}
                          >
                            <Trash2 className="w-3 h-3 mr-1" /> Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}

        <AppFooter />

        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>⚠️ Delete Prediction</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">Are you sure you want to delete this prediction? The video file will also be deleted.</p>
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
