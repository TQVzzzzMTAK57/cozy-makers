import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Waves, Shield, Cpu, BarChart3, Rocket, Eye, Zap, Users } from "lucide-react";

const tabs = ["Introduction", "Our Solution", "Performance", "Get Started"] as const;

const Landing = () => {
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>("Introduction");

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative bg-primary py-24 text-primary-foreground text-center overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-primary-foreground/20 animate-wave" />
          <div className="absolute bottom-10 right-20 w-48 h-48 rounded-full bg-primary-foreground/10 animate-wave" style={{ animationDelay: '1s' }} />
        </div>
        <div className="relative z-10 container mx-auto px-4">
          <div className="flex justify-center mb-6">
            <div className="p-4 rounded-2xl bg-primary-foreground/10 backdrop-blur-sm">
              <Waves className="w-12 h-12" />
            </div>
          </div>
          <h1 className="text-5xl font-bold mb-4 tracking-tight">AI in Detection</h1>
          <p className="text-lg opacity-80 max-w-xl mx-auto mb-2">
            Applying artificial intelligence to detect individuals at sea
          </p>
          <p className="text-sm opacity-60">
            built by{" "}
            <a href="https://github.com/TQVzzzzMTAK57" target="_blank" rel="noopener noreferrer"
               className="underline font-semibold hover:opacity-80 transition-opacity">
              Viet Tran Quoc
            </a>{" "}
            with the expertise of <span className="underline">Dr. Truong Vu</span>.
          </p>
        </div>
      </section>

      {/* Tabs */}
      <section className="bg-secondary">
        <div className="container mx-auto px-4">
          <div className="flex justify-center gap-1 py-2">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 text-sm font-medium rounded-lg transition-all ${
                  activeTab === tab
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Tab Content */}
      <section className="container mx-auto px-4 py-16">
        {activeTab === "Introduction" && (
          <div className="animate-fade-in max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-4">AI in Sea Rescue Missions</h2>
            <div className="w-16 h-1 bg-primary rounded mb-8" />
            <p className="text-muted-foreground text-lg leading-relaxed mb-8">
              Artificial Intelligence (AI) is revolutionizing sea rescue operations by enhancing
              the speed and accuracy of detecting individuals in distress. Using advanced computer
              vision and deep learning models, our system analyzes real-time video feeds from
              drones to identify swimmers, boats, and potential drowning victims in open water.
            </p>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: Eye, title: "Real-time Detection", desc: "AI-powered analysis of live drone video feeds" },
                { icon: Shield, title: "Safety First", desc: "Early warning system for potential drowning incidents" },
                { icon: Zap, title: "Fast Response", desc: "Instant alerts to lifeguards and rescue teams" },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="bg-card p-6 rounded-xl border shadow-sm">
                  <div className="p-3 bg-accent rounded-lg w-fit mb-4">
                    <Icon className="w-6 h-6 text-accent-foreground" />
                  </div>
                  <h3 className="font-semibold mb-2">{title}</h3>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "Our Solution" && (
          <div className="animate-fade-in max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-4">Our Solution</h2>
            <div className="w-16 h-1 bg-primary rounded mb-8" />
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <p className="text-muted-foreground leading-relaxed mb-6">
                  Our platform integrates drone technology with state-of-the-art AI models 
                  to provide comprehensive sea surveillance. The system supports multiple 
                  drone connections, real-time video streaming, and automated detection alerts.
                </p>
                <ul className="space-y-3">
                  {["Multi-drone management", "YOLOv8 object detection", "Real-time video processing", "Email alert notifications", "GPS location tracking"].map(item => (
                    <li key={item} className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span className="text-sm">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-accent rounded-2xl p-8 flex items-center justify-center">
                <div className="text-center">
                  <Cpu className="w-20 h-20 text-accent-foreground mx-auto mb-4 opacity-60" />
                  <p className="text-sm text-muted-foreground">AI-Powered Detection Engine</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Performance" && (
          <div className="animate-fade-in max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-4">Performance</h2>
            <div className="w-16 h-1 bg-primary rounded mb-8" />
            <div className="grid md:grid-cols-4 gap-6 mb-8">
              {[
                { value: "95.2%", label: "Detection Accuracy" },
                { value: "< 2s", label: "Response Time" },
                { value: "30fps", label: "Processing Speed" },
                { value: "24/7", label: "Monitoring" },
              ].map(({ value, label }) => (
                <div key={label} className="bg-card p-6 rounded-xl border text-center shadow-sm">
                  <p className="text-3xl font-bold text-primary mb-1">{value}</p>
                  <p className="text-sm text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            <div className="bg-card p-6 rounded-xl border shadow-sm">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Model Performance Metrics
              </h3>
              <div className="space-y-4">
                {[
                  { label: "Precision", value: 94 },
                  { label: "Recall", value: 92 },
                  { label: "mAP@0.5", value: 95 },
                  { label: "F1 Score", value: 93 },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{label}</span>
                      <span className="font-medium">{value}%</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "Get Started" && (
          <div className="animate-fade-in max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold mb-4 text-center">Get Started</h2>
            <div className="w-16 h-1 bg-primary rounded mb-8 mx-auto" />
            <p className="text-muted-foreground text-lg mb-8 text-center">
              Ready to enhance your sea rescue operations with AI?
              Sign up now and start connecting your drones.
            </p>
            <div className="flex gap-4 justify-center mb-10">
              <Button asChild size="lg" className="rounded-full px-8">
                <Link to="/login">
                  <Rocket className="w-4 h-4 mr-2" />
                  Login to Dashboard
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full px-8">
                <Link to="/register">
                  <Users className="w-4 h-4 mr-2" />
                  Register
                </Link>
              </Button>
            </div>

            {/* Contact card */}
            <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-3">
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <span className="text-2xl">📬</span> Liên hệ
              </h3>
              <div className="space-y-2 text-sm">
                <p className="flex items-center gap-2">
                  <span>📍</span>
                  <span>236 Hoàng Quốc Việt, Nghĩa Đô, Hà Nội</span>
                </p>
                <p className="flex items-center gap-2">
                  <span>📞</span>
                  <a href="tel:0866658746" className="hover:text-primary transition-colors">0866 658 746</a>
                </p>
                <p className="flex items-center gap-2">
                  <span>✉️</span>
                  <a href="mailto:viet.storage.mta@gmail.com" className="hover:text-primary transition-colors">
                    viet.storage.mta@gmail.com
                  </a>
                </p>
                <p className="flex items-center gap-2">
                  <span>🐙</span>
                  <a href="https://github.com/TQVzzzzMTAK57" target="_blank" rel="noopener noreferrer"
                     className="hover:text-primary transition-colors font-medium">
                    github.com/TQVzzzzMTAK57
                  </a>
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="bg-card border-t py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-bold text-lg mb-4">About the Project</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This project leverages AI to detect drowning individuals in real-time using 
                video surveillance. Our system helps lifeguards and pool safety personnel 
                respond quickly to emergencies.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-4">Contact</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>📍 236 Hoàng Quốc Việt, Nghĩa Đô, Hà Nội</p>
                <p>📞 <a href="tel:0866658746" className="hover:text-foreground transition-colors">0866 658 746</a></p>
                <p>✉️ <a href="mailto:viet.storage.mta@gmail.com" className="hover:text-foreground transition-colors">viet.storage.mta@gmail.com</a></p>
                <p>🐙 <a href="https://github.com/TQVzzzzMTAK57" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">github.com/TQVzzzzMTAK57</a></p>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
