import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Waves, LogOut, Plus } from "lucide-react";
import { logout, getUser } from "@/lib/auth";

interface AppHeaderProps {
  title: string;
  onNewDrone?: () => void;
  showBack?: boolean;
}

const AppHeader = ({ title, onNewDrone, showBack }: AppHeaderProps) => {
  const navigate = useNavigate();
  const user = getUser();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="bg-card rounded-xl border shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {showBack && (
            <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="rounded-full">
              ← Back
            </Button>
          )}
          <Waves className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">{title}</h1>
        </div>
        <div className="flex items-center gap-3">
          {onNewDrone && (
            <Button onClick={onNewDrone} size="sm" className="rounded-full">
              <Plus className="w-4 h-4 mr-1" />
              New Drone
            </Button>
          )}
          <Button variant="destructive" size="sm" onClick={handleLogout} className="rounded-full">
            <LogOut className="w-4 h-4 mr-1" />
            Log out
          </Button>
        </div>
      </div>
      {user && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>👤</span>
          <span>{user.email}</span>
        </div>
      )}
    </div>
  );
};

export default AppHeader;
