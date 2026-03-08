import { useEffect, useState, useRef, useCallback } from "react";
import { AlertTriangle, X, Phone } from "lucide-react";
import { findNearestPoliceStation } from "@/lib/policeDistance";

const SOS_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const SOS_COUNTDOWN_S = 30; // 30 seconds to dismiss before SOS fires

interface SOSDialogProps {
  isNavigating: boolean;
  userLocation: [number, number] | null;
  onSOSSent: (nearestStation: { title: string; lat: number; lng: number }) => void;
}

export default function SOSDialog({ isNavigating, userLocation, onSOSSent }: SOSDialogProps) {
  const [showPopup, setShowPopup] = useState(false);
  const [countdown, setCountdown] = useState(SOS_COUNTDOWN_S);
  const [sosSent, setSOSSent] = useState(false);
  const lastMovementRef = useRef(Date.now());
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevLocationRef = useRef<[number, number] | null>(null);

  // Track movement by watching location changes
  useEffect(() => {
    if (!isNavigating || !userLocation) return;

    const prev = prevLocationRef.current;
    if (prev && (prev[0] !== userLocation[0] || prev[1] !== userLocation[1])) {
      lastMovementRef.current = Date.now();
    }
    prevLocationRef.current = userLocation;
  }, [userLocation, isNavigating]);

  // Check for no-movement timeout
  useEffect(() => {
    if (!isNavigating) {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
      setShowPopup(false);
      setSOSSent(false);
      return;
    }

    lastMovementRef.current = Date.now();
    setSOSSent(false);

    checkIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - lastMovementRef.current;
      if (elapsed >= SOS_TIMEOUT_MS && !showPopup && !sosSent) {
        setShowPopup(true);
        setCountdown(SOS_COUNTDOWN_S);
      }
    }, 10_000); // check every 10s

    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [isNavigating, showPopup, sosSent]);

  // Countdown when popup is shown
  useEffect(() => {
    if (!showPopup) {
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }

    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          triggerSOS();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [showPopup]);

  const triggerSOS = useCallback(() => {
    setShowPopup(false);
    setSOSSent(true);
    if (countdownRef.current) clearInterval(countdownRef.current);

    const loc = userLocation || [22.3072, 73.1812] as [number, number];
    const nearest = findNearestPoliceStation(loc[0], loc[1]);
    onSOSSent({
      title: nearest.title,
      lat: nearest.coordinates.lat,
      lng: nearest.coordinates.lng,
    });
  }, [userLocation, onSOSSent]);

  const dismissSOS = () => {
    setShowPopup(false);
    lastMovementRef.current = Date.now(); // reset timer
    if (countdownRef.current) clearInterval(countdownRef.current);
  };

  if (!showPopup && !sosSent) return null;

  if (sosSent) {
    return (
      <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[2000] w-80">
        <div className="bg-destructive text-destructive-foreground rounded-lg p-4 shadow-xl border border-destructive/50 space-y-2">
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5 animate-pulse" />
            <span className="font-mono text-sm font-bold">SOS ALERT SENT</span>
          </div>
          <p className="text-xs font-mono opacity-90">
            Emergency alert has been sent to the nearest police station. Help is on the way.
          </p>
          <button
            onClick={() => setSOSSent(false)}
            className="w-full mt-2 rounded-md px-3 py-1.5 text-xs font-mono font-bold bg-destructive-foreground text-destructive hover:opacity-90 transition-all"
          >
            DISMISS
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-foreground/30 backdrop-blur-sm">
      <div className="w-80 bg-card rounded-lg p-5 shadow-2xl border border-destructive/50 space-y-4 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
            <span className="font-mono text-base font-bold">NO MOVEMENT DETECTED</span>
          </div>
          <button onClick={dismissSOS} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm font-mono text-muted-foreground">
          You haven't moved for 5 minutes. Are you okay? SOS will be sent automatically if not dismissed.
        </p>

        <div className="flex items-center justify-center">
          <div className="relative w-20 h-20 flex items-center justify-center">
            <svg className="absolute inset-0 w-20 h-20 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="35" fill="none" stroke="hsl(var(--border))" strokeWidth="4" />
              <circle
                cx="40" cy="40" r="35" fill="none"
                stroke="hsl(var(--destructive))"
                strokeWidth="4"
                strokeDasharray={`${2 * Math.PI * 35}`}
                strokeDashoffset={`${2 * Math.PI * 35 * (1 - countdown / SOS_COUNTDOWN_S)}`}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            <span className="font-mono text-2xl font-bold text-destructive">{countdown}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={dismissSOS}
            className="flex-1 rounded-md px-3 py-2.5 text-sm font-mono font-bold bg-primary text-primary-foreground hover:brightness-110 transition-all"
          >
            I'M OKAY
          </button>
          <button
            onClick={triggerSOS}
            className="flex-1 rounded-md px-3 py-2.5 text-sm font-mono font-bold bg-destructive text-destructive-foreground hover:brightness-110 transition-all"
          >
            SEND SOS NOW
          </button>
        </div>
      </div>
    </div>
  );
}
