import React, { useEffect, useState, useRef } from "react";
import { Camera, Trash2, Save, Shield, Lock, Eye, EyeOff, Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Switch } from "../../components/ui/switch";
import { Separator } from "../../components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { toast } from "sonner";
import { useStore } from "../../lib/store";
import { accountApi } from "../../api/accountApi";
import { ImageCropper } from "../../components/ImageCropper";
import { getAssetUrl } from "../../utils/assetUrl";

const LOGO_OPTIONS = [
  "https://api.dicebear.com/7.x/identicon/svg?seed=user1",
  "https://api.dicebear.com/7.x/identicon/svg?seed=user2",
  "https://api.dicebear.com/7.x/identicon/svg?seed=user3",
  "https://api.dicebear.com/7.x/identicon/svg?seed=user4",
  "https://api.dicebear.com/7.x/shapes/svg?seed=user5",
  "https://api.dicebear.com/7.x/shapes/svg?seed=user6",
  "https://api.dicebear.com/7.x/bottts/svg?seed=user7",
  "https://api.dicebear.com/7.x/bottts/svg?seed=user8",
];

export default function AccountSettings() {
  const { currentUser, setCurrentUser } = useStore();
  const [avatar, setAvatar] = useState<string>(getAssetUrl(currentUser?.avatarUrl) || LOGO_OPTIONS[0]);
  const [showLogoSelector, setShowLogoSelector] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [pendingAvatarPreview, setPendingAvatarPreview] = useState<string | null>(null);
  const [showAvatarCropper, setShowAvatarCropper] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const pendingAvatarFileRef = useRef<File | null>(null); // Persist across re-renders

  // Debug: Track when pendingAvatarFile changes
  useEffect(() => {
    console.log('[AccountSettings] STATE CHANGE - pendingAvatarFile:', pendingAvatarFile);
    if (pendingAvatarFile) {
      console.log('[AccountSettings] File is SET:', { name: pendingAvatarFile.name, size: pendingAvatarFile.size });
    } else {
      console.log('[AccountSettings] File is NULL');
      console.trace('[AccountSettings] Stack trace for null file:');
    }
  }, [pendingAvatarFile]);
  const [formData, setFormData] = useState({
    username: currentUser?.username || "",
    email: currentUser?.email || "",
    fullName: currentUser?.username || "",
    bio: "",
  });

  // Password change state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // 2FA state
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [show2FADialog, setShow2FADialog] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");

  useEffect(() => {
    if (currentUser) {
      // Refresh profile from backend to ensure latest data
      accountApi
        .me()
        .then((user) => {
          // Transform backend response to match frontend User type
          const transformedUser = {
            id: user.id,
            username: user.displayName || user.email,
            firstName: user.displayName || "User",
            lastName: "",
            email: user.email,
            country: "N/A",
            role: user.roleAdmin ? "admin" as const : user.roleCreator ? "creator" as const : "solver" as const,
            roleAdmin: user.roleAdmin,
            roleCreator: user.roleCreator,
            roleSolver: user.roleSolver,
            mfaEnabled: Boolean(user.twofaSecret),
            avatarUrl: user.avatarUrl || "",
            pointsTotal: user.pointsTotal || 0,
            badges: user.badges || [],
            followedPlaylists: currentUser.followedPlaylists || [],
            history: currentUser.history || [],
          };
          setCurrentUser(transformedUser);
          setFormData({
            username: user.displayName || user.email,
            email: user.email,
            fullName: user.displayName || "",
            bio: "", // Assuming bio is not part of the user object initially
          });
          setAvatar(getAssetUrl(user.avatarUrl) || LOGO_OPTIONS[0]);
        })
        .catch(() => {
          // fallback to store values if API fails
          setFormData({
            username: currentUser.username,
            email: currentUser.email,
            fullName: currentUser.username,
            bio: "",
          });
          setAvatar(getAssetUrl(currentUser.avatarUrl) || LOGO_OPTIONS[0]);
        });
    }
  }, [currentUser?.id]);

  const handleSave = async () => {
    try {
      console.log('[AccountSettings] handleSave called - Current avatar:', avatar);
      console.log('[AccountSettings] pendingAvatarPreview:', pendingAvatarPreview);
      console.log('[AccountSettings] pendingAvatarFile:', pendingAvatarFile);
      console.log('[AccountSettings] pendingAvatarFileRef.current:', pendingAvatarFileRef.current);
      
      let finalAvatarUrl = avatar;
      
      // Use the ref which persists across re-renders
      const fileToUpload = pendingAvatarFileRef.current || pendingAvatarFile;
      
      // If there's a pending cropped avatar, upload it first
      if (pendingAvatarPreview && fileToUpload) {
        console.log('[AccountSettings] Uploading pending avatar file...');
        setUploadingAvatar(true);
        
        try {
          const updated = await accountApi.uploadAvatar(fileToUpload);
          console.log('[AccountSettings] Upload response:', updated);
          
          if (!updated.avatarUrl) {
            console.error('[AccountSettings] Upload succeeded but no avatarUrl in response');
            toast.error('Upload failed - no URL returned');
            setUploadingAvatar(false);
            return;
          }
          
          finalAvatarUrl = updated.avatarUrl;
          setAvatar(getAssetUrl(finalAvatarUrl) || LOGO_OPTIONS[0]);
          console.log('[AccountSettings] Avatar uploaded successfully:', finalAvatarUrl);
          
          // Clean up preview
          if (pendingAvatarPreview) {
            URL.revokeObjectURL(pendingAvatarPreview);
          }
          setPendingAvatarFile(null);
          setPendingAvatarPreview(null);
          setUploadingAvatar(false);
          
          // Update store with new avatar
          setCurrentUser({
            ...currentUser!,
            avatarUrl: finalAvatarUrl,
          });
        } catch (uploadErr) {
          console.error('[AccountSettings] Avatar upload failed:', uploadErr);
          setUploadingAvatar(false);
          toast.error('Failed to upload avatar');
          return;
        }
      }
      
      console.log('[AccountSettings] Final avatar URL before save:', finalAvatarUrl);
      
      // Prevent blob URLs from being saved (this means user cropped but upload didn't complete)
      // Allow DiceBear and other HTTP(S) URLs to be saved directly
      if (finalAvatarUrl && finalAvatarUrl.startsWith('blob:')) {
        console.error('[AccountSettings] Blob URL detected - avatar was not uploaded properly');
        toast.error('Avatar upload incomplete. Please try uploading again.');
        return;
      }
      
      // Save profile data
      const updated = await accountApi.updateProfile({
        displayName: formData.fullName || formData.username,
        avatarUrl: finalAvatarUrl,
      });
      
      // Update current user while preserving all existing fields
      setCurrentUser({
        ...currentUser!,
        username: updated.displayName || updated.email,
        firstName: updated.displayName || "User",
        email: updated.email,
        avatarUrl: updated.avatarUrl || finalAvatarUrl,
      });
      toast.success("Account settings saved successfully");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to save account settings");
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const handlePasswordChange = async () => {
    if (!passwordData.newPassword || !passwordData.confirmPassword) {
      toast.error("Please fill in all password fields");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    // Strong password validation
    const password = passwordData.newPassword;
    const validations = {
      length: password.length >= 12,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    };

    if (!validations.length) {
      toast.error("Password must be at least 12 characters long");
      return;
    }
    if (!validations.uppercase) {
      toast.error("Password must contain at least one uppercase letter");
      return;
    }
    if (!validations.lowercase) {
      toast.error("Password must contain at least one lowercase letter");
      return;
    }
    if (!validations.number) {
      toast.error("Password must contain at least one number");
      return;
    }
    if (!validations.special) {
      toast.error("Password must contain at least one special character");
      return;
    }

    try {
      await accountApi.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      toast.success("Password updated successfully");
      setShowPasswordDialog(false);
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to change password");
    }
  };

  const handleEnable2FA = async () => {
    try {
      const response = await accountApi.enable2FA();
      setGeneratedCode(response.code);
      setShow2FADialog(true);
      toast.success(`Verification code sent to your device: ${response.code}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to enable 2FA");
    }
  };

  const handleVerify2FA = async () => {
    try {
      await accountApi.verify2FA({ verificationCode });
      setTwoFactorEnabled(true);
      setShow2FADialog(false);
      setVerificationCode("");
      toast.success("Two-factor authentication enabled successfully");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Invalid verification code");
    }
  };

  const handleDisable2FA = async () => {
    try {
      await accountApi.disable2FA();
      setTwoFactorEnabled(false);
      toast.success("Two-factor authentication disabled");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to disable 2FA");
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    // Open cropper
    setPendingAvatarFile(file);
    setShowAvatarCropper(true);
  };

  const handleAvatarCropComplete = async (croppedBlob: Blob) => {
    console.log('[AccountSettings] handleAvatarCropComplete called with blob:', croppedBlob);
    
    // Revoke old preview URL to prevent memory leak
    if (pendingAvatarPreview) {
      console.log('[AccountSettings] Revoking old preview URL:', pendingAvatarPreview);
      URL.revokeObjectURL(pendingAvatarPreview);
    }
    
    // Create a preview URL from the cropped blob
    const previewUrl = URL.createObjectURL(croppedBlob);
    console.log('[AccountSettings] Created new preview URL:', previewUrl);
    setPendingAvatarPreview(previewUrl);
    setAvatar(previewUrl); // Show preview immediately
    
    // Store the blob as File for upload on save
    const croppedFile = new File([croppedBlob], 'avatar.jpg', { type: 'image/jpeg' });
    console.log('[AccountSettings] Created File object:', croppedFile, 'size:', croppedFile.size);
    setPendingAvatarFile(croppedFile);
    pendingAvatarFileRef.current = croppedFile; // Store in ref for persistence
    console.log('[AccountSettings] Set pendingAvatarFile to:', croppedFile);
    console.log('[AccountSettings] Set pendingAvatarFileRef.current to:', croppedFile);
  };

  // Cleanup object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (pendingAvatarPreview) {
        URL.revokeObjectURL(pendingAvatarPreview);
      }
    };
  }, [pendingAvatarPreview]);

  if (!currentUser) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Profile Picture */}
      <Card className="cyber-border">
        <CardHeader>
          <CardTitle>Profile Picture</CardTitle>
          <CardDescription>
            Choose an avatar for your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={avatar} />
              <AvatarFallback>JD</AvatarFallback>
            </Avatar>
            <div className="flex gap-2">
              <input
                ref={avatarInputRef}
                type="file"
                id="avatar-upload"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
              >
                <Upload className="h-4 w-4" />
                {uploadingAvatar ? 'Uploading...' : 'Upload Picture'}
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setShowLogoSelector(!showLogoSelector)}
              >
                <Camera className="h-4 w-4" />
                Choose Avatar
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  setAvatar(LOGO_OPTIONS[0]);
                  setPendingAvatarFile(null);
                  setPendingAvatarPreview(null);
                }}
              >
                <Trash2 className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>

          {pendingAvatarPreview && (
            <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg text-sm">
              <p className="text-primary font-medium">Preview: Click "Save Changes" to apply this avatar</p>
            </div>
          )}

          {showLogoSelector && (
            <div className="grid grid-cols-4 md:grid-cols-8 gap-3 p-4 bg-card/50 rounded-lg border">
              {LOGO_OPTIONS.map((logo, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setAvatar(logo);
                    setShowLogoSelector(false);
                    setPendingAvatarFile(null);
                    setPendingAvatarPreview(null);
                  }}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                    avatar === logo ? "border-primary ring-2 ring-primary" : "border-border"
                  }`}
                >
                  <img src={logo} alt={`Avatar ${index + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ImageCropper
        open={showAvatarCropper}
        onClose={() => {
          setShowAvatarCropper(false);
          setPendingAvatarFile(null);
        }}
        onCropComplete={handleAvatarCropComplete}
        imageFile={pendingAvatarFile}
        title="Crop Profile Picture"
      />

      {/* Personal Information */}
      <Card className="cyber-border">
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>
            Update your account details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => handleChange("username", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={formData.fullName}
              onChange={(e) => handleChange("fullName", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => handleChange("bio", e.target.value)}
              placeholder="Tell us about yourself..."
              rows={4}
            />
          </div>

          <Button onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="cyber-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Security
          </CardTitle>
          <CardDescription>Manage your security settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Change Password */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Change Password
            </Label>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setShowPasswordDialog(true)}
            >
              Update Password
            </Button>
          </div>

          <Separator />

          {/* Two-Factor Authentication */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Two-Factor Authentication</Label>
              <p className="text-sm text-muted-foreground">
                Add an extra layer of security to your account
              </p>
            </div>
            <div className="flex items-center gap-2">
              {twoFactorEnabled && (
                <span className="text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded">
                  Enabled
                </span>
              )}
              <Button
                variant={twoFactorEnabled ? "outline" : "default"}
                size="sm"
                onClick={twoFactorEnabled ? handleDisable2FA : handleEnable2FA}
              >
                {twoFactorEnabled ? "Disable" : "Enable"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Password Change Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="cyber-border">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Create a strong password with the following requirements
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPasswords.new ? "text" : "password"}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showPasswords.confirm ? "text" : "password"}
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Password Requirements */}
            <div className="p-4 bg-muted/50 rounded-lg border space-y-2">
              <p className="text-sm font-medium">Password Requirements:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <span className={passwordData.newPassword.length >= 12 ? "text-green-500" : ""}>
                    {passwordData.newPassword.length >= 12 ? "✓" : "○"}
                  </span>
                  At least 12 characters long
                </li>
                <li className="flex items-center gap-2">
                  <span className={/[A-Z]/.test(passwordData.newPassword) ? "text-green-500" : ""}>
                    {/[A-Z]/.test(passwordData.newPassword) ? "✓" : "○"}
                  </span>
                  At least one uppercase letter (A-Z)
                </li>
                <li className="flex items-center gap-2">
                  <span className={/[a-z]/.test(passwordData.newPassword) ? "text-green-500" : ""}>
                    {/[a-z]/.test(passwordData.newPassword) ? "✓" : "○"}
                  </span>
                  At least one lowercase letter (a-z)
                </li>
                <li className="flex items-center gap-2">
                  <span className={/[0-9]/.test(passwordData.newPassword) ? "text-green-500" : ""}>
                    {/[0-9]/.test(passwordData.newPassword) ? "✓" : "○"}
                  </span>
                  At least one number (0-9)
                </li>
                <li className="flex items-center gap-2">
                  <span className={/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(passwordData.newPassword) ? "text-green-500" : ""}>
                    {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(passwordData.newPassword) ? "✓" : "○"}
                  </span>
                  At least one special character (!@#$%^&*)
                </li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handlePasswordChange}>
              Update Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2FA Verification Dialog */}
      <Dialog open={show2FADialog} onOpenChange={setShow2FADialog}>
        <DialogContent className="cyber-border">
          <DialogHeader>
            <DialogTitle>Enable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Enter the 6-digit verification code sent to your device
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
              <p className="text-sm text-center">
                Verification code sent to: <strong>{formData.email}</strong>
              </p>
              <p className="text-xs text-muted-foreground text-center mt-1">
                (For demo purposes, the code is: <span className="text-primary">{generatedCode}</span>)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="verificationCode">Verification Code</Label>
              <Input
                id="verificationCode"
                type="text"
                maxLength={6}
                placeholder="Enter 6-digit code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                className="text-center text-lg tracking-widest"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShow2FADialog(false);
              setVerificationCode("");
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleVerify2FA}
              disabled={verificationCode.length !== 6}
            >
              Verify & Enable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
