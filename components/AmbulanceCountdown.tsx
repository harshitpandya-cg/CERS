import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle, Navigation } from 'lucide-react';

// 1. Add an interface to accept the real ETA from the database
interface AmbulanceCountdownProps {
  initialEtaString?: string; // e.g., "6 min"
}

const AmbulanceCountdown: React.FC<AmbulanceCountdownProps> = ({ initialEtaString = "5 min" }) => {
  // 2. Extract the number from the string and convert to total seconds
  const getInitialSeconds = (etaStr: string) => {
    const mins = parseInt(etaStr) || 5; 
    return mins * 60;
  };

  const [totalInitialSeconds] = useState(getInitialSeconds(initialEtaString));
  const [secondsRemaining, setSecondsRemaining] = useState(getInitialSeconds(initialEtaString));
  const [isArrived, setIsArrived] = useState(false);

  // 3. Reset the timer if the hospital updates the ETA live
  useEffect(() => {
    const newSeconds = getInitialSeconds(initialEtaString);
    setSecondsRemaining(newSeconds);
    setIsArrived(newSeconds <= 0);
  }, [initialEtaString]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          setIsArrived(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Styles logic (Keep your existing color logic...)
  let colorClass = 'text-white';
  let bgClass = 'bg-[#2f3640]';
  let borderClass = 'border-gray-600';
  let pulseClass = '';
  let statusText = 'AMBULANCE ETA';

  if (isArrived) {
    bgClass = 'bg-green-600';
    borderClass = 'border-green-400';
    statusText = 'AMBULANCE ARRIVED';
    pulseClass = 'animate-bounce';
  } else if (secondsRemaining < 120) {
    bgClass = 'bg-green-600';
    statusText = 'ARRIVING NOW';
    pulseClass = 'animate-pulse';
  } else if (secondsRemaining < 300) {
    bgClass = 'bg-emergency'; // Assuming bg-emergency is defined in your tailwind config
    statusText = 'ALMOST THERE';
    pulseClass = 'animate-pulse';
  }

  return (
    <div className={`mt-4 rounded-2xl border-2 ${borderClass} ${bgClass} p-4 shadow-xl transition-all duration-500 overflow-hidden relative`}>
      <div className={`flex flex-col items-center justify-center ${pulseClass}`}>
        <div className="text-xs font-bold opacity-80 mb-1 tracking-widest uppercase flex items-center gap-2">
           {isArrived ? <CheckCircle size={14}/> : <Clock size={14}/>}
           {statusText}
        </div>
        <div className={`text-5xl font-black font-mono tracking-tighter ${colorClass} mb-2`}>
          {formatTime(secondsRemaining)}
        </div>
      </div>
      
      {/* Dynamic Progress Bar based on real database time */}
      {!isArrived && (
          <div className="absolute bottom-0 left-0 h-1 bg-white/10 w-full">
            <div 
                className="h-full bg-white/50 transition-all duration-1000 ease-linear" 
                style={{ width: `${(secondsRemaining / totalInitialSeconds) * 100}%` }} 
            />
          </div>
      )}
    </div>
  );
};

export default AmbulanceCountdown;  