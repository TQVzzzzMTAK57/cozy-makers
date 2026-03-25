import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Waves, LogOut, Plus, Home, Shield, User } from "lucide-react";
import { logout, getUser, isAdmin } from "@/lib/auth";

interface AppHeaderProps {
  title: string;
  onNewDrone?: () => void;
}

const AppHeader = ({ title, onNewDrone }: AppHeaderProps) => {
  const navigate = useNavigate();
  const user = getUser();
  const admin = isAdmin();

  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <div className="bg-card rounded-xl border shadow-sm p-5 mb-6">
      <div className="flex items-center justify-between">
        {/* Left: logo + title */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(admin ? "/admin" : "/dashboard")}
            className="flex items-center gap-2 p-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 transition-colors"
          >
            <Waves className="w-5 h-5 text-primary" />
          </button>
          <div>
            <h1 className="text-lg font-bold leading-tight">{title}</h1>
            <div className="flex items-center gap-2">
              {user && <p className="text-xs text-muted-foreground">{user.email}</p>}
              {admin && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                  <Shield className="w-2.5 h-2.5" /> ADMIN
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5">
          {admin && (
            <>
              <Link to="/admin">
                <Button variant="ghost" size="sm" className="rounded-xl gap-1 text-amber-700 hover:bg-amber-50 hidden md:flex">
                  <Shield className="w-4 h-4" /> Admin
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button variant="ghost" size="sm" className="rounded-xl gap-1 hidden md:flex">
                  <Home className="w-4 h-4" /> Dashboard
                </Button>
              </Link>
            </>
          )}
          {!admin && (
            <Link to="/dashboard">
              <Button variant="ghost" size="sm" className="rounded-xl gap-1 hidden sm:flex">
                <Home className="w-4 h-4" /> Dashboard
              </Button>
            </Link>
          )}

          {onNewDrone && (
            <Button onClick={onNewDrone} size="sm" className="rounded-xl gap-1">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Drone</span>
            </Button>
          )}

          <Link to="/profile">
            <Button variant="outline" size="sm" className="rounded-xl gap-1 hidden sm:flex">
              <User className="w-4 h-4" />
              {user?.full_name || user?.username || 'Profile'}
            </Button>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="rounded-xl gap-1 text-destructive border-destructive/30 hover:bg-destructive hover:text-white"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Log out</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AppHeader;
