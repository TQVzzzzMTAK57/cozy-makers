import { Facebook, Linkedin, Instagram, Github } from "lucide-react";

const AppFooter = () => (
  <footer className="bg-card rounded-xl border shadow-sm p-8 mt-6">
    <div className="grid md:grid-cols-2 gap-8">
      <div>
        <h3 className="font-bold text-lg mb-3">About the Project</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          This project leverages AI to detect drowning individuals in real-time using
          video surveillance. Our system helps lifeguards and pool safety personnel
          respond quickly to emergencies.
        </p>
      </div>
      <div>
        <h3 className="font-bold text-lg mb-3">Contact Us</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>📍 AI Lab, University of Technology - Hanoi, Vietnam</p>
          <p>📞 +84 123 456 789</p>
          <p>✉️ ai.detection@university.edu</p>
        </div>
        <div className="flex gap-3 mt-4">
          {[Facebook, Linkedin, Instagram, Github].map((Icon, i) => (
            <button key={i} className="p-2 rounded-full bg-secondary hover:bg-accent transition-colors">
              <Icon className="w-4 h-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
    </div>
  </footer>
);

export default AppFooter;
