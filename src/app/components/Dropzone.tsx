"use client";

import { useState, useRef, useEffect } from "react";
import { UploadCloud, CheckCircle2, AlertTriangle, FileVideo, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropzoneProps {
    id: string;
    label: string;
    requiredTime?: number; // In seconds
    onFileAccepted?: (file: File) => void;
}

export function Dropzone({ id, label, requiredTime, onFileAccepted }: DropzoneProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [videoDuration, setVideoDuration] = useState<number | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") setIsDragging(true);
        else if (e.type === "dragleave" || e.type === "drop") setIsDragging(false);
    };

    const validateAndSetFile = (uploadedFile: File) => {
        if (!uploadedFile.type.startsWith("video/")) {
            setError("Apenas arquivos de vídeo marcados como MP4 ou WebM");
            return;
        }

        const videoElement = document.createElement("video");
        videoElement.preload = "metadata";

        videoElement.onloadedmetadata = () => {
            window.URL.revokeObjectURL(videoElement.src);
            const duration = videoElement.duration;
            setVideoDuration(duration);

            // ASAVIA Rule: Exact or slightly larger duration to cover the audio.
            if (requiredTime && duration < requiredTime - 0.5) {
                setError(`Vídeo muito curto! Precisa ter no mínimo ${requiredTime}s (Atual: ${duration.toFixed(1)}s)`);
                setFile(null);
            } else {
                setError(null);
                setFile(uploadedFile);
                if (onFileAccepted) onFileAccepted(uploadedFile);
            }
        };

        videoElement.src = URL.createObjectURL(uploadedFile);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            validateAndSetFile(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            validateAndSetFile(e.target.files[0]);
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center px-1">
                <label className="text-sm font-semibold text-slate-300">{label}</label>
                {requiredTime && (
                    <span className="text-xs font-mono bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
                        Alvo: {requiredTime}s
                    </span>
                )}
            </div>

            <div
                className={cn(
                    "relative w-full h-36 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-4 text-center cursor-pointer group",
                    isDragging ? "bg-blue-500/10 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]" :
                        file ? "bg-emerald-500/5 border-emerald-500/50 hover:bg-emerald-500/10" :
                            error ? "bg-rose-500/5 border-rose-500 hover:bg-rose-500/10" :
                                "bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:border-slate-500"
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => !file && inputRef.current?.click()}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={handleChange}
                />

                {file ? (
                    <div className="flex flex-col items-center gap-2 w-full">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                        <div className="w-full">
                            <p className="text-emerald-400 font-medium text-sm truncate px-4">{file.name}</p>
                            <p className="text-emerald-500/70 text-xs">{(file.size / (1024 * 1024)).toFixed(1)} MB • {videoDuration?.toFixed(1)}s</p>
                        </div>
                        {/* Remove button */}
                        <button
                            onClick={(e) => { e.stopPropagation(); setFile(null); setError(null); setVideoDuration(null); }}
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-slate-900/50 hover:bg-rose-500/80 hover:text-white transition-colors text-slate-400"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ) : (
                    <>
                        <UploadCloud className={cn("w-8 h-8 mb-2 transition-transform group-hover:-translate-y-1", isDragging ? "text-blue-500" : error ? "text-rose-500" : "text-slate-400")} />
                        <p className={cn("text-sm font-medium", isDragging ? "text-blue-400" : error ? "text-rose-400" : "text-slate-300")}>
                            {isDragging ? "Solte o vídeo aqui!" : "Clique ou arraste um vídeo"}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">MP4, WebM até 150MB</p>
                    </>
                )}
            </div>

            {error && (
                <div className="flex items-start gap-1.5 text-xs text-rose-400 font-medium px-1">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}
