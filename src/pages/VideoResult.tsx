import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Download, Upload, ThumbsUp, ThumbsDown, ChevronLeft, Target, CheckCircle, Clock, SlidersHorizontal, ZoomIn, X, Maximize2, MapPin, Navigation, ExternalLink, Satellite } from "lucide-react";
import { api, type PredictionAPI } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import AppFooter from "@/components/AppFooter";

const LABEL_COLORS: Record<string, string> = {
  swimmer: '#06b6d4',
  boat: '#f59e0b',
  person_distress: '#ef4444',
};

const VideoResult = () => {
  const { predictionId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [prediction, setPrediction] = useState<PredictionAPI | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<'accurate' | 'inaccurate' | null>(null);
  const [comment, setComment] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [videoDim, setVideoDim] = useState({ w: 640, h: 360 });
  const [confThreshold, setConfThreshold] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string>('all');

  // Close lightbox on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) { navigate("/login"); return; }
    if (!predictionId) return;

    api.predictions.get(Number(predictionId))
      .then(data => {
        setPrediction(data);
        if (data.feedback_accurate !== null) {
          setFeedback(data.feedback_accurate ? 'accurate' : 'inaccurate');
          setComment(data.feedback_comment || '');
          setFeedbackSubmitted(true);
        }
      })
      .catch(() => toast({ title: "Error", description: "Prediction not found", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [predictionId, navigate, toast]);

  const handleSubmitFeedback = async () => {
    if (!prediction || !feedback) return;
    try {
      await api.predictions.feedback(prediction.id, feedback === 'accurate', comment);
      setFeedbackSubmitted(true);
      toast({ title: "✅ Feedback submitted", description: "Thank you for your feedback!" });
    } catch {
      toast({ title: "Error", description: "Failed to submit feedback", variant: "destructive" });
    }
  };

  const handleDownload = () => {
    const raw = prediction?.result_url || prediction?.file_url || prediction?.video_url;
    if (!raw) return;
    const BACKEND = 'http://localhost:3001';
    const url = raw.startsWith('http') ? raw : `${BACKEND}${raw}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `result_${prediction!.name}`;
    a.click();
  };

  const rawMediaUrl = prediction?.result_url || prediction?.file_url || prediction?.video_url;
  const isImageResult = prediction?.media_type === 'image';

  // For video, use absolute URL pointing directly to the backend to ensure
  // HTTP Range Requests (needed for seeking/streaming) work correctly.
  // Vite's proxy can drop the Accept-Ranges / Content-Range headers.
  const BACKEND = 'http://localhost:3001';
  const mediaUrl = rawMediaUrl
    ? (isImageResult
        ? rawMediaUrl                          // image: proxy is fine
        : rawMediaUrl.startsWith('http')
          ? rawMediaUrl
          : `${BACKEND}${rawMediaUrl}`)        // video: direct to backend
    : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!prediction) return null;

  const formatDate = (str: string) => {
    try { return new Date(str).toLocaleString('vi-VN'); } catch { return str; }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="container mx-auto max-w-4xl">
        <Button variant="outline" size="sm" className="rounded-full mb-6 gap-1" onClick={() => navigate(-1)}>
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>

        {/* Title card */}
        <div className="bg-card rounded-xl border shadow-sm p-6 mb-6 animate-fade-in">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Drowning Detection Result
              </h1>
              <p className="text-sm text-muted-foreground mt-1">{prediction.name}</p>
              <p className="text-xs text-muted-foreground">{formatDate(prediction.uploaded_at)}</p>
            </div>
            {prediction.has_result && (
              <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                ✅ Analysis Complete
              </span>
            )}
          </div>
        </div>

        {/* Media Player – annotated YOLO output */}
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden mb-6 animate-slide-up">
          <div className="bg-black/90 p-3 flex items-center justify-between">
            <span className="text-white/60 text-xs font-mono flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-blink" />
              AI Detection Feed · {isImageResult ? 'Image' : 'Video'}
              {prediction.elapsed_seconds != null && (
                <span className="ml-2 flex items-center gap-1 opacity-70">
                  <Clock className="w-3 h-3" />{prediction.elapsed_seconds}s
                </span>
              )}
            </span>
            <div className="flex gap-2">
              {isImageResult && mediaUrl && (
                <Button size="sm" variant="ghost" className="text-white/60 hover:text-white h-7 px-2 text-xs" onClick={() => setLightboxOpen(true)}>
                  <Maximize2 className="w-3 h-3 mr-1" /> Fullscreen
                </Button>
              )}
              <Button size="sm" variant="ghost" className="text-white/60 hover:text-white h-7 px-2 text-xs" onClick={handleDownload} disabled={!mediaUrl}>
                <Download className="w-3 h-3 mr-1" /> Download
              </Button>
            </div>
          </div>

          {mediaUrl ? (
            <div className="relative bg-black flex items-center justify-center group">
              {isImageResult ? (
                <>
                  <img
                    src={mediaUrl}
                    alt={`YOLO result: ${prediction.name}`}
                    className="w-full max-h-[520px] object-contain cursor-zoom-in"
                    onClick={() => setLightboxOpen(true)}
                  />
                  {/* Zoom hint overlay */}
                  <div
                    className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-zoom-in"
                    onClick={() => setLightboxOpen(true)}
                  >
                    <div className="bg-black/50 rounded-full p-3 backdrop-blur-sm">
                      <ZoomIn className="w-7 h-7 text-white" />
                    </div>
                  </div>
                </>
              ) : (
                <video
                  ref={videoRef}
                  src={mediaUrl ?? undefined}
                  controls
                  crossOrigin="anonymous"
                  className="w-full max-h-[480px] object-contain"
                  onLoadedMetadata={(e) => {
                    const v = e.currentTarget;
                    setVideoDim({ w: v.videoWidth || 640, h: v.videoHeight || 360 });
                  }}
                  onError={(e) => {
                    console.error('[VideoResult] video load error', e.currentTarget.error);
                  }}
                >
                  <source
                    src={mediaUrl ?? undefined}
                    type="video/mp4"
                  />
                  Trình duyệt của bạn không hỗ trợ phát video.
                </video>
              )}
            </div>
          ) : (
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 aspect-video flex items-center justify-center">
              <div className="text-center text-white">
                <Target className="w-16 h-16 mx-auto mb-3 opacity-30" />
                <p className="text-sm opacity-50">Preview not available</p>
              </div>
            </div>
          )}
        </div>

        {/* Detection Summary */}
        {prediction.detections.length > 0 && (() => {
          // Unique labels for tab bar
          const allLabels = Array.from(new Set(prediction.detections.map(d => d.label)));

          // Combined filter: confidence + label
          const filtered = prediction.detections.filter(d =>
            d.confidence * 100 >= confThreshold &&
            (selectedLabel === 'all' || d.label === selectedLabel)
          );

          // Per-label count (confidence-filtered only, for tab badges)
          const labelCounts = Object.fromEntries(
            allLabels.map(lbl => [
              lbl,
              prediction.detections.filter(d => d.confidence * 100 >= confThreshold && d.label === lbl).length
            ])
          );
          const totalConfFiltered = prediction.detections.filter(d => d.confidence * 100 >= confThreshold).length;

          return (
            <div className="bg-card rounded-xl border shadow-sm p-6 mb-6 animate-fade-in">
              {/* Header row */}
              <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
                <h3 className="font-semibold flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  Detection Summary
                  <span className="text-sm font-normal text-muted-foreground">
                    ({filtered.length}/{prediction.detections.length} object{prediction.detections.length > 1 ? 's' : ''})
                  </span>
                </h3>

                {/* Confidence Filter */}
                <div className="flex items-center gap-3 min-w-[220px]">
                  <SlidersHorizontal className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Min Confidence</span>
                      <span className="font-semibold text-primary">{confThreshold}%</span>
                    </div>
                    <Slider
                      min={0}
                      max={100}
                      step={5}
                      value={[confThreshold]}
                      onValueChange={([v]) => setConfThreshold(v)}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Label Filter Tabs */}
              <div className="flex flex-wrap gap-2 mb-4">
                {/* All tab */}
                <button
                  onClick={() => setSelectedLabel('all')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    selectedLabel === 'all'
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-secondary/60 text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                  }`}
                >
                  <span>All Objects</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    selectedLabel === 'all' ? 'bg-white/20' : 'bg-muted'
                  }`}>{totalConfFiltered}</span>
                </button>

                {/* Per-label tabs */}
                {allLabels.map(lbl => {
                  const color = LABEL_COLORS[lbl] || '#6366f1';
                  const count = labelCounts[lbl] || 0;
                  const isActive = selectedLabel === lbl;
                  return (
                    <button
                      key={lbl}
                      onClick={() => setSelectedLabel(lbl)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        isActive
                          ? 'shadow-sm'
                          : 'bg-secondary/60 text-muted-foreground border-border hover:text-foreground'
                      }`}
                      style={isActive ? {
                        backgroundColor: `${color}22`,
                        borderColor: color,
                        color,
                      } : { '--hover-border': color } as React.CSSProperties}
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="capitalize">{lbl.replace(/_/g, ' ')}</span>
                      <span
                        className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ backgroundColor: `${color}22`, color }}
                      >{count}</span>
                    </button>
                  );
                })}
              </div>

              {filtered.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <SlidersHorizontal className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  {selectedLabel !== 'all' && labelCounts[selectedLabel] === 0 ? (
                    <>
                      <p className="text-sm">No <strong className="capitalize">{selectedLabel.replace(/_/g, ' ')}</strong> detections above <strong>{confThreshold}%</strong> confidence</p>
                      <div className="flex justify-center gap-3 mt-2">
                        <button className="text-xs text-primary underline" onClick={() => setSelectedLabel('all')}>Show all labels</button>
                        {confThreshold > 0 && <button className="text-xs text-primary underline" onClick={() => setConfThreshold(0)}>Reset confidence</button>}
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm">No detections above <strong>{confThreshold}%</strong> confidence</p>
                      <button className="text-xs text-primary underline mt-1" onClick={() => setConfThreshold(0)}>Reset filter</button>
                    </>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {filtered.map((d, i) => {
                    const color = LABEL_COLORS[d.label] || '#6366f1';
                    return (
                      <div
                        key={i}
                        className="rounded-lg p-3 border transition-all"
                        style={{ borderColor: `${color}44`, backgroundColor: `${color}11` }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-semibold capitalize" style={{ color }}>{d.label}</p>
                          <span
                            className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                            style={{ backgroundColor: `${color}22`, color }}
                          >
                            {(d.confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                        {/* Confidence bar */}
                        <div className="w-full bg-black/10 rounded-full h-1.5 mb-1.5">
                          <div
                            className="h-1.5 rounded-full transition-all"
                            style={{ width: `${(d.confidence * 100).toFixed(0)}%`, backgroundColor: color }}
                          />
                        </div>
                        {/* Pixel position */}
                        <p className="text-xs text-muted-foreground">
                          Pixel: ({d.x}, {d.y})
                          {d.center_px && <span className="ml-1 opacity-60">· center ({d.center_px[0]}, {d.center_px[1]})</span>}
                        </p>

                        {/* GPS coordinate */}
                        {d.gps ? (
                          <div className="mt-2 rounded-md p-2" style={{ backgroundColor: `${color}18`, border: `1px solid ${color}33` }}>
                            <div className="flex items-center gap-1 mb-1">
                              <MapPin className="w-3 h-3" style={{ color }} />
                              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color }}>GPS</span>
                            </div>
                            <p className="text-xs font-mono font-medium text-foreground">
                              {d.gps.lat.toFixed(6)}°, {d.gps.lon.toFixed(6)}°
                            </p>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[10px] text-muted-foreground">
                                Δ {d.gps.dx_meters > 0 ? '+' : ''}{d.gps.dx_meters}m E, {d.gps.dy_meters > 0 ? '+' : ''}{d.gps.dy_meters}m N
                              </span>
                              <a
                                href={d.gps.google_maps_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-0.5 text-[10px] underline"
                                style={{ color }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                Maps <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>
                          </div>
                        ) : (
                          isImageResult && !prediction.drone_gps && (
                            <p className="text-[10px] text-muted-foreground/60 mt-1 italic">No GPS EXIF</p>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* GPS / Drone Position Panel – only for images with GPS EXIF */}
        {isImageResult && prediction.drone_gps && (() => {
          const g = prediction.drone_gps!;
          const hasGpsDets = prediction.detections.some(d => d.gps);
          return (
            <div className="bg-card rounded-xl border shadow-sm p-6 mb-6 animate-fade-in" style={{ borderColor: '#22d3ee44', background: 'linear-gradient(135deg,rgb(6 182 212 / 5%) 0%,transparent 100%)' }}>
              {/* Header */}
              <div className="flex items-center gap-2 mb-4">
                <div className="p-2 rounded-lg" style={{ background: '#06b6d420' }}>
                  <Satellite className="w-4 h-4" style={{ color: '#06b6d4' }} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm" style={{ color: '#06b6d4' }}>GPS Coordinate Data</h3>
                  <p className="text-xs text-muted-foreground">Extracted from drone image EXIF metadata</p>
                </div>
              </div>

              {/* Drone position */}
              <div className="rounded-lg border p-4 mb-4" style={{ borderColor: '#06b6d433', backgroundColor: '#06b6d408' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Navigation className="w-4 h-4" style={{ color: '#06b6d4' }} />
                  <span className="text-sm font-semibold">Drone Position (Image Centre)</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Latitude</p>
                    <p className="font-mono font-semibold">{g.lat.toFixed(6)}°</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Longitude</p>
                    <p className="font-mono font-semibold">{g.lon.toFixed(6)}°</p>
                  </div>
                  {g.alt != null && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Altitude (AGL)</p>
                      <p className="font-mono font-semibold">{g.alt} m</p>
                    </div>
                  )}
                </div>
                <a
                  href={`https://www.google.com/maps?q=${g.lat},${g.lon}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-3 text-xs underline"
                  style={{ color: '#06b6d4' }}
                >
                  <MapPin className="w-3 h-3" /> View drone location on Google Maps <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              {/* Per-detection GPS table */}
              {hasGpsDets && (
                <>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Detected Object Coordinates</h4>
                  <div className="overflow-x-auto rounded-lg border" style={{ borderColor: '#06b6d422' }}>
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ backgroundColor: '#06b6d410' }}>
                          <th className="text-left px-3 py-2 font-semibold text-muted-foreground">#</th>
                          <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Object</th>
                          <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Conf.</th>
                          <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Latitude</th>
                          <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Longitude</th>
                          <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Offset (E/N)</th>
                          <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Map</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prediction.detections
                          .filter(d => d.gps)
                          .map((d, i) => {
                            const color = LABEL_COLORS[d.label] || '#6366f1';
                            return (
                              <tr key={i} className="border-t" style={{ borderColor: '#06b6d411' }}>
                                <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                                <td className="px-3 py-2">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                                    <span className="capitalize font-medium" style={{ color }}>{d.label.replace(/_/g, ' ')}</span>
                                  </span>
                                </td>
                                <td className="px-3 py-2 font-mono">{(d.confidence * 100).toFixed(1)}%</td>
                                <td className="px-3 py-2 font-mono">{d.gps!.lat.toFixed(6)}°</td>
                                <td className="px-3 py-2 font-mono">{d.gps!.lon.toFixed(6)}°</td>
                                <td className="px-3 py-2 font-mono text-muted-foreground">
                                  {d.gps!.dx_meters > 0 ? '+' : ''}{d.gps!.dx_meters}m / {d.gps!.dy_meters > 0 ? '+' : ''}{d.gps!.dy_meters}m
                                </td>
                                <td className="px-3 py-2">
                                  <a
                                    href={d.gps!.google_maps_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-cyan-500 hover:text-cyan-400 transition-colors"
                                  >
                                    <MapPin className="w-3 h-3" /><ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                  {g.alt == null && (
                    <p className="text-[11px] text-amber-500 mt-2 flex items-center gap-1">
                      ⚠️ Altitude not found in EXIF — GPS coordinates estimated using default 50m AGL. For accuracy, ensure drone altitude is embedded in image metadata.
                    </p>
                  )}
                </>
              )}
            </div>
          );
        })()}

        {/* No-GPS notice for images without EXIF */}
        {isImageResult && !prediction.drone_gps && prediction.detections.length > 0 && (
          <div className="rounded-xl border border-dashed border-muted p-4 mb-6 flex items-start gap-3 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 opacity-40" />
            <div>
              <p className="font-medium text-foreground/70">GPS coordinates not available</p>
              <p className="text-xs mt-0.5">This image does not contain GPS EXIF metadata. To enable coordinate tracking, ensure your drone embeds GPS data in captured images.</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-center mb-6">
          <Button variant="outline" className="rounded-full gap-2" onClick={handleDownload} disabled={!mediaUrl}>
            <Download className="w-4 h-4" /> Tải kết quả
          </Button>
          <Button variant="outline" className="rounded-full gap-2" onClick={() => navigate(`/upload/${prediction.drone_id}`)}>
            <Upload className="w-4 h-4" /> Upload mới
          </Button>
        </div>

        {/* Feedback */}
        <div className="bg-card rounded-xl border shadow-sm p-6 mb-6 animate-fade-in">
          <h3 className="font-semibold mb-4">Do you find this prediction accurate?</h3>

          {feedbackSubmitted ? (
            <div className="flex items-center gap-3 text-green-700 bg-green-50 rounded-lg p-4">
              <CheckCircle className="w-5 h-5" />
              <div>
                <p className="font-medium">Feedback submitted!</p>
                <p className="text-sm opacity-80">
                  Marked as: <strong>{feedback === 'accurate' ? '✅ Accurate' : '❌ Needs improvement'}</strong>
                </p>
                {comment && <p className="text-sm opacity-70 mt-1">"{comment}"</p>}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-4">
                <button
                  onClick={() => setFeedback('accurate')}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    feedback === 'accurate'
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-border hover:border-green-300'
                  }`}
                >
                  <ThumbsUp className="w-5 h-5" />
                  <span className="font-medium">Yes, it's accurate</span>
                </button>
                <button
                  onClick={() => setFeedback('inaccurate')}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    feedback === 'inaccurate'
                      ? 'border-orange-500 bg-orange-50 text-orange-700'
                      : 'border-border hover:border-orange-300'
                  }`}
                >
                  <ThumbsDown className="w-5 h-5" />
                  <span className="font-medium">Needs improvement</span>
                </button>
              </div>

              <div className="space-y-2">
                <Label>Your comment (optional):</Label>
                <Textarea
                  placeholder="Share your thoughts on the detection result..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  className="rounded-xl resize-none"
                />
              </div>

              <Button
                className="w-full rounded-xl h-11"
                onClick={handleSubmitFeedback}
                disabled={!feedback}
              >
                Submit Feedback
              </Button>
            </div>
          )}
        </div>

        <AppFooter />
      </div>

      {/* Lightbox / Fullscreen overlay */}
      {lightboxOpen && mediaUrl && isImageResult && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center animate-fade-in"
          onClick={() => setLightboxOpen(false)}
          style={{ animation: 'fadeIn 0.15s ease' }}
        >
          {/* Close button */}
          <button
            className="absolute top-4 right-4 z-10 bg-white/10 hover:bg-white/20 text-white rounded-full p-2.5 transition-all backdrop-blur-sm"
            onClick={() => setLightboxOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>

          {/* Caption */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-sm font-mono truncate max-w-[60vw] text-center">
            {prediction.name}
          </div>

          {/* Image — stop propagation so clicking image doesn't close */}
          <img
            src={mediaUrl}
            alt={`Fullscreen: ${prediction.name}`}
            className="max-w-[95vw] max-h-[92vh] object-contain rounded-lg shadow-2xl cursor-zoom-out select-none"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Hint */}
          <p className="absolute bottom-4 text-white/30 text-xs">
            Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/50 font-mono">Esc</kbd> or click outside to close
          </p>
        </div>
      )}
    </div>
  );
};

export default VideoResult;
