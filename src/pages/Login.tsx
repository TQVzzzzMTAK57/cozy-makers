import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Waves, User, Lock, LogIn, AlertCircle } from "lucide-react";
import { loginAsync } from "@/lib/auth";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await loginAsync(username, password);
      navigate("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center relative"
      style={{
        backgroundImage: `linear-gradient(135deg, hsla(231, 65%, 20%, 0.75), hsla(200, 80%, 30%, 0.6)), url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80')`,
      }}
    >
      {/* Floating wave decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-40 h-40 rounded-full bg-white/5 animate-wave" />
        <div className="absolute bottom-20 right-20 w-60 h-60 rounded-full bg-white/5 animate-wave" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/2 left-10 w-24 h-24 rounded-full bg-white/5 animate-wave" style={{ animationDelay: '0.8s' }} />
      </div>

      <div className="w-full max-w-md mx-4 animate-slide-up">
        <div className="glass rounded-2xl shadow-2xl overflow-hidden border border-white/20">
          {/* Header */}
          <div className="bg-gradient-to-br from-primary to-indigo-700 text-white p-8 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/30 to-transparent" />
            <div className="relative z-10">
              <div className="inline-flex p-3 rounded-2xl bg-white/20 mb-4 animate-float">
                <Waves className="w-10 h-10" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">AI Drowning Detection</h1>
              <p className="text-sm opacity-75 mt-1">Sign in to your account</p>
            </div>
          </div>

          {/* Form */}
          <div className="bg-card p-8">
            {error && (
              <div className="flex items-center gap-2 bg-destructive/10 text-destructive text-sm rounded-lg px-4 py-3 mb-4 animate-fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username" className="font-medium">Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="username"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10 h-11 rounded-xl"
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="font-medium">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-11 rounded-xl"
                    required
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 rounded-xl font-semibold bg-gradient-to-r from-primary to-indigo-600 hover:from-indigo-600 hover:to-primary transition-all duration-300"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <LogIn className="w-4 h-4" />
                    Login
                  </span>
                )}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link to="/register" className="text-primary font-semibold hover:underline">
                  Register here
                </Link>
              </p>
            </form>
          </div>
        </div>

        <p className="text-center text-xs text-white/50 mt-4">
          AI Lab • University of Technology • Hanoi, Vietnam
        </p>
      </div>
    </div>
  );
};

export default Login;
