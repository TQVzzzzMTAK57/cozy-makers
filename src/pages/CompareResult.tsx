import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Clock, Target, Layers, Trophy, ArrowLeftRight } from "lucide-react";
import { api, type PredictionAPI } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import AppFooter from "@/components/AppFooter";

const SERVER = "http://localhost:3001";
const img = (url?: string | null) => url ? `${SERVER}${url}` : "";

const CompareResult = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const id11 = Number(params.get("y11") || 0);
  const id26 = Number(params.get("y26") || 0);

  const [p11, setP11] = useState<PredictionAPI | null>(null);
  const [p26, setP26] = useState<PredictionAPI | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncHover, setSyncHover] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) { navigate("/login"); return; }
    if (!id11 || !id26) return;
    Promise.all([api.predictions.get(id11), api.predictions.get(id26)])
      .then(([a, b]) => { setP11(a); setP26(b); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id11, id26, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!p11 || !p26) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Comparison data not found.</p>
      </div>
    );
  }

  const panels = [
    { label: "YOLO11", sub: "best4.pt", pred: p11, color: "from-blue-600 to-indigo-600", badge: "bg-blue-100 text-blue-700" },
    { label: "YOLO26", sub: "best_yolo26.pt", pred: p26, color: "from-purple-600 to-pink-600", badge: "bg-purple-100 text-purple-700" },
  ] as const;

  // Determine winner for each metric
  const winner = {
    detections: p11.detections.length > p26.detections.length ? 0 : p11.detections.length < p26.detections.length ? 1 : -1,
    speed: (p11.elapsed_seconds || 99) < (p26.elapsed_seconds || 99) ? 0 : (p11.elapsed_seconds || 99) > (p26.elapsed_seconds || 99) ? 1 : -1,
    avgConf: (() => {
      const avg11 = p11.detections.length ? p11.detections.reduce((s, d) => s + d.confidence, 0) / p11.detections.length : 0;
      const avg26 = p26.detections.length ? p26.detections.reduce((s, d) => s + d.confidence, 0) / p26.detections.length : 0;
      return avg11 > avg26 ? 0 : avg11 < avg26 ? 1 : -1;
    })(),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-6">
      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="outline" size="sm" className="rounded-full gap-1" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-4 h-4" /> Quay lại
          </Button>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-primary" />
            So sánh mô hình
          </h1>
          <div />
        </div>

        {/* Stat comparison bar */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {([
            { label: "Detections", v11: p11.detections.length, v26: p26.detections.length, win: winner.detections, icon: Target },
            { label: "Avg Confidence", v11: p11.detections.length ? (p11.detections.reduce((s,d)=>s+d.confidence,0)/p11.detections.length*100).toFixed(1)+'%' : '—', v26: p26.detections.length ? (p26.detections.reduce((s,d)=>s+d.confidence,0)/p26.detections.length*100).toFixed(1)+'%' : '—', win: winner.avgConf, icon: Layers },
            { label: "Speed", v11: p11.elapsed_seconds ? p11.elapsed_seconds+'s' : '—', v26: p26.elapsed_seconds ? p26.elapsed_seconds+'s' : '—', win: winner.speed, icon: Clock },
          ] as const).map(({ label, v11, v26, win, icon: Icon }) => (
            <div key={label} className="bg-card border rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                <Icon className="w-3.5 h-3.5" /> {label}
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div className={`text-right font-bold text-lg ${win === 0 ? 'text-blue-600' : ''}`}>
                  {v11}
                  {win === 0 && <Trophy className="w-3.5 h-3.5 inline-block ml-1 text-yellow-500" />}
                </div>
                <span className="text-xs text-muted-foreground">vs</span>
                <div className={`font-bold text-lg ${win === 1 ? 'text-purple-600' : ''}`}>
                  {v26}
                  {win === 1 && <Trophy className="w-3.5 h-3.5 inline-block ml-1 text-yellow-500" />}
                </div>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] text-[10px] text-muted-foreground mt-1">
                <span className="text-right">YOLO11</span>
                <span />
                <span>YOLO26</span>
              </div>
            </div>
          ))}
        </div>

        {/* Side by side image panels */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {panels.map((panel, pi) => (
            <div key={panel.label} className="bg-card border rounded-2xl overflow-hidden shadow-sm">
              {/* Panel header */}
              <div className={`bg-gradient-to-r ${panel.color} text-white px-4 py-3 flex items-center justify-between`}>
                <div>
                  <h2 className="font-bold text-lg">{panel.label}</h2>
                  <p className="text-xs opacity-75">{panel.sub}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold">{panel.pred.detections.length} detections</p>
                  <p className="text-xs opacity-75">{panel.pred.elapsed_seconds}s</p>
                </div>
              </div>

              {/* Result image */}
              <div className="relative bg-black aspect-video flex items-center justify-center">
                {panel.pred.result_url ? (
                  panel.pred.media_type === 'video' ? (
                    <video src={img(panel.pred.result_url)} controls muted className="w-full h-full object-contain" />
                  ) : (
                    <img src={img(panel.pred.result_url)} alt={panel.label} className="w-full h-full object-contain" />
                  )
                ) : (
                  <p className="text-muted-foreground text-sm">No result</p>
                )}
              </div>

              {/* Detection list */}
              <div className="p-4 max-h-64 overflow-y-auto space-y-1.5">
                {panel.pred.detections.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Không phát hiện đối tượng nào</p>
                ) : (
                  panel.pred.detections.map((det, di) => {
                    const isHovered = syncHover === di;
                    return (
                      <div
                        key={di}
                        className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-all cursor-pointer ${
                          isHovered ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-accent/40 hover:bg-accent'
                        }`}
                        onMouseEnter={() => setSyncHover(di)}
                        onMouseLeave={() => setSyncHover(null)}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${pi === 0 ? 'bg-blue-500' : 'bg-purple-500'}`} />
                          <span className="font-medium">{det.label}</span>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${panel.badge}`}>
                          {(det.confidence * 100).toFixed(1)}%
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>

        {/* View individual details */}
        <div className="flex gap-3 justify-center mb-6">
          <Button variant="outline" className="rounded-full gap-1" onClick={() => navigate(`/result/${p11.id}`)}>
            Xem chi tiết YOLO11
          </Button>
          <Button variant="outline" className="rounded-full gap-1" onClick={() => navigate(`/result/${p26.id}`)}>
            Xem chi tiết YOLO26
          </Button>
        </div>

        <AppFooter />
      </div>
    </div>
  );
};

export default CompareResult;
