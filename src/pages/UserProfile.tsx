import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  User, Mail, Shield, Calendar, Bot, Target,
  KeyRound, Save, CheckCircle, AlertCircle, Crown
} from "lucide-react";
import { isAuthenticated, getUser, saveUser, isAdmin } from "@/lib/auth";
import { api, type User as UserType } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";

const UserProfile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const currentUser = getUser();

  const [profile, setProfile] = useState<UserType | null>(null);
  const [fullName, setFullName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [droneCount, setDroneCount] = useState(0);
  const [predCount, setPredCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated()) { navigate("/login"); return; }
    const load = async () => {
      try {
        const me = await api.auth.me();
        setProfile(me);
        setFullName(me.full_name || me.username);
        const drones = await api.drones.list();
        setDroneCount(drones.length);
      } catch {
        // fallback
        if (currentUser) { setProfile(currentUser as UserType); setFullName(currentUser.full_name || currentUser.username); }
      }
    };
    load();
  }, [navigate, currentUser]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const updated = await api.auth.updateProfile(fullName);
      saveUser(updated, localStorage.getItem('dd_token')!);
      setProfile(updated);
      toast({ title: "✅ Profile updated" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      toast({ title: "Error", description: "New passwords do not match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "New password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    try {
      await api.auth.changePassword(currentPassword, newPassword);
      setCurrentPassword(""); setNewPassword(""); setConfirmNewPassword("");
      toast({ title: "✅ Password changed successfully" });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setSavingPassword(false);
    }
  };

  const formatDate = (s?: string) => { try { return s ? new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'; } catch { return s || '—'; } };
  const admin = isAdmin();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="container mx-auto max-w-2xl">
        <AppHeader title="My Profile" />

        {/* Profile Card */}
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden mb-6 animate-fade-in">
          <div className={`p-8 text-center ${admin ? 'bg-gradient-to-r from-amber-500 to-orange-500' : 'bg-gradient-to-r from-primary to-indigo-600'} text-white relative`}>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20" />
            <div className="relative z-10">
              <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-3 text-3xl font-bold border-2 border-white/40">
                {(profile?.username || '?')[0].toUpperCase()}
              </div>
              <h2 className="text-xl font-bold">{profile?.full_name || profile?.username}</h2>
              <p className="text-sm opacity-80">@{profile?.username}</p>
              <div className="flex justify-center gap-2 mt-2">
                {admin ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold border border-white/30">
                    <Crown className="w-3 h-3" /> Administrator
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold border border-white/30">
                    <User className="w-3 h-3" /> Member
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Info grid */}
          <div className="p-6 grid grid-cols-2 gap-4">
            {[
              { icon: Mail, label: 'Email', value: profile?.email },
              { icon: Shield, label: 'Role', value: profile?.role === 'admin' ? '👑 Admin' : '👤 User' },
              { icon: Calendar, label: 'Member since', value: formatDate(profile?.created_at) },
              { icon: CheckCircle, label: 'Account status', value: profile?.is_active ? '✅ Active' : '🚫 Inactive' },
              { icon: Bot, label: 'Drones registered', value: droneCount },
              { icon: Target, label: 'Predictions', value: predCount },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-3 p-3 bg-accent/30 rounded-xl">
                <Icon className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-semibold">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Edit Profile */}
        <div className="bg-card rounded-xl border shadow-sm p-6 mb-6 animate-fade-in">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-primary" /> Edit Profile
          </h3>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Your display name"
                className="rounded-xl h-11"
              />
            </div>
            <div className="space-y-2 opacity-60">
              <Label>Username (cannot be changed)</Label>
              <Input value={profile?.username || ''} disabled className="rounded-xl h-11" />
            </div>
            <div className="space-y-2 opacity-60">
              <Label>Email (cannot be changed)</Label>
              <Input value={profile?.email || ''} disabled className="rounded-xl h-11" />
            </div>
            <Button type="submit" className="w-full rounded-xl h-11" disabled={savingProfile}>
              {savingProfile ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </span>
              ) : (
                <span className="flex items-center gap-2"><Save className="w-4 h-4" /> Save Profile</span>
              )}
            </Button>
          </form>
        </div>

        {/* Change Password */}
        <div className="bg-card rounded-xl border shadow-sm p-6 mb-6 animate-fade-in">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" /> Change Password
          </h3>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label>Current Password</Label>
              <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Enter current password" className="rounded-xl h-11" required />
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="At least 6 characters" className="rounded-xl h-11" required />
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <div className="relative">
                <Input type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)}
                  placeholder="Repeat new password" className="rounded-xl h-11 pr-10" required />
                {confirmNewPassword && newPassword === confirmNewPassword && (
                  <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
                )}
                {confirmNewPassword && newPassword !== confirmNewPassword && (
                  <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                )}
              </div>
            </div>
            <Button type="submit" variant="outline" className="w-full rounded-xl h-11 border-primary/30" disabled={savingPassword}>
              {savingPassword ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> Changing...
                </span>
              ) : (
                <span className="flex items-center gap-2"><KeyRound className="w-4 h-4" /> Change Password</span>
              )}
            </Button>
          </form>
        </div>

        <AppFooter />
      </div>
    </div>
  );
};

export default UserProfile;
