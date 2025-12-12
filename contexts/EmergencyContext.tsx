import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { EmergencyIncident, UserProfile, HospitalProfile, EmergencyType, VideoEvidence } from '../../types';
import { db } from '../../firebaseConfig'; 
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  setDoc,
  orderBy
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
  updateEmergencyType: (incidentId: string, type: EmergencyType) => Promise<void>;
  updateEmergencyStatus: (incidentId: string, status: EmergencyIncident['status'], message?: string) => Promise<void>;
  assignHospital: (incidentId: string, hospitalId: string) => Promise<void>;
  resolveEmergency: (incidentId: string) => Promise<void>;
  addVideoEvidence: (incidentId: string, video: VideoEvidence) => void;
}

const EmergencyContext = createContext<EmergencyContextType | undefined>(undefined);

export const EmergencyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | HospitalProfile | null>(() => {
    const saved = localStorage.getItem('cers_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [activeEmergencies, setActiveEmergencies] = useState<EmergencyIncident[]>([]);

  // Detect Demo Mode (No valid API Key)
  const isDemo = !db.app.options.apiKey || db.app.options.apiKey === "YOUR_API_KEY_HERE";

  // --- REAL-TIME SYNC ---
  useEffect(() => {
    if (isDemo) {
        console.log("CERS+ Running in Demo Mode (Local Storage)");
        const saved = localStorage.getItem('cers_emergencies');
        if (saved) setActiveEmergencies(JSON.parse(saved));
        return;
    }

    const q = query(
      collection(db, "emergencies"), 
      where("status", "!=", "resolved"),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const incidents: EmergencyIncident[] = [];
      snapshot.forEach((doc) => {
        incidents.push({ id: doc.id, ...doc.data() } as EmergencyIncident);
      });
      setActiveEmergencies(incidents);
    }, (error) => {
      console.error("Error fetching emergencies:", error);
      // Fallback for demo without valid API keys
      const saved = localStorage.getItem('cers_emergencies');
      if (saved) setActiveEmergencies(JSON.parse(saved));
    });

    return () => unsubscribe();
  }, [isDemo]);

  // Persist session
  useEffect(() => { 
    if (currentUser) localStorage.setItem('cers_current_user', JSON.stringify(currentUser)); 
    else localStorage.removeItem('cers_current_user');
  }, [currentUser]);

  // Helper for Demo Data Persistence
  const updateLocalState = (updater: (prev: EmergencyIncident[]) => EmergencyIncident[]) => {
      setActiveEmergencies(prev => {
          const newState = updater(prev);
          localStorage.setItem('cers_emergencies', JSON.stringify(newState));
          return newState;
      });
  };

  // --- Auth Actions ---

  const registerUser = async (user: UserProfile) => {
    if (isDemo) {
        setCurrentUser(user);
        return;
    }
    try {
      await setDoc(doc(db, "users", user.id), user);
      setCurrentUser(user);
    } catch (e) {
      console.error("Registration failed", e);
      setCurrentUser(user);
    }
  };

  const updateUserProfile = async (userId: string, data: Partial<UserProfile>) => {
    if (currentUser?.id === userId) {
        setCurrentUser(prev => prev ? { ...prev, ...data } as UserProfile : null);
    }
    if (isDemo) return;
    try {
        await updateDoc(doc(db, "users", userId), data);
    } catch(e) { console.error(e); }
  };

  const registerHospital = async (hospital: HospitalProfile) => {
    if (isDemo) {
        setCurrentUser(hospital);
        return;
    }
    try {
      await setDoc(doc(db, "hospitals", hospital.id), hospital);
      setCurrentUser(hospital);
    } catch(e) { console.error(e); }
  };

  const loginUser = async (identifier: string, role: 'general' | 'hospital'): Promise<boolean> => {
     // Simulate Network
     await new Promise(r => setTimeout(r, 600));

     if (role === 'general') {
        // Try to recover user from local storage first for smoother demo
        const saved = localStorage.getItem('cers_current_user');
        if (saved) {
             const parsed = JSON.parse(saved);
             if (parsed.role === 'general') {
                 setCurrentUser(parsed);
                 return true;
             }
        }

        // If no user found, create a Demo User
        const mockUser: UserProfile = {
            id: 'USR-DEMO-' + Math.floor(Math.random() * 1000),
            name: 'Demo User',
            phone: identifier,
            role: 'general',
            email: 'user@cers.com',
            medicalInfo: {
                bloodGroup: 'O+',
                allergies: 'None',
                conditions: 'None',
                medications: 'None'
            },
            emergencyContacts: [
                { name: 'Family Contact', phone: '1234567890', relation: 'Family' }
            ]
        };
        setCurrentUser(mockUser);
        return true;
     } else {
         const mockHospital: HospitalProfile = {
            id: 'HOSP-DEMO',
            name: 'City General Hospital',
            licenseNumber: 'LIC-001',
            email: identifier,
            role: 'hospital',
            type: 'Hospital',
            serviceAreaRadius: 15,
            adminDetails: { name: 'Admin', phone: '1234567890', designation: 'Manager' },
            resources: { ambulances: 5, doctors: 10, beds: 50 },
            status: 'verified'
         };
         setCurrentUser(mockHospital);
         return true;
     }
  };

  const logoutUser = () => {
    setCurrentUser(null);
  };

  const sendPasswordReset = async (identifier: string, role: 'general' | 'hospital'): Promise<boolean> => {
      return new Promise((resolve) => setTimeout(() => resolve(true), 1500));
  };

  // --- Emergency Actions ---

  const dispatchEmergency = async (type: EmergencyType | null) => {
    // Critical fix: ensure logic works even if currentUser is potentially partial in demo
    if (!currentUser || currentUser.role !== 'general') {
        console.error("No active general user found for dispatch");
        return;
    }
    const user = currentUser as UserProfile;

    // Default Location
    let location = {
        lat: 12.9716, 
        lng: 77.5946,
        address: 'Fetching GPS...'
    };

    // Try to get real location
    if ('geolocation' in navigator) {
        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => 
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 })
            );
            location = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                address: `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`
            };
        } catch (e) {
            console.log("GPS unavailable/timeout, using default");
        }
    }

    const newIncident: EmergencyIncident = {
      id: `EMG-${Date.now()}`, 
      userId: user.id,
      timestamp: new Date().toISOString(),
      status: 'active',
      type: type,
      userProfile: user,
      location: location,
      log: [{ time: new Date().toISOString(), message: 'SOS Activated' }]
    };

    if (isDemo) {
        updateLocalState(prev => [newIncident, ...prev]);
        return;
    }

    try {
      await addDoc(collection(db, "emergencies"), newIncident);
    } catch (e) {
      console.error("Failed to dispatch to cloud", e);
      // Fallback
      setActiveEmergencies(prev => [newIncident, ...prev]);
    }
  };

  const updateEmergencyType = async (incidentId: string, type: EmergencyType) => {
    if (isDemo) {
        updateLocalState(prev => prev.map(e => e.id === incidentId ? { ...e, type: type } : e));
        return;
    }
    try {
        await updateDoc(doc(db, "emergencies", incidentId), { type: type });
    } catch (e) { console.error(e); }
  };

  const updateEmergencyStatus = async (incidentId: string, status: EmergencyIncident['status'], message?: string) => {
    if (isDemo) {
        updateLocalState(prev => prev.map(e => e.id === incidentId ? { ...e, status: status } : e));
        return;
    }
    try {
        await updateDoc(doc(db, "emergencies", incidentId), { status: status });
    } catch(e) { console.error(e); }
  };

  const assignHospital = async (incidentId: string, hospitalId: string) => {
    if (isDemo) {
        updateLocalState(prev => prev.map(e => e.id === incidentId ? { 
            ...e, 
            status: 'assigned',
            assignedHospitalId: hospitalId,
            ambulanceEta: '7 mins'
        } : e));
        return;
    }
    try {
        await updateDoc(doc(db, "emergencies", incidentId), {
            status: 'assigned',
            assignedHospitalId: hospitalId,
            ambulanceEta: '7 mins'
        });
    } catch(e) { console.error(e); }
  };

  const addVideoEvidence = async (incidentId: string, video: VideoEvidence) => {
    console.log("Video Saved:", video.id);
  }

  const resolveEmergency = async (incidentId: string) => {
    if (isDemo) {
        updateLocalState(prev => prev.map(e => e.id === incidentId ? { ...e, status: 'resolved' } : e));
        return;
    }
    try {
        await updateDoc(doc(db, "emergencies", incidentId), { status: 'resolved' });
    } catch(e) { console.error(e); }
  };

  return (
    <EmergencyContext.Provider value={{
      currentUser,
      registerUser,
      updateUserProfile,
      registerHospital,
      loginUser,
      logoutUser,
      sendPasswordReset,
      activeEmergencies,
      dispatchEmergency,
      updateEmergencyType,
      updateEmergencyStatus,
      assignHospital,
      addVideoEvidence,
      resolveEmergency
    }}>
      {children}
    </EmergencyContext.Provider>
  );
};

export const useEmergencySystem = () => {
  const context = useContext(EmergencyContext);
  if (context === undefined) {
    throw new Error('useEmergencySystem must be used within an EmergencyProvider');
  }
  return context;
};