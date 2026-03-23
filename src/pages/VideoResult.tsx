import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Download, Upload, ThumbsUp, ThumbsDown } from "lucide-react";
import { getPrediction, type Prediction } from "@/lib/drone-store";
import { isAuthenticated } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import AppFooter from "@/components/AppFooter";

const VideoResult = () => {
  const { predictionId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [feedback, setFeedback] = useState<'accurate' | 'inaccurate' | null>(null);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!isAuthenticated()) { navigate("/login"); return; }
    const p = getPrediction(Number(predictionId));
    if (p) setPrediction(p);
  }, [predictionId, navigate]);

  const handleSubmitFeedback = () => {
    toast({ title: "Feedback submitted", description: "Thank you for your feedback!" });
  };

  if (!prediction) return null;

  return (
    <div className="min-h-screen bg-primary/10 p-6">
      <div className="container mx-auto max-w-3xl">
        <Button variant="outline" size="sm" className="rounded-full mb-6" onClick={() => navigate(-1)}>← Back</Button>

        <div className="bg-card rounded-xl border shadow-sm p-6 mb-6">
          <h1 className="text-xl font-bold mb-2">🎯 Drowning Detection - Video Result</h1>
          <p className="text-sm text-muted-foreground">{prediction.uploadedAt}</p>
        </div>

        {/* Video player mock */}
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden mb-6">
          <div className="relative bg-gradient-to-br from-primary/20 to-accent aspect-video flex items-center justify-center">
            <div className="text-center">
              <p className="text-4xl mb-2">🎬</p>
              <p className="text-sm text-muted-foreground">Video with AI detection overlay</p>
            </div>
            {/* Detection labels */}
            {prediction.result?.detections.map((d, i) => (
              <div
                key={i}
                className="absolute px-2 py-1 text-xs font-mono rounded border-2"
                style={{
                  left: `${(d.x / 500) * 100}%`,
                  top: `${(d.y / 300) * 100}%`,
                  borderColor: d.label === 'swimmer' ? 'hsl(180, 100%, 50%)' : 'hsl(60, 100%, 50%)',
                  color: d.label === 'swimmer' ? 'hsl(180, 100%, 50%)' : 'hsl(60, 100%, 50%)',
                  backgroundColor: 'hsla(0, 0%, 0%, 0.5)',
                }}
              >
                {d.label} {d.confidence.toFixed(2)}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 justify-center mb-6">
          <Button variant="outline" className="rounded-full">
            <Download className="w-4 h-4 mr-2" /> Download Video
          </Button>
          <Button variant="outline" className="rounded-full" onClick={() => navigate(-1)}>
            <Upload className="w-4 h-4 mr-2" /> Upload New Video
          </Button>
        </div>

        {/* Feedback */}
        <div className="bg-card rounded-xl border shadow-sm p-6 mb-6">
          <h3 className="font-semibold mb-4">Do you find this prediction accurate?</h3>
          <div className="flex gap-4 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="feedback"
                checked={feedback === 'accurate'}
                onChange={() => setFeedback('accurate')}
                className="accent-primary"
              />
              <ThumbsUp className="w-4 h-4 text-success" />
              Yes, it's accurate
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="feedback"
                checked={feedback === 'inaccurate'}
                onChange={() => setFeedback('inaccurate')}
                className="accent-primary"
              />
              <ThumbsDown className="w-4 h-4 text-warning" />
              No, it needs improvement
            </label>
          </div>
          <div className="space-y-2">
            <Label>Your Feedback (optional):</Label>
            <Textarea
              placeholder="Please share your thoughts on the prediction result..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
            />
          </div>
          <Button className="mt-4 rounded-full" onClick={handleSubmitFeedback}>
            Submit Feedback
          </Button>
        </div>

        <AppFooter />
      </div>
    </div>
  );
};

export default VideoResult;
