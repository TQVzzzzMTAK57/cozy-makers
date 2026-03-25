import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wifi, WifiOff, Target, Signal, Camera } from "lucide-react";
import { type DroneAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface ConnectDroneModalProps {
  drone: DroneAPI | null;
  open: boolean;
  onClose: () => void;
}

const MOCK_DETECTIONS = [
  { label: 'swimmer', confidence: 0.87, active: true },
  { label: 'boat', confidence: 0.72, active: false },
];

const ConnectDroneModal = ({ drone, open, onClose }: ConnectDroneModalProps) => {
  const { toast } = useToast();
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [signal, setSignal] = useState(0);
  const [frames, setFrames] = useState(0);
  const [detections, setDetections] = useState<typeof MOCK_DETECTIONS>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) {
      setConnecting(false);
      setConnected(false);
      setSignal(0);
      setFrames(0);
      setDetections([]);
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [open]);

  const handleConnect = () => {
    setConnecting(true);
    setTimeout(() => {
      setConnecting(false);
      setConnected(true);
      setSignal(75 + Math.floor(Math.random() * 20));
      setDetections(MOCK_DETECTIONS);
      toast({ title: "✅ Connected", description: `Connected to ${drone?.name}` });

      // Simulate frame count
      intervalRef.current = setInterval(() => {
        setFrames(f => f + 30);
        setSignal(prev => Math.max(60, Math.min(98, prev + (Math.random() > 0.5 ? 1 : -1) * 3)));
      }, 1000);
    }, 2000);
  };

  const handleDisconnect = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setConnected(false);
    setFrames(0);
    setSignal(0);
    setDetections([]);
    toast({ title: "Disconnected", description: `Disconnected from ${drone?.name}` });
  };

  if (!drone) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="w-5 h-5 text-primary" />
            Connect to {drone.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drone info */}
          <div className="grid grid-cols-2 gap-3 text-sm bg-accent/50 rounded-xl p-4">
            <div>
              <p className="text-muted-foreground text-xs">Model</p>
              <p className="font-medium">{drone.model}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Serial</p>
              <p className="font-medium">{drone.serial_number}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Firmware</p>
              <p className="font-medium">{drone.firmware_version}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Status</p>
              <Badge variant={drone.status === 'Active' ? 'default' : 'secondary'} className="text-xs">
                {drone.status}
              </Badge>
            </div>
          </div>

          {/* Live feed simulation */}
          <div className={`rounded-xl overflow-hidden border-2 transition-all ${connected ? 'border-green-400' : 'border-border'}`}>
            <div className={`aspect-video relative flex items-center justify-center ${connected ? 'bg-slate-900' : 'bg-slate-800'}`}>
              {connecting && (
                <div className="text-center text-white space-y-3 animate-fade-in">
                  <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                  <p className="text-sm font-medium">Establishing connection...</p>
                  <p className="text-xs opacity-50">{drone.name} • {drone.serial_number}</p>
                </div>
              )}

              {connected && (
                <div className="absolute inset-0 animate-fade-in">
                  {/* Simulated video feed with gradient */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-900/80 via-slate-800 to-cyan-900/60" />

                  {/* Grid overlay */}
                  <div className="absolute inset-0 opacity-10"
                    style={{
                      backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
                      backgroundSize: '40px 40px',
                    }}
                  />

                  {/* Scan line */}
                  <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent animate-[scan-line_3s_linear_infinite]" />

                  {/* Detection boxes */}
                  {detections.filter(d => d.active).map((d, i) => (
                    <div
                      key={i}
                      className="absolute border-2 border-cyan-400 rounded-sm"
                      style={{ left: '35%', top: '30%', width: '25%', height: '35%' }}
                    >
                      <span className="absolute -top-5 left-0 text-cyan-400 text-xs font-mono bg-black/60 px-1 rounded">
                        {d.label} {(d.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}

                  {/* Corner brackets */}
                  {['top-2 left-2', 'top-2 right-2', 'bottom-2 left-2', 'bottom-2 right-2'].map((pos) => (
                    <div key={pos} className={`absolute ${pos} w-4 h-4 border-cyan-400/50`}
                      style={{
                        borderTop: pos.includes('top') ? '2px solid' : 'none',
                        borderBottom: pos.includes('bottom') ? '2px solid' : 'none',
                        borderLeft: pos.includes('left') ? '2px solid' : 'none',
                        borderRight: pos.includes('right') ? '2px solid' : 'none',
                      }}
                    />
                  ))}

                  {/* HUD overlays */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="flex items-center gap-1 text-red-400 text-xs font-mono bg-black/60 px-2 py-0.5 rounded">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-blink" />
                      LIVE
                    </span>
                    <span className="text-cyan-300 text-xs font-mono bg-black/60 px-2 py-0.5 rounded">
                      {frames} frames
                    </span>
                  </div>

                  <div className="absolute top-3 right-3 flex items-center gap-1 text-green-400 text-xs font-mono bg-black/60 px-2 py-0.5 rounded">
                    <Signal className="w-3 h-3" />
                    {signal}%
                  </div>

                  <div className="absolute bottom-3 left-3 text-cyan-300/60 text-xs font-mono">{drone.name} • AI Detection Active</div>
                  <div className="absolute bottom-3 right-3 flex items-center gap-1 text-cyan-300/60 text-xs font-mono">
                    <Camera className="w-3 h-3" /> 30fps
                  </div>
                </div>
              )}

              {!connecting && !connected && (
                <div className="text-center text-white/50 space-y-2">
                  <WifiOff className="w-12 h-12 mx-auto opacity-30" />
                  <p className="text-sm">Not connected</p>
                </div>
              )}
            </div>
          </div>

          {/* Signal bar */}
          {connected && (
            <div className="space-y-1 animate-fade-in">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Signal Strength</span>
                <span className="font-medium text-green-600">{signal}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-1000"
                  style={{ width: `${signal}%` }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {!connected ? (
              <Button
                className="flex-1 rounded-xl"
                onClick={handleConnect}
                disabled={connecting}
              >
                {connecting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Connecting...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Wifi className="w-4 h-4" /> Connect
                  </span>
                )}
              </Button>
            ) : (
              <Button variant="destructive" className="flex-1 rounded-xl" onClick={handleDisconnect}>
                <WifiOff className="w-4 h-4 mr-2" /> Disconnect
              </Button>
            )}
            <Button variant="outline" className="rounded-xl" onClick={onClose}>Close</Button>
          </div>

          {/* Detections panel */}
          {connected && detections.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 animate-fade-in">
              <p className="text-xs font-semibold text-blue-800 mb-2 flex items-center gap-1">
                <Target className="w-3 h-3" /> AI Detection Active
              </p>
              <div className="flex flex-wrap gap-2">
                {detections.map((d, i) => (
                  <span
                    key={i}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${d.active ? 'bg-cyan-100 text-cyan-800 border border-cyan-300' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {d.label}: {(d.confidence * 100).toFixed(0)}%
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConnectDroneModal;
