import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Upload, Film, Image, CloudUpload, ChevronLeft, CheckCircle, X, Settings2, ArrowLeftRight } from "lucide-react";
import { api } from "@/lib/api";
import { isAuthenticated } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import AppFooter from "@/components/AppFooter";

const IMAGE_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/bmp', 'image/gif', 'image/webp',
]);
const VIDEO_TYPES = /^video\//;

function isImage(file: File) { return IMAGE_TYPES.has(file.type); }
function isVideo(file: File) { return VIDEO_TYPES.test(file.type); }
function isAccepted(file: File) { return isImage(file) || isVideo(file); }

const UploadVideo = () => {
  const { droneId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileKind, setFileKind] = useState<'image' | 'video' | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [done, setDone] = useState(false);
  const [conf, setConf] = useState(0.25);
  const [showConf, setShowConf] = useState(false);
  const [model, setModel] = useState<'yolo11' | 'yolo26' | 'compare'>('yolo11');

  if (!isAuthenticated()) { navigate("/login"); return null; }

  const handleFileSelect = (file: File) => {
    if (!isAccepted(file)) {
      toast({
        title: "File không hợp lệ",
        description: "Vui lòng chọn ảnh (jpg, png, webp…) hoặc video (mp4, avi, mov…)",
        variant: "destructive",
      });
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setFileKind(isImage(file) ? 'image' : 'video');
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFileKind(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (!selectedFile || !droneId) return;
    setProcessing(true);
    setProgress(0);
    try {
      if (model === 'compare') {
        // Run both models in parallel → navigate to compare page
        const result = await api.predictions.compare(
          Number(droneId),
          selectedFile,
          (pct) => setProgress(Math.min(pct, fileKind === 'image' ? 60 : 80)),
          conf,
        );
        setProgress(100);
        setDone(true);
        toast({ title: "✅ So sánh hoàn tất!", description: "YOLO11 và YOLO26 đã chạy xong." });
        setTimeout(() => navigate(`/compare?y11=${result.yolo11.id}&y26=${result.yolo26.id}`), 1200);
      } else {
        await api.predictions.upload(
          Number(droneId),
          selectedFile,
          (pct) => setProgress(Math.min(pct, fileKind === 'image' ? 70 : 85)),
          conf,
          model,
        );
        setProgress(100);
        setDone(true);
        toast({ title: "✅ Phân tích hoàn tất!", description: "YOLO đã phát hiện đối tượng thành công." });
        setTimeout(() => navigate(`/predictions/${droneId}`), 1500);
      }
    } catch (err: unknown) {
      toast({ title: "Upload thất bại", description: err instanceof Error ? err.message : "Lỗi không xác định", variant: "destructive" });
      setProcessing(false);
      setProgress(0);
    }
  };

  const labelForKind = fileKind === 'image' ? 'ảnh' : 'video';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="container mx-auto max-w-2xl">
        <Button variant="outline" size="sm" className="rounded-full mb-6 gap-1" onClick={() => navigate(-1)}>
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>

        {/* Header */}
        <div className={`bg-gradient-to-r ${model === 'compare' ? 'from-violet-600 to-pink-600' : 'from-primary to-indigo-600'} text-white rounded-t-2xl p-8 text-center transition-all`}>
          <CloudUpload className="w-12 h-12 mx-auto mb-3 opacity-90" />
          <h1 className="text-2xl font-bold">Phân tích Ảnh / Video</h1>
          <p className="text-sm opacity-75 mt-1">
            {model === 'compare'
              ? <><ArrowLeftRight className="w-4 h-4 inline mr-1" />So sánh <strong>YOLO11</strong> vs <strong>YOLO26</strong> song song</>
              : <>AI phát hiện người đuối nước • Mô hình: <strong>{model === 'yolo11' ? 'YOLO11 (best4.pt)' : 'YOLO26 (best_yolo26.pt)'}</strong></>}
          </p>
        </div>

        <div className="bg-card rounded-b-2xl border border-t-0 shadow-sm p-8">

          {/* Processing State */}
          {processing && (
            <div className="text-center py-8 animate-fade-in">
              {done ? (
                <div className="space-y-3">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto animate-bounce" />
                  <p className="font-bold text-lg text-green-700">Phân tích hoàn tất!</p>
                  <p className="text-sm text-muted-foreground">Đang chuyển đến kết quả…</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative w-20 h-20 mx-auto">
                    <div className="w-20 h-20 border-4 border-primary/20 rounded-full absolute" />
                    <div className="w-20 h-20 border-4 border-primary border-t-transparent rounded-full animate-spin absolute" />
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-primary">{progress}%</span>
                  </div>
                  <div>
                    <p className="font-semibold text-lg">
                      {progress < (fileKind === 'image' ? 70 : 85)
                        ? `Đang tải ${labelForKind}…`
                        : 'AI đang phân tích…'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Vui lòng không đóng trang này</p>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-primary to-indigo-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{progress}% hoàn tất</p>
                </div>
              )}
            </div>
          )}

          {/* File selection */}
          {!processing && (
            <>
              {/* Selected file preview */}
              {selectedFile && previewUrl ? (
                <div className="mb-6 space-y-3 animate-fade-in">
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center">
                    {fileKind === 'image' ? (
                      <img src={previewUrl} alt="preview" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <video src={previewUrl} controls className="w-full h-full object-contain" />
                    )}
                    <button
                      onClick={clearFile}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="bg-accent rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      {fileKind === 'image'
                        ? <Image className="w-4 h-4 text-primary flex-shrink-0" />
                        : <Film className="w-4 h-4 text-primary flex-shrink-0" />
                      }
                      <span className="text-sm font-medium truncate">{selectedFile.name}</span>
                      <span className="text-xs bg-primary/10 text-primary rounded px-1.5 py-0.5 flex-shrink-0 uppercase">
                        {fileKind}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                      {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                    </span>
                  </div>
                </div>
              ) : (
                /* Drop zone */
                <div
                  className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer mb-6 ${
                    dragOver ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-border hover:border-primary/50 hover:bg-accent/30'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className={`flex justify-center gap-3 mb-4 transition-colors ${dragOver ? 'text-primary' : 'text-muted-foreground/40'}`}>
                    <Image className="w-12 h-12" />
                    <Film className="w-12 h-12" />
                  </div>
                  <p className="font-semibold mb-1">Kéo thả ảnh hoặc video vào đây</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Ảnh: JPG, PNG, WEBP &nbsp;|&nbsp; Video: MP4, AVI, MOV, MKV (tối đa 500MB)
                  </p>
                  <Button size="sm" variant="outline" className="rounded-full pointer-events-none">
                    <Upload className="w-4 h-4 mr-1" /> Chọn file
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/bmp,image/gif,image/webp,video/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  />
                </div>
              )}

              {/* Advanced settings */}
              <div className="mb-4">
                <button
                  onClick={() => setShowConf(v => !v)}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Settings2 className="w-4 h-4" />
                  Cài đặt nâng cao
                </button>
                {showConf && (
                  <div className="mt-3 bg-accent/40 rounded-xl p-4 animate-fade-in space-y-4">

                    {/* Model selector */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">Chọn mô hình YOLO</label>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { key: 'yolo11',   label: 'YOLO11',      file: 'best4.pt',       desc: 'Nhanh & chính xác',   color: 'border-blue-400 bg-blue-50' },
                          { key: 'yolo26',   label: 'YOLO26',      file: 'best_yolo26.pt', desc: 'Tối ưu dữ liệu mới',  color: 'border-purple-400 bg-purple-50' },
                          { key: 'compare',  label: 'So sánh cả 2', file: 'YOLO11 + YOLO26', desc: 'Chạy song song',    color: 'border-pink-400 bg-pink-50' },
                        ] as const).map(m => (
                          <button
                            key={m.key}
                            type="button"
                            onClick={() => setModel(m.key)}
                            className={`rounded-xl border-2 p-3 text-left transition-all ${
                              model === m.key
                                ? m.color + ' ring-2 ring-offset-1 ring-primary/40'
                                : 'border-border hover:border-primary/40'
                            }`}
                          >
                            {m.key === 'compare' && <ArrowLeftRight className="w-3.5 h-3.5 text-pink-500 mb-1" />}
                            <p className="font-semibold text-sm">{m.label}</p>
                            <p className="text-xs text-muted-foreground leading-tight">{m.file}</p>
                            <p className={`text-xs mt-0.5 ${
                              m.key === 'compare' ? 'text-pink-600' : 'text-primary'
                            }`}>{m.desc}</p>
                          </button>
                        ))}
                      </div>
                      {model === 'compare' && (
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <ArrowLeftRight className="w-3 h-3" />
                          Cả 2 mô hình sẽ chạy đồng thời. Kết quả hiển thị side-by-side để so sánh.
                        </p>
                      )}
                    </div>

                    {/* Confidence threshold */}
                    <div>
                      <label className="text-sm font-medium mb-1 block">
                        Ngưỡng tin cậy (conf): <strong>{conf}</strong>
                      </label>
                      <input
                        type="range" min={0.05} max={0.95} step={0.05}
                        value={conf}
                        onChange={e => setConf(Number(e.target.value))}
                        className="w-full accent-primary"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>0.05 (nhạy hơn)</span>
                        <span>0.95 (chính xác hơn)</span>
                      </div>
                    </div>

                  </div>
                )}
              </div>

              <Button
                onClick={handleUpload}
                disabled={!selectedFile}
                className={`w-full h-12 rounded-xl font-semibold transition-all ${
                  model === 'compare'
                    ? 'bg-gradient-to-r from-violet-600 to-pink-600 hover:from-pink-600 hover:to-violet-600 text-white'
                    : 'bg-gradient-to-r from-primary to-indigo-600 hover:from-indigo-600 hover:to-primary text-white'
                }`}
                size="lg"
              >
                {model === 'compare'
                  ? <><ArrowLeftRight className="w-5 h-5 mr-2" />{selectedFile ? `So sánh "${selectedFile.name}"` : 'Chọn file để so sánh'}</>
                  : <><CloudUpload className="w-5 h-5 mr-2" />{selectedFile ? `Phân tích "${selectedFile.name}"` : 'Chọn ảnh hoặc video để upload'}</>
                }
              </Button>
            </>
          )}
        </div>

        <AppFooter />
      </div>
    </div>
  );
};

export default UploadVideo;
