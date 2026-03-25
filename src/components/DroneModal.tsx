import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Save } from "lucide-react";
import { type DroneAPI } from "@/lib/api";

interface DroneModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string; serialNumber: string; model: string; firmwareVersion: string; status: string }) => void;
  drone?: DroneAPI | null;
  mode: 'add' | 'edit';
}

const MODELS = ['DJI Mavic 3', 'DJI Phantom 4', 'DJI Mini 3', 'DJI Air 2S', 'DJI Agras T30', 'Parrot ANAFI'];
const FIRMWARES: Record<string, string[]> = {
  'DJI Mavic 3': ['v01.00.01.05', 'v01.00.00.10', 'v02.00.00.10'],
  'DJI Phantom 4': ['v1.5.1', 'v1.6.0', 'v2.0.0'],
  'DJI Mini 3': ['v01.00.01.00', 'v01.00.02.00'],
  'DJI Air 2S': ['v01.04.06.00', 'v01.04.04.00'],
  'DJI Agras T30': ['v3.0.0', 'v2.5.0'],
  'Parrot ANAFI': ['v1.8.0', 'v1.7.0', 'v1.9.0'],
};
const DEFAULT_FIRMWARE = 'v1.0.0';

const DroneModal = ({ open, onClose, onSave, drone, mode }: DroneModalProps) => {
  const [name, setName] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [model, setModel] = useState("");
  const [firmwareVersion, setFirmwareVersion] = useState("");
  const [status, setStatus] = useState("Idle");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (drone) {
      setName(drone.name);
      setSerialNumber(drone.serial_number);
      setModel(drone.model);
      setFirmwareVersion(drone.firmware_version);
      setStatus(drone.status);
    } else {
      setName("");
      setSerialNumber("");
      setModel("");
      setFirmwareVersion("");
      setStatus("Idle");
    }
  }, [drone, open]);

  const availableFirmwares = model ? (FIRMWARES[model] || [DEFAULT_FIRMWARE]) : [];

  const handleModelChange = (m: string) => {
    setModel(m);
    const fws = FIRMWARES[m] || [DEFAULT_FIRMWARE];
    setFirmwareVersion(fws[0] || '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({ name, serialNumber, model, firmwareVersion, status });
    } finally {
      setLoading(false);
    }
  };

  const statusOptions = [
    { value: 'Idle', color: 'bg-yellow-400', label: 'Idle' },
    { value: 'Active', color: 'bg-green-500', label: 'Active' },
    { value: 'Maintenance', color: 'bg-red-500', label: 'Maintenance' },
    { value: 'Offline', color: 'bg-gray-400', label: 'Offline' },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            {mode === 'add' ? 'Register New Drone' : 'Edit Drone'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="font-medium">Drone Name <span className="text-destructive">*</span></Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Drone Alpha-1"
              required
              className="rounded-xl h-11"
            />
          </div>

          <div className="space-y-2">
            <Label className="font-medium">Serial Number <span className="text-destructive">*</span></Label>
            <Input
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="e.g. SN-2024-001"
              required
              className="rounded-xl h-11"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-medium">Model <span className="text-destructive">*</span></Label>
              <Select value={model} onValueChange={handleModelChange} required>
                <SelectTrigger className="rounded-xl h-11">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="font-medium">Firmware</Label>
              <Select value={firmwareVersion} onValueChange={setFirmwareVersion} disabled={!model}>
                <SelectTrigger className="rounded-xl h-11">
                  <SelectValue placeholder={model ? "Select firmware" : "Select model first"} />
                </SelectTrigger>
                <SelectContent>
                  {availableFirmwares.map(f => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-medium">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="rounded-xl h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(s => (
                  <SelectItem key={s.value} value={s.value}>
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${s.color}`} />
                      {s.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl" disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" className="rounded-xl gap-2 min-w-[120px]" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </span>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {mode === 'add' ? 'Register' : 'Update'}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DroneModal;
