"use client";
import { Camera, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

interface CameraCaptureProps {
  onCapture: (file: File) => void;
}

export function CameraCapture({ onCapture }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  async function startCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setCameraError("Kamera tidak dapat digunakan. Izinkan akses kamera lalu coba lagi.");
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], "laporan.jpg", { type: "image/jpeg" });
      setPreview(URL.createObjectURL(file));
      onCapture(file);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    }, "image/jpeg", 0.8);
  }

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  return (
    <div className="space-y-4">
      {preview ? (
        <div className="space-y-3"><img src={preview} alt="Pratinjau foto laporan" className="w-full rounded-xl object-cover" /><Button type="button" variant="secondary" onClick={() => { setPreview(null); startCamera(); }}><RotateCcw className="mr-2 inline size-5" aria-hidden="true" />Ambil foto ulang</Button></div>
      ) : (
        <div className="space-y-3"><video ref={videoRef} autoPlay muted playsInline className="w-full rounded-xl bg-neutral-900" aria-label="Pratinjau kamera" /><div className="flex gap-3"><Button type="button" onClick={startCamera}><Camera className="mr-2 inline size-5" aria-hidden="true" />Buka kamera</Button><Button type="button" variant="secondary" onClick={capture}>Ambil foto</Button></div></div>
      )}
      {cameraError && <p role="alert" className="text-sm text-danger-700">{cameraError}</p>}
    </div>
  );
}
