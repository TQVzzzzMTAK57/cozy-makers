import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Upload, Film, CloudUpload } from "lucide-react";
import { addPrediction } from "@/lib/drone-store";
import { isAuthenticated } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import AppFooter from "@/components/AppFooter";

const UploadVideo = () => {
  const { droneId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  if (!isAuthenticated()) { navigate("/login"); return null; }

  const handleFileSelect = (file: File) => {
    if (file.type.startsWith('video/')) {
      setSelectedFile(file);
    } else {
      toast({ title: "Invalid file", description: "Please select a video file", variant: "destructive" });
    }
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    setProcessing(true);
    setTimeout(() => {
      const now = new Date();
      addPrediction({
        droneId: Number(droneId),
        name: selectedFile.name,
        uploadedAt: `${now.toLocaleTimeString()} ${now.toLocaleDateString()}`,
        videoUrl: URL.createObjectURL(selectedFile),
        hasResult: true,
        result: {
          detections: [
            { label: "swimmer", confidence: 0.66, x: 350, y: 220 },
            { label: "boat", confidence: 0.73, x: 50, y: 30 },
          ],
        },
      });
      toast({ title: "✅ Success", description: "Video processed! Swimmer detected." });
      setProcessing(false);
      navigate(`/predictions/${droneId}`);
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-primary/10 p-6">
      <div className="container mx-auto max-w-3xl">
        <Button variant="outline" size="sm" className="rounded-full mb-6" onClick={() => navigate(-1)}>← Back</Button>

        <div className="bg-primary text-primary-foreground rounded-t-xl p-8 text-center">
          <h1 className="text-2xl font-bold">Upload Your Video</h1>
          <p className="text-sm opacity-80 mt-1">Select a video file to upload and analyze for drowning detection</p>
        </div>

        <div className="bg-card rounded-b-xl border border-t-0 shadow-sm p-8">
          {processing ? (
            <div className="text-center py-12">
              <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="font-semibold text-lg">Video is being processed!</p>
              <p className="text-sm text-muted-foreground mt-1">Please wait while AI analyzes your video...</p>
            </div>
          ) : (
            <>
              <div
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
                  dragOver ? 'border-primary bg-accent' : 'border-border hover:border-primary/50'
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
                <Film className="w-16 h-16 text-primary/40 mx-auto mb-4" />
                <p className="font-medium mb-2">Drag & drop your video here</p>
                <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
                <div className="flex gap-3 justify-center">
                  <Button size="sm" variant="outline" className="rounded-full">
                    <Upload className="w-4 h-4 mr-1" /> Browse Files
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                />
              </div>

              {selectedFile && (
                <div className="mt-4 p-4 bg-accent rounded-lg">
                  <p className="text-sm">Selected file: <span className="font-medium">{selectedFile.name}</span></p>
                </div>
              )}

              <div className="mt-6 text-center">
                <Button onClick={handleUpload} disabled={!selectedFile} className="rounded-full px-8" size="lg">
                  <CloudUpload className="w-4 h-4 mr-2" /> Upload Video
                </Button>
              </div>
            </>
          )}
        </div>

        <AppFooter />
      </div>
    </div>
  );
};

export default UploadVideo;
