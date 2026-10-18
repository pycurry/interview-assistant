import React, { useState, useEffect, useRef } from 'react';
import { X, ShieldCheck, Video, AlertCircle, RefreshCw } from 'lucide-react';
import { StealthStatus } from '../../main/stealth';

interface ScreenShareTesterProps {
  isOpen: boolean;
  onClose: () => void;
  stealthStatus: StealthStatus | null;
}

export const ScreenShareTester: React.FC<ScreenShareTesterProps> = ({
  isOpen,
  onClose,
  stealthStatus,
}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [sources, setSources] = useState<{ id: string; name: string }[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadSources();
    } else {
      stopCapture();
    }
    return () => {
      stopCapture();
    };
  }, [isOpen]);

  const loadSources = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const desktopSources = await window.electronAPI.getDesktopSources();
      setSources(desktopSources);
      const screen = desktopSources.find((s: { id: string; name: string }) => s.id.startsWith('screen:')) || desktopSources[0];
      if (screen) {
        setSelectedSource(screen.id);
        startCapture(screen.id);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to enumerate screen sources');
    } finally {
      setIsLoading(false);
    }
  };

  const startCapture = async (sourceId: string) => {
    stopCapture();
    setIsLoading(true);
    setError(null);
    try {
      const media = await (navigator.mediaDevices as any).getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
            minWidth: 1280,
            maxWidth: 1920,
            minHeight: 720,
            maxHeight: 1080,
          },
        },
      });

      setStream(media);
      if (videoRef.current) {
        videoRef.current.srcObject = media;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      setError(`Capture failed: ${err.message}. Make sure permissions are granted.`);
    } finally {
      setIsLoading(false);
    }
  };

  const stopCapture = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md no-drag">
      <div className="w-full max-w-2xl bg-dark-bg border border-gray-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-800 bg-dark-surface/80">
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">Screen Share Invisibility Self-Test</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Diagnostic info banner */}
        <div className="p-4 bg-dark-surface/50 border-b border-gray-800 text-xs">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-emerald-300">
                {stealthStatus?.active
                  ? 'Screen Capture Exclusion: ACTIVE'
                  : 'Screen Capture Exclusion: SYSTEM STATUS CHECK'}
              </div>
              <p className="text-gray-300 mt-0.5 leading-relaxed">
                {stealthStatus?.message || 'Inspecting OS window display affinity...'}
              </p>
              <p className="text-gray-400 mt-1 italic text-[11px]">
                Verify below: This test simulates what an interviewer in Zoom/Teams sees. If exclusion is supported, this assistant window will NOT appear in the video feed below!
              </p>
            </div>
          </div>
        </div>

        {/* Video Preview */}
        <div className="flex-1 p-5 flex flex-col items-center justify-center bg-black/60 min-h-[320px]">
          {isLoading && (
            <div className="flex items-center gap-2 text-gray-400 text-xs">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
              <span>Starting desktop screen mirror...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-rose-400 text-xs p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-gray-800 bg-gray-950 flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-contain"
            />
            {!stream && !isLoading && !error && (
              <span className="text-gray-500 text-xs">No active desktop capture</span>
            )}
          </div>
        </div>

        {/* Source selector & Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800 bg-dark-surface/80 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Captured Display:</span>
            <select
              value={selectedSource}
              onChange={(e) => {
                setSelectedSource(e.target.value);
                startCapture(e.target.value);
              }}
              className="bg-dark-bg border border-gray-700 rounded-lg px-2.5 py-1 text-white focus:outline-none focus:border-indigo-500"
            >
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-medium transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
