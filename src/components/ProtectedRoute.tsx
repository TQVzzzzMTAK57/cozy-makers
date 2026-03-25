import { Navigate } from "react-router-dom";
import { isAuthenticated, isAdmin } from "@/lib/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  adminOnly?: boolean;
}

const ProtectedRoute = ({ children, adminOnly = false }: ProtectedRouteProps) => {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  if (adminOnly && !isAdmin()) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

export default ProtectedRoute;
