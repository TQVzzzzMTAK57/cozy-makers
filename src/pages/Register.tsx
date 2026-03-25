import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Waves, User, Lock, Mail, UserPlus, AlertCircle, CheckCircle } from "lucide-react";
import { registerAsync } from "@/lib/auth";

const Register = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await registerAsync(username, email, password);
      navigate("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const strengthColors = ['', 'bg-destructive', 'bg-warning', 'bg-success'];
  const strengthLabels = ['', 'Weak', 'Good', 'Strong'];

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center relative py-8"
      style={{
        backgroundImage: `linear-gradient(135deg, hsla(231, 65%, 20%, 0.75), hsla(200, 80%, 30%, 0.6)), url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80')`,
      }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-40 h-40 rounded-full bg-white/5 animate-wave" />
        <div className="absolute bottom-20 left-20 w-60 h-60 rounded-full bg-white/5 animate-wave" style={{ animationDelay: '1s' }} />
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
              <h1 className="text-2xl font-bold tracking-tight">Create Account</h1>
              <p className="text-sm opacity-75 mt-1">Join the AI Drowning Detection platform</p>
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

            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="font-medium">Username</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="username"
                    placeholder="Choose a username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10 h-11 rounded-xl"
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="font-medium">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11 rounded-xl"
                    required
                    autoComplete="email"
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
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-11 rounded-xl"
                    required
                    autoComplete="new-password"
                  />
                </div>
                {password.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= passwordStrength ? strengthColors[passwordStrength] : 'bg-muted'}`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">{strengthLabels[passwordStrength]}</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="font-medium">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 h-11 rounded-xl"
                    required
                    autoComplete="new-password"
                  />
                  {confirmPassword && password === confirmPassword && (
                    <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                  )}
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
                    Creating account...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    Register
                  </span>
                )}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="text-primary font-semibold hover:underline">
                  Login here
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
