import { useState, useRef, useCallback } from "react";
import {
  Camera,
  Upload,
  Link as LinkIcon,
  Sparkles,
  Trash2,
  Check,
  Loader2,
  RotateCcw,
  Shield,
  User,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// High-end curated banking & executive preset avatars (SVG data URIs with vector graphics)
export const PRESET_AVATARS = [
  {
    id: "preset-gold-crest",
    name: "Eastern Trust Gold Crest",
    description: "Official Eastern Trust seal in imperial gold on midnight black",
    url: "data:image/svg+xml;utf8," + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
        <defs>
          <radialGradient id="bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#1c1917"/>
            <stop offset="100%" stop-color="#0c0a09"/>
          </radialGradient>
          <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fef08a"/>
            <stop offset="50%" stop-color="#eab308"/>
            <stop offset="100%" stop-color="#a16207"/>
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="100" fill="url(#bg)"/>
        <circle cx="100" cy="100" r="86" fill="none" stroke="url(#gold)" stroke-width="3" stroke-dasharray="4 2"/>
        <circle cx="100" cy="100" r="80" fill="none" stroke="url(#gold)" stroke-width="1.5"/>
        <path d="M100 35 L140 70 L140 125 L100 165 L60 125 L60 70 Z" fill="none" stroke="url(#gold)" stroke-width="3.5" stroke-linejoin="round"/>
        <text x="100" y="112" font-family="'Cinzel', 'Playfair Display', Georgia, serif" font-size="34" font-weight="bold" fill="url(#gold)" text-anchor="middle" letter-spacing="2">ET</text>
        <polygon points="100,50 104,60 114,60 106,66 109,76 100,70 91,76 94,66 86,60 96,60" fill="url(#gold)"/>
      </svg>
    `),
  },
  {
    id: "preset-executive-navy",
    name: "Private Banker Navy",
    description: "Deep executive sapphire with laurel wreath insignia",
    url: "data:image/svg+xml;utf8," + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
        <defs>
          <radialGradient id="navbg" cx="50%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#1e3a8a"/>
            <stop offset="100%" stop-color="#0f172a"/>
          </radialGradient>
          <linearGradient id="plat" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="50%" stop-color="#cbd5e1"/>
            <stop offset="100%" stop-color="#94a3b8"/>
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="100" fill="url(#navbg)"/>
        <circle cx="100" cy="100" r="88" fill="none" stroke="url(#plat)" stroke-width="2"/>
        <circle cx="100" cy="78" r="28" fill="none" stroke="url(#plat)" stroke-width="4"/>
        <path d="M52 154 C52 120 74 116 100 116 C126 116 148 120 148 154" fill="none" stroke="url(#plat)" stroke-width="4" stroke-linecap="round"/>
        <circle cx="100" cy="100" r="92" fill="none" stroke="#3b82f6" stroke-width="1" opacity="0.6"/>
      </svg>
    `),
  },
  {
    id: "preset-emerald-wealth",
    name: "Sovereign Emerald",
    description: "Private wealth green with gold crown heraldry",
    url: "data:image/svg+xml;utf8," + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
        <defs>
          <radialGradient id="embg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#064e3b"/>
            <stop offset="100%" stop-color="#022c22"/>
          </radialGradient>
          <linearGradient id="emgold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fde047"/>
            <stop offset="100%" stop-color="#ca8a04"/>
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="100" fill="url(#embg)"/>
        <circle cx="100" cy="100" r="88" fill="none" stroke="url(#emgold)" stroke-width="2.5"/>
        <path d="M65 125 L75 80 L90 100 L100 70 L110 100 L125 80 L135 125 Z" fill="none" stroke="url(#emgold)" stroke-width="3.5" stroke-linejoin="round"/>
        <circle cx="75" cy="74" r="4" fill="url(#emgold)"/>
        <circle cx="100" cy="64" r="5" fill="url(#emgold)"/>
        <circle cx="125" cy="74" r="4" fill="url(#emgold)"/>
        <line x1="60" y1="133" x2="140" y2="133" stroke="url(#emgold)" stroke-width="3" stroke-linecap="round"/>
      </svg>
    `),
  },
  {
    id: "preset-platinum-shield",
    name: "Titanium Trust Shield",
    description: "Cybernetic high-security banking shield emblem",
    url: "data:image/svg+xml;utf8," + encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
        <defs>
          <radialGradient id="shbg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#18181b"/>
            <stop offset="100%" stop-color="#09090b"/>
          </radialGradient>
          <linearGradient id="ti" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#e4e4e7"/>
            <stop offset="50%" stop-color="#a1a1aa"/>
            <stop offset="100%" stop-color="#52525b"/>
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="100" fill="url(#shbg)"/>
        <circle cx="100" cy="100" r="86" fill="none" stroke="url(#ti)" stroke-width="2"/>
        <path d="M100 40 C130 40 145 50 145 90 C145 130 115 155 100 165 C85 155 55 130 55 90 C55 50 70 40 100 40 Z" fill="none" stroke="url(#ti)" stroke-width="4" stroke-linejoin="round"/>
        <path d="M85 100 L95 110 L120 85" fill="none" stroke="#22c55e" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `),
  },
  {
    id: "preset-corporate-banker-1",
    name: "Executive Banker (Classic)",
    description: "Distinguished corporate financial officer",
    url: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&q=80",
  },
  {
    id: "preset-corporate-banker-2",
    name: "Wealth Manager (Contemporary)",
    description: "Senior vice president of private client wealth",
    url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80",
  },
];

