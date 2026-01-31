// @ts-nocheck
import React, { 
  createContext, 
  useContext, 
  useState, 
  ReactNode, 
  useEffect, 
  useRef 
} from 'react';
import { 
  EmergencyIncident, 
  UserProfile, 
  HospitalProfile, 
  EmergencyType, 
  VideoEvidence 
} from '../types';
import { db } from '../firebaseConfig'; 
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  setDoc,
  orderBy,
  getDoc
} from 'firebase/firestore';

interface EmergencyContextType {
  currentUser: UserProfile | HospitalProfile | null;
  registerUser: (user: UserProfile) => Promise<void>;
  updateUserProfile: (userId: string, data: Partial<UserProfile>) => Promise<void>;
  registerHospital: (hospital: HospitalProfile) => Promise<void>;
  loginUser: (identifier: string, role: 'general' | 'hospital') => Promise<boolean>;
  logoutUser: () => void;
  sendPasswordReset: (identifier: string, role: 'general' | 'hospital') => Promise<boolean>;

  activeEmergencies: EmergencyIncident[];
  dispatchEmergency: (type: EmergencyType | null) => Promise<void>;
  updateEmergencyType: (incidentId: string, type: EmergencyType | null) => Promise<void>;
  updateEmergencyStatus: (incidentId: string, status: EmergencyIncident['status'], message?: string) => Promise<void>;
  assignHospital: (incidentId: string, hospitalId: string, eta: string) => Promise<void>;
  rejectEmergency: (incidentId: string) => Promise<void>;
  resolveEmergency: (incidentId: string) => Promise<void>;
  addVideoEvidence: (incidentId: string, video: VideoEvidence) => void;
  updateEmergencyLocation: (incidentId: string, lat: number, lng: number) => Promise<void>;
}

const EmergencyContext = createContext<EmergencyContextType | undefined>(undefined);

