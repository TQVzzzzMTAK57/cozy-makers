import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Drone } from "@/lib/drone-store";

interface DroneModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Omit<Drone, 'id'>) => void;
  drone?: Drone | null;
  mode: 'add' | 'edit' | 'connect';
}

const models = ['DJI Mavic 3', 'DJI Phantom 4', 'DJI Mini 3', 'DJI Air 2S'];
const firmwares = ['v1.0.0', 'v1.5.1', 'v2.0.3', 'v2.1.0'];

const DroneModal = ({ open, onClose, onSave, drone, mode }: DroneModalProps) => {
  const [name, setName] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [model, setModel] = useState("");
  const [firmwareVersion, setFirmwareVersion] = useState("");
  const [status, setStatus] = useState<Drone['status']>("Idle");

  useEffect(() => {
    if (drone) {
      setName(drone.name);
      setSerialNumber(drone.serialNumber);
      setModel(drone.model);
      setFirmwareVersion(drone.firmwareVersion);
      setStatus(drone.status);
    } else {
      setName("");
      setSerialNumber("");
      setModel("");
      setFirmwareVersion("");
      setStatus("Idle");
    }
  }, [drone, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, serialNumber, model, firmwareVersion, status });
  };

  const titles = { add: "Add New Drone", edit: "Edit Drone", connect: "Connect Drone" };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🤖 {titles[mode]}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Drone name" required />
          </div>
          <div className="space-y-2">
            <Label>Serial Number</Label>
            <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder="Enter serial number" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger><SelectValue placeholder="Select model" /></SelectTrigger>
                <SelectContent>
                  {models.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Firmware Version</Label>
              <Select value={firmwareVersion} onValueChange={setFirmwareVersion}>
                <SelectTrigger><SelectValue placeholder="Select firmware" /></SelectTrigger>
                <SelectContent>
                  {firmwares.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as Drone['status'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['Idle', 'Active', 'Maintenance', 'Offline'].map(s => (
                  <SelectItem key={s} value={s}>
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${s === 'Idle' ? 'bg-warning' : s === 'Active' ? 'bg-success' : s === 'Maintenance' ? 'bg-destructive' : 'bg-muted-foreground'}`} />
                      {s}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit">
              {mode === 'connect' ? 'Connect' : mode === 'add' ? '💾 Save Drone' : '💾 Update'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DroneModal;
