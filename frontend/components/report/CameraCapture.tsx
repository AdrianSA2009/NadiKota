"use client";
import { Camera, Loader2, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

interface CameraCaptureProps {
  /** Omit for local preview ownership; pass null/File to keep capture across parent step unmounts. */
  photo?: File | null;
  onCapture: (file: File) => void;
  onClear?: () => void;
  /** True saat AI sedang memeriksa → tombol ambil ulang dikunci sampai selesai. */
  busy?: boolean;
}

export function CameraCapture({ photo, onCapture, onClear, busy = false }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [localPhoto, setLocalPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ photo: File; url: string } | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const currentPhoto = photo === undefined ? localPhoto : photo;

  useEffect(() => {
    if (!currentPhoto) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setPreview({ photo: currentPhoto, url: reader.result });
    };
    reader.readAsDataURL(currentPhoto);
    return () => reader.abort();
  }, [currentPhoto]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }

  async function startCamera() {
    setCameraError(null);
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
      }
    } catch {
      setCameraError("Kamera tidak dapat digunakan. Izinkan akses kamera lalu coba lagi.");
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError("Kamera belum siap. Tunggu sebentar lalu coba lagi.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], "laporan.jpg", { type: "image/jpeg" });
      if (photo === undefined) setLocalPhoto(file);
      onCapture(file);
      stopCamera();
    }, "image/jpeg", 0.8);
  }

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  return (
    <div className="space-y-4">
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-neutral-950 shadow-inner sm:aspect-[4/3]">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          aria-label="Pratinjau kamera"
          className={`absolute inset-0 size-full object-contain ${currentPhoto ? "hidden" : "block"}`}
        />
        {currentPhoto && preview?.photo === currentPhoto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview.url} alt="Pratinjau foto laporan" className="absolute inset-0 size-full object-contain" />
        )}
        {!currentPhoto && !cameraActive && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center text-sm text-neutral-0/75">
            Buka kamera untuk memotret kerusakan
          </div>
        )}
      </div>
      {currentPhoto ? (
        <Button type="button" variant="secondary" className="w-full" disabled={busy} onClick={() => { if (photo === undefined) setLocalPhoto(null); else onClear?.(); void startCamera(); }}>
          {busy ? <Loader2 className="mr-2 inline size-5 animate-spin" aria-hidden="true" /> : <RotateCcw className="mr-2 inline size-5" aria-hidden="true" />}
          {busy ? "AI sedang memeriksa…" : "Ambil ulang"}
        </Button>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Button type="button" onClick={startCamera}><Camera className="mr-2 inline size-5" aria-hidden="true" />Buka kamera</Button>
          <Button type="button" variant="secondary" onClick={capture}>Ambil foto</Button>
        </div>
      )}
      {cameraError && <p role="alert" className="text-sm text-danger-700">{cameraError}</p>}
    </div>
  );
}