export const EmergencyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | HospitalProfile | null>(() => {
    try {
      const saved = localStorage.getItem('cers_current_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [activeEmergencies, setActiveEmergencies] = useState<EmergencyIncident[]>([]);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Detect Demo Mode
  const isDemo = !db?.app?.options?.apiKey || 
                 db?.app?.options?.apiKey === "YOUR_API_KEY_HERE";

  // Helper for Demo Data Persistence
  const updateLocalState = (updater: (prev: EmergencyIncident[]) => EmergencyIncident[]) => {
      setActiveEmergencies(prev => {
          const newState = updater(prev);
          localStorage.setItem('cers_emergencies', JSON.stringify(newState));
          return newState;
      });
  };

  // --- REAL-TIME SYNC (FIXED FOR INSTANT UPDATES) ---
  useEffect(() => {
    if (isDemo) {
        const saved = localStorage.getItem('cers_emergencies');
        if (saved) setActiveEmergencies(JSON.parse(saved));
        return;
    }

    try {
      // 1. Query filters out 'resolved' or 'rejected' cases
      const q = query(
        collection(db, "emergencies"), 
        where("status", "in", ["active", "assigned", "enroute", "dispatched", "arrived"]),
        orderBy("timestamp", "desc")
      );

      // 2. onSnapshot provides the real-time stream
      const unsubscribe = onSnapshot(q, (snapshot) => {
        // Mapping ensures React receives a fresh array reference for instant UI updates
        const incidents = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as EmergencyIncident[];
        
        console.log("📡 Cloud Sync: Processing Live Feed...");
        setActiveEmergencies(incidents);
      }, (error) => {
        console.error("Firestore Listener Error (Check Index!):", error);
      });

      unsubscribeRef.current = unsubscribe;
      return () => unsubscribe();
    } catch (err) {
      console.error("Firebase Connection Error:", err);
    }
  }, [isDemo]);

  // Persist session
  useEffect(() => { 
    if (currentUser) localStorage.setItem('cers_current_user', JSON.stringify(currentUser)); 
    else localStorage.removeItem('cers_current_user');
  }, [currentUser]);

  // --- Auth Actions ---

  const registerUser = async (user: UserProfile) => {
    if (!isDemo) await setDoc(doc(db, "users", user.id), user);
    setCurrentUser(user);
  };

  const updateUserProfile = async (userId: string, data: Partial<UserProfile>) => {
    if (currentUser?.id === userId) {
        setCurrentUser(prev => prev ? { ...prev, ...data } as UserProfile : null);
    }
    if (!isDemo) await updateDoc(doc(db, "users", userId), data);
  };

  const registerHospital = async (hospital: HospitalProfile) => {
    if (!isDemo) await setDoc(doc(db, "hospitals", hospital.id), hospital);
    setCurrentUser(hospital);
  };

  const loginUser = async (identifier: string, role: 'general' | 'hospital'): Promise<boolean> => {
     await new Promise(r => setTimeout(r, 800));
     if (role === 'general') {
        const mockUser: UserProfile = {
            id: 'USR-' + Date.now(),
            name: 'Demo User',
            phone: identifier,
            role: 'general',
            medicalInfo: { bloodGroup: 'O+', allergies: 'None' },
            emergencyContacts: [{ name: 'Family', phone: '1234567890', relation: 'Relative' }]
        };
        setCurrentUser(mockUser);
        return true;
     } else {
         const mockHospital: HospitalProfile = {
            id: 'HOSP-DEMO',
            name: 'City General Hospital',
            role: 'hospital',
            resources: { ambulances: 5, doctors: 10, beds: 50 },
            status: 'verified',
            adminDetails: { name: 'Admin', phone: '1234567890', designation: 'Manager' }
         };
         setCurrentUser(mockHospital);
         return true;
     }
  };

  const logoutUser = () => { setCurrentUser(null); localStorage.removeItem('cers_current_user'); };
  const sendPasswordReset = async () => true;

  // --- Emergency Actions (FIXED LOGIC) ---

  const dispatchEmergency = async (type: EmergencyType | null) => {
    if (!currentUser || currentUser.role !== 'general') return;

    const incident: EmergencyIncident = {
      userId: currentUser.id,
      timestamp: new Date().toISOString(),
      status: 'active', // This triggers the dashboard to show it instantly
      type,
      userProfile: currentUser,
      location: { lat: 12.9716, lng: 77.5946, address: 'Surat, India' },
      log: [{ time: new Date().toISOString(), message: 'SOS Activated' }]
    };

    if (!isDemo) {
        // use addDoc to let Firestore trigger the listener for all hospitals
        await addDoc(collection(db, "emergencies"), incident);
    } else {
        updateLocalState(prev => [{ id: `EMG-${Date.now()}`, ...incident }, ...prev]);
    }
  };

  const resolveEmergency = async (incidentId: string) => {
    // 1. Local Optimistic removal
    updateLocalState(prev => prev.filter(e => e.id !== incidentId));
    
    // 2. Global Sync: Setting status to 'resolved' makes it vanish from ALL hospital dashboards
    if (!isDemo) {
        await updateDoc(doc(db, "emergencies", incidentId), { 
          status: 'resolved',
          endedAt: new Date().toISOString()
        });
    }
  };

  const assignHospital = async (incidentId: string, hospitalId: string, eta: string) => {
    const data = { status: 'assigned', assignedHospitalId: hospitalId, ambulanceEta: eta };
    updateLocalState(prev => prev.map(e => e.id === incidentId ? { ...e, ...data } : e));
    if (!isDemo) await updateDoc(doc(db, "emergencies", incidentId), data);
  };

  const updateEmergencyStatus = async (incidentId: string, status: any) => {
    updateLocalState(prev => prev.map(e => e.id === incidentId ? { ...e, status } : e));
    if (!isDemo) await updateDoc(doc(db, "emergencies", incidentId), { status });
  };

  const updateEmergencyLocation = async (incidentId: string, lat: number, lng: number) => {
    if (!isDemo) {
        await updateDoc(doc(db, "emergencies", incidentId), { 
            location: { lat, lng, updatedAt: new Date().toISOString() } 
        });
    }
  };

  const updateEmergencyType = async (incidentId: string, type: EmergencyType | null) => {
    if (!isDemo) await updateDoc(doc(db, 'emergencies', incidentId), { type });
  };

  const rejectEmergency = async (incidentId: string) => {
    if (!isDemo) await updateDoc(doc(db, 'emergencies', incidentId), { status: 'rejected' });
    else updateLocalState(prev => prev.filter(e => e.id !== incidentId));
  };

  const addVideoEvidence = async (incidentId: string, video: VideoEvidence) => {
    if (!isDemo) await updateDoc(doc(db, 'emergencies', incidentId), { videoEvidence: video });
  };

  return (
    <EmergencyContext.Provider value={{
      currentUser, registerUser, updateUserProfile, registerHospital,
      loginUser, logoutUser, sendPasswordReset, activeEmergencies,
      dispatchEmergency, updateEmergencyType, updateEmergencyStatus,
      assignHospital, rejectEmergency, resolveEmergency, addVideoEvidence,
      updateEmergencyLocation
    }}>
      {children}
    </EmergencyContext.Provider>
  );
};

export const useEmergencySystem = () => {
  const context = useContext(EmergencyContext);
  if (!context) throw new Error('useEmergencySystem must be used within EmergencyProvider');
  return context;
};                                