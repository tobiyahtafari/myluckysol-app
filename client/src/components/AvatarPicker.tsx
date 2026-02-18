import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PRESET_AVATARS } from "@/lib/avatar-list";
import { Upload, Check, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface AvatarPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAvatar?: string;
  canUpload: boolean;
  onSelect: (avatarUrl: string) => void;
  isLoading?: boolean;
}

function scaleImage(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => {
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context unavailable"));
          return;
        }
        const srcSize = Math.min(img.width, img.height);
        const sx = (img.width - srcSize) / 2;
        const sy = (img.height - srcSize) / 2;
        ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, maxSize, maxSize);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function AvatarPicker({ open, onOpenChange, currentAvatar, canUpload, onSelect, isLoading }: AvatarPickerProps) {
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [isScaling, setIsScaling] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePresetSelect = (url: string) => {
    setSelectedAvatar(url);
  };

  const handleConfirm = () => {
    if (selectedAvatar) {
      onSelect(selectedAvatar);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) return;

    setIsScaling(true);
    try {
      const scaled = await scaleImage(file, 218);
      setSelectedAvatar(scaled);
    } catch {
    } finally {
      setIsScaling(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleClose = (val: boolean) => {
    if (!val) setSelectedAvatar(null);
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Choose Your Avatar</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 -mr-1">
          <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-7 gap-3 py-2">
            {PRESET_AVATARS.map((url, i) => {
              const isSelected = selectedAvatar === url;
              const isCurrent = currentAvatar === url;
              return (
                <button
                  key={i}
                  onClick={() => handlePresetSelect(url)}
                  className={`relative aspect-square rounded-full overflow-hidden border-2 transition-colors cursor-pointer ${
                    isSelected
                      ? "border-primary ring-2 ring-primary/50"
                      : isCurrent
                      ? "border-accent"
                      : "border-transparent"
                  }`}
                  data-testid={`button-avatar-preset-${i + 1}`}
                >
                  <img src={url} alt={`Avatar ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                  {isCurrent && !isSelected && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Check className="w-5 h-5 text-accent" />
                    </div>
                  )}
                  {isSelected && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Check className="w-5 h-5 text-primary" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {canUpload && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isScaling}
                  className="gap-2"
                  data-testid="button-avatar-upload"
                >
                  {isScaling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Upload Custom Avatar
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {selectedAvatar && selectedAvatar.startsWith("data:") && (
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary">
                    <img src={selectedAvatar} alt="Custom upload preview" className="w-full h-full object-cover" />
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Image will be scaled to 218x218
                </p>
              </div>
            </div>
          )}

          {!canUpload && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Pay the username fee to unlock custom avatar uploads
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button variant="outline" onClick={() => handleClose(false)} data-testid="button-avatar-cancel">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedAvatar || isLoading}
            data-testid="button-avatar-confirm"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Set Avatar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
