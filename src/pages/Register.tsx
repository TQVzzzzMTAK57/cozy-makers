import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Waves, User, Lock, Mail, UserPlus } from "lucide-react";
import { login } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const Register = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    setLoading(true);
    setTimeout(() => {
      login(username, password);
      toast({ title: "Success", description: "Account created successfully!" });
      navigate("/dashboard");
      setLoading(false);
    }, 500);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center relative"
      style={{
        backgroundImage: `linear-gradient(135deg, hsla(231, 65%, 25%, 0.4), hsla(30, 80%, 50%, 0.3)), url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80')`,
      }}
    >
      <div className="w-full max-w-md mx-4">
        <div className="bg-card rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-primary text-primary-foreground p-8 text-center">
            <div className="inline-flex p-3 rounded-full bg-primary-foreground/20 mb-4">
              <Waves className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold">Drowning Detection</h1>
            <p className="text-sm opacity-80 mt-1">Create your account</p>
          </div>

          <form onSubmit={handleRegister} className="p-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="username" placeholder="Choose a username" value={username} onChange={(e) => setUsername(e.target.value)} className="pl-10" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="email" type="email" placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="password" type="password" placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="confirmPassword" type="password" placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10" required />
              </div>
            </div>
            <Button type="submit" className="w-full rounded-lg" disabled={loading}>
              <UserPlus className="w-4 h-4 mr-2" />
              {loading ? "Creating..." : "Register"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-primary font-medium hover:underline">Login here</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;