interface AvatarModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAvatarUrl?: string;
  fullName: string;
  initials: string;
  userId: string;
  onAvatarUpdated: (newUrl: string) => void;
}

/**
 * Resizes and compresses an image file to a clean, square JPEG data URL (~25-45 KB).
 * This fits seamlessly in Supabase Auth user_metadata and local storage.
 */
function compressImage(file: File, maxSize = 360, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Unable to decode image file"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context not available"));
          return;
        }

        // Center-crop to square
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;

        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, maxSize, maxSize);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export function AvatarModal({
  open,
  onOpenChange,
  currentAvatarUrl,
  fullName,
  initials,
  userId,
  onAvatarUpdated,
}: AvatarModalProps) {
  const [activeTab, setActiveTab] = useState("upload");
  const [previewUrl, setPreviewUrl] = useState<string>(currentAvatarUrl || "");
  const [customUrl, setCustomUrl] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [fileDetails, setFileDetails] = useState<{
    name: string;
    originalSizeKb: number;
    sizeKb: number;
    format: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize initial state on dialog open
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setPreviewUrl(currentAvatarUrl || "");
      setCustomUrl(
        currentAvatarUrl && !currentAvatarUrl.startsWith("data:") ? currentAvatarUrl : ""
      );
      setFileDetails(null);
      setValidationError(null);
    }
    onOpenChange(nextOpen);
  };

  const handleFile = async (file: File) => {
    setValidationError(null);

    if (!file) return;

    if (file.size === 0) {
      const err = "Selected file is empty (0 bytes). Please choose a valid image file.";
      setValidationError(err);
      toast.error(err);
      return;
    }

    if (!SUPPORTED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
      const typeStr = file.type || "unknown format";
      const err = `Unsupported image format (${typeStr}). Eastern Trust Bank supports JPG, PNG, WEBP, and GIF images.`;
      setValidationError(err);
      toast.error(err);
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      const err = `File size (${sizeMb} MB) exceeds the maximum allowed limit of 10 MB. Please choose a smaller photo.`;
      setValidationError(err);
      toast.error(err);
      return;
    }

    try {
      setIsProcessing(true);
      const compressed = await compressImage(file, 360, 0.85);
      const sizeKb = Math.round((compressed.length * 3) / 4 / 1024);
      setPreviewUrl(compressed);
      setFileDetails({
        name: file.name,
        originalSizeKb: Math.round(file.size / 1024),
        sizeKb,
        format: file.type.replace("image/", "").toUpperCase(),
      });
      setValidationError(null);
      toast.success("Profile photo loaded and optimized!");
    } catch (err) {
      console.error(err);
      const msg = "Unable to process the selected photo. Please ensure it is a valid image.";
      setValidationError(msg);
      toast.error(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset file input so selecting the same file again triggers change
    if (e.target) e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleApplyUrl = () => {
    const trimmed = customUrl.trim();
    if (!trimmed) {
      toast.error("Please enter an image URL.");
      return;
    }
    if (!/^https?:\/\//i.test(trimmed)) {
      toast.error("URL must start with http:// or https://");
      return;
    }
    setPreviewUrl(trimmed);
    setFileDetails(null);
    toast.success("Preview updated with web image URL.");
  };

  const handleSelectPreset = (presetUrl: string, presetName: string) => {
    setPreviewUrl(presetUrl);
    setFileDetails(null);
    toast.success(`Selected "${presetName}" preset.`);
  };

  const handleSave = async () => {
    setIsProcessing(true);
    const finalUrl = previewUrl.trim();

    try {
      // 1. Persist to browser LocalStorage for instant cached rendering
      if (typeof window !== "undefined") {
        if (finalUrl) {
          localStorage.setItem(`etb_avatar_${userId}`, finalUrl);
        } else {
          localStorage.removeItem(`etb_avatar_${userId}`);
        }
      }

      // 2. Persist to Supabase Auth user_metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          avatar_url: finalUrl || null,
        },
      });

      if (authError) {
        console.warn("Could not sync avatar to Supabase auth user_metadata:", authError.message);
      }

      // 3. Gracefully attempt to update profiles table if column exists
      try {
        await supabase
          .from("profiles")
          .update({ avatar_url: finalUrl || null } as any)
          .eq("id", userId);
      } catch {}

      onAvatarUpdated(finalUrl);
      toast.success(finalUrl ? "Profile picture updated successfully!" : "Profile photo removed.");
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to update profile picture.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemovePhoto = async () => {
    setPreviewUrl("");
    setFileDetails(null);
    setCustomUrl("");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Camera className="size-5 text-primary" /> Profile Photo &amp; Avatar
          </DialogTitle>
          <DialogDescription>
            Personalize your Eastern Trust Bank profile. Upload a photo, enter an image link, or select an official executive insignia.
          </DialogDescription>
        </DialogHeader>

        {/* Live Preview Display Card */}
        <div className="flex items-center gap-4 rounded-xl border border-border bg-card/60 p-4">
          <Avatar className="size-20 border-2 border-primary/50 shadow-md">
            {previewUrl ? (
              <AvatarImage src={previewUrl} alt={fullName} className="object-cover" />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-xl font-bold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-base text-foreground truncate">{fullName}</p>
            <p className="text-xs text-muted-foreground">
              {previewUrl
                ? fileDetails
                  ? `Selected image (${fileDetails.sizeKb} KB - optimized for instant loading)`
                  : "Custom avatar active"
                : "Using default monogram initials"}
            </p>
            {previewUrl && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="mt-1 text-xs text-destructive hover:underline flex items-center gap-1"
              >
                <Trash2 className="size-3" /> Remove Photo (Use Initials)
              </button>
            )}
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload" className="text-xs flex items-center gap-1.5">
              <Upload className="size-3.5" /> Upload Photo
            </TabsTrigger>
            <TabsTrigger value="url" className="text-xs flex items-center gap-1.5">
              <LinkIcon className="size-3.5" /> Web Link
            </TabsTrigger>
            <TabsTrigger value="presets" className="text-xs flex items-center gap-1.5">
              <Sparkles className="size-3.5" /> Presets
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: FILE UPLOAD */}
          <TabsContent value="upload" className="space-y-4 pt-3">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={onFileInputChange}
              className="hidden"
            />

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-accent/40"
              }`}
            >
              <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary mb-3">
                <Upload className="size-6" />
              </div>
              <p className="font-semibold text-sm text-foreground">
                Click to upload or drag &amp; drop
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Select a photo from your device. Automatically cropped to a high-definition square.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2.5">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-foreground">JPG</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-foreground">PNG</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-foreground">WEBP</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-foreground">GIF</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">Max 10 MB</span>
              </div>
              <Button type="button" variant="outline" size="sm" className="mt-3.5 text-xs">
                Browse Files from Device
              </Button>
            </div>

            {validationError && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2.5">
                <AlertTriangle className="size-4 shrink-0 mt-0.5 text-destructive" />
                <div className="flex-1">
                  <p className="font-semibold">Invalid File</p>
                  <p className="mt-0.5 text-[11px] text-destructive/90">{validationError}</p>
                </div>
              </div>
            )}

            {fileDetails && (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-400 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="grid size-7 place-items-center rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">
                    <Check className="size-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate max-w-[220px]">{fileDetails.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {fileDetails.format} format · {fileDetails.originalSizeKb} KB original → {fileDetails.sizeKb} KB optimized
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-primary hover:text-primary/90 h-7"
                >
                  Change
                </Button>
              </div>
            )}
          </TabsContent>

          {/* TAB 2: IMAGE URL */}
          <TabsContent value="url" className="space-y-4 pt-3">
            <div className="space-y-2">
              <Label htmlFor="image-url-input" className="text-xs">
                Direct Image Link (HTTPS)
              </Label>
              <div className="flex gap-2">
                <Input
                  id="image-url-input"
                  placeholder="https://images.unsplash.com/..."
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className="text-xs"
                />
                <Button type="button" size="sm" onClick={handleApplyUrl} className="text-xs shrink-0">
                  Preview
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Paste any publicly accessible image URL from your company directory, LinkedIn, or hosting provider.
              </p>
            </div>
          </TabsContent>

          {/* TAB 3: CURATED PRESETS */}
          <TabsContent value="presets" className="space-y-4 pt-3">
            <div className="grid grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1">
              {PRESET_AVATARS.map((p) => {
                const isSelected = previewUrl === p.url;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPreset(p.url, p.name)}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border hover:border-border/80 hover:bg-accent/40"
                    }`}
                  >
                    <Avatar className="size-11 shrink-0 border border-border">
                      <AvatarImage src={p.url} alt={p.name} className="object-cover" />
                      <AvatarFallback className="text-[10px]">ET</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-xs text-foreground truncate flex items-center justify-between">
                        {p.name}
                        {isSelected && <Check className="size-3 text-primary shrink-0 ml-1" />}
                      </p>
                      <p className="text-[10px] text-muted-foreground line-clamp-1">
                        {p.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isProcessing}
            className="text-xs"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Check className="mr-1.5 size-3.5" /> Save Profile Picture
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
