import { Github, Mail, MapPin, Phone } from "lucide-react";

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
        <p className="text-xs text-muted-foreground mt-3 opacity-70">
          built by{" "}
          <a href="https://github.com/TQVzzzzMTAK57" target="_blank" rel="noopener noreferrer"
             className="underline font-medium hover:text-foreground transition-colors">
            Viet Tran Quoc
          </a>
        </p>
      </div>
      <div>
        <h3 className="font-bold text-lg mb-3">Contact</h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            236 Hoàng Quốc Việt, Nghĩa Đô, Hà Nội
          </p>
          <p className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 flex-shrink-0" />
            <a href="tel:0866658746" className="hover:text-foreground transition-colors">0866 658 746</a>
          </p>
          <p className="flex items-center gap-2">
            <Mail className="w-3.5 h-3.5 flex-shrink-0" />
            <a href="mailto:viet.storage.mta@gmail.com" className="hover:text-foreground transition-colors">
              viet.storage.mta@gmail.com
            </a>
          </p>
        </div>
        <div className="flex gap-3 mt-4">
          <a href="https://github.com/TQVzzzzMTAK57" target="_blank" rel="noopener noreferrer"
             className="p-2 rounded-full bg-secondary hover:bg-accent transition-colors">
            <Github className="w-4 h-4 text-muted-foreground" />
          </a>
        </div>
      </div>
    </div>
  </footer>
);

export default AppFooter;
