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
  getDoc,
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';



interface EmergencyContextType {
  // --- Auth & Session State ---
  currentUser: UserProfile | HospitalProfile | null;
  
  // --- Enhanced Security Auth Actions ---
  // Updated to include password for database-driven registration
  registerHospital: (hospital: HospitalProfile & { password: string }) => Promise<void>; 
  updateHospitalStatus: (hospitalId: string, status: 'verified' | 'rejected', reason?: string) => Promise<void>;
  
  // Updated to support phone/password validation and role checks
  loginUser: (identifier: string, role: 'general' | 'hospital', password?: string) => Promise<boolean>; 
  
  // Clears local storage and state across all tabs
  logoutUser: () => void;
  
  // Logic to open the reset-password component in a new tab
  initiatePasswordReset: () => void; 
  sendPasswordReset: (phone: string, newPassword: string) => Promise<void>;

  
  // Function for the new tab to update the database directly

  // --- Profile Management ---
  registerUser: (user: UserProfile) => Promise<void>;
  updateUserProfile: (userId: string, data: Partial<UserProfile>) => Promise<void>;

  // --- Emergency Operations (Live Sync) ---
  activeEmergencies: EmergencyIncident[];
  dispatchEmergency: (type: EmergencyType | null) => Promise<void>;
  updateEmergencyType: (incidentId: string, type: EmergencyType | null) => Promise<void>;
  updateEmergencyStatus: (incidentId: string, status: EmergencyIncident['status'], message?: string) => Promise<void>;
  
  // Updated to support extra data like 'assignedDoctor' for reports
  assignHospital: (incidentId: string, hospitalId: string, eta: string, extraData?: any) => Promise<void>; 
  
  rejectEmergency: (incidentId: string) => Promise<void>;
  resolveEmergency: (incidentId: string) => Promise<void>;
  addVideoEvidence: (incidentId: string, video: VideoEvidence) => void;
  updateEmergencyLocation: (incidentId: string, lat: number, lng: number) => Promise<void>;
}

const EmergencyContext = createContext<EmergencyContextType | undefined>(undefined);

export const EmergencyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
const [currentUser, setCurrentUser] = useState<UserProfile | HospitalProfile | null>(() => {
  try {
    // 🟢 Changed from localStorage to sessionStorage for multi-tab demo support
    const saved = sessionStorage.getItem('cers_current_user'); 
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
});

  const [activeEmergencies, setActiveEmergencies] = useState<EmergencyIncident[]>([]);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Detect Demo Mode
 const isDemo = false;

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

  // Inside EmergencyProvider


  // Persist session
useEffect(() => { 
  if (currentUser) sessionStorage.setItem('cers_current_user', JSON.stringify(currentUser)); 
  else sessionStorage.removeItem('cers_current_user');
}, [currentUser]);

  // --- Auth Actions ---

  // --- Inside EmergencyProvider in EmergencyContext.tsx ---

// 🟢 Function 1: Logic to open the reset tab
const initiatePasswordReset = () => {
  window.open('/reset-password', '_blank'); // Opens your reset component in a new tab
};

// 🟢 Function 2: Logic to update the database
const sendPasswordReset = async (phone: string, newPassword: string) => {
  try {
    const q = query(
      collection(db, "hospitals"),
      where("adminDetails.phone", "==", phone)
    );

    const snap = await getDocs(q);
    if (snap.empty) {
      alert("🚫 No hospital found with this phone number");
      return;
    }

    await updateDoc(snap.docs[0].ref, {
      password: newPassword,
      passwordLastChanged: new Date().toISOString()
    });

    alert("✅ Password updated. You may close this tab.");
    setTimeout(() => window.close(), 1500);
  } catch {
    alert("System error during reset");
  }
};



const registerUser = async (userData: UserProfile) => {
  try {
    const docRef = await addDoc(collection(db, "users"), {
      ...userData,
      role: "general",
      createdAt: new Date().toISOString(),
    });

    const user = {
      ...userData,
      id: docRef.id,
      role: "general",
    };

    setCurrentUser(user);
    localStorage.setItem("cers_current_user", JSON.stringify(user));
  } catch (error) {
    console.error("User signup error:", error);
    alert("User signup failed");
  }
};
  

  const updateUserProfile = async (
  userId: string,
  data: Partial<UserProfile>
) => {
  try {
    await updateDoc(doc(db, "users", userId), data);
    setCurrentUser(prev => prev ? { ...prev, ...data } : prev);
  } catch (err) {
    console.error("Profile update failed", err);
  }
};


const registerHospital = async (
  hospitalData: HospitalProfile & { password: string }
) => {
  if (isDemo) {
    alert("Database Connection Required"); //
    return; //
  }

  try {
    // 🟢 Status is now "pending" instead of "verified"
    const docRef = await addDoc(collection(db, "hospitals"), {
      ...hospitalData,
      role: "hospital",
      status: "pending", 
      createdAt: new Date().toISOString(), //
    });

    // 🔴 REMOVED: setCurrentUser and localStorage.setItem 
    // We don't want them logged in until an admin approves them.

    alert("✅ Application Submitted! Please wait for admin approval before logging in.");
  } catch (error) {
    console.error("Signup Error:", error); //
    alert("❌ Signup failed. Please try again."); //
  }
};


// Track attempts in state at the provider level
const [loginAttempts, setLoginAttempts] = useState(0);



const loginUser = async (
  identifier: string,
  role: 'general' | 'hospital',
  password?: string
): Promise<boolean> => {
  try {
    if (role === 'general') {
      const q = query(collection(db, "users"), where("phone", "==", identifier));
      const snap = await getDocs(q);
      if (snap.empty) { 
        alert("❌ User not registered"); 
        return false; 
      }
      const user = { ...snap.docs[0].data(), id: snap.docs[0].id };
      setCurrentUser(user);
      return true;
    }

    // 🏥 HOSPITAL LOGIN
    // Search the 'email' field specifically
    const q = query(collection(db, "hospitals"), where("email", "==", identifier));
    const snap = await getDocs(q);

    if (snap.empty) {
      alert("❌ Hospital not registered"); // 🔴 Triggers if email doesn't match a document
      return false;
    }

    const hospital = { ...snap.docs[0].data(), id: snap.docs[0].id };

    // 1️⃣ Password Verification
    if (hospital.password !== password) {
      alert("❌ Incorrect password");
      return false;
    }

    // 2️⃣ Admin Status Check
    if (hospital.status === 'pending') {
      alert("⏳ Access Denied: Your application is still under review.");
      return false;
    }

    if (hospital.status === 'rejected') {
      alert(`🚫 Registration Rejected: ${hospital.rejectionReason || "No reason provided."}`);
      return false;
    }

    // 3️⃣ Success: Only log in if 'verified'
    setCurrentUser(hospital);
    localStorage.setItem("cers_current_user", JSON.stringify(hospital));
    return true;

  } catch (err) {
    console.error("Login Error:", err);
    return false;
  }
};
  

  const SuccessModal = ({ message, onClose }: { message: string, onClose: () => void }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
    <div className="bg-white p-8 rounded-[40px] shadow-2xl max-w-sm w-full text-center border-b-8 border-green-500 transform transition-all scale-100">
      <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle className="text-green-600" size={40} />
      </div>
      <h2 className="text-2xl font-black text-slate-800 mb-2">Success!</h2>
      <p className="text-slate-500 mb-8 leading-relaxed">{message}</p>
      <button 
        onClick={onClose}
        className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
      >
        Continue to Login
      </button>
    </div>
  </div>
);


const updateHospitalStatus = async (
  hospitalId: string, 
  status: 'verified' | 'rejected', 
  reason?: string
) => {
  try {
    // 1. First, find the document where the internal 'licenseNumber' or 'id' matches
    const q = query(
      collection(db, "hospitals"), 
      where("id", "==", hospitalId) // 🟢 Matches the 'HOSP-8836' ID
    );
    
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.error(`❌ Hospital document not found for ID: ${hospitalId}`);
      alert(`Error: No hospital found with ID ${hospitalId}`);
      return;
    }

    // 2. Get the actual Firestore reference for that document
    const hospitalDocRef = querySnapshot.docs[0].ref;
    
    const updateData: any = { 
      status: status,
      updatedAt: new Date().toISOString() 
    };
    
    if (status === 'rejected' && reason) {
      updateData.rejectionReason = reason;
    }

    // 3. Perform the update using the correct reference
    await updateDoc(hospitalDocRef, updateData);
    alert(`✅ Hospital ${status} successfully.`);
    
  } catch (error) {
    console.error("❌ Firestore Update Error:", error);
    alert("❌ Failed to update hospital status.");
  }
};







  
const logoutUser = () => { 
  // 🟢 Clear the live React state
  setCurrentUser(null); 
  
  // 🟢 Remove the persistent token to prevent auto-login on refresh
  localStorage.removeItem('cers_current_user'); 
  
  // Optional: Clear any local emergency data if in demo mode
  if (isDemo) {
    localStorage.removeItem('cers_emergencies');
  }
};

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

  const assignHospital = async (incidentId: string, hospitalId: string, eta: string, extraData?: any) => {
  // 🟢 Updated to merge extraData (like assignedDoctor) into the document
  const data = { 
    status: 'assigned', 
    assignedHospitalId: hospitalId, 
    ambulanceEta: eta,
    ...extraData 
  };
  
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
    currentUser, 
    registerUser, 
    updateUserProfile, 
    registerHospital, 
    loginUser, 
    logoutUser, // 🟢 Ensure this is present for the Sign Out button
    
    // --- Password Recovery ---
    initiatePasswordReset, 
    sendPasswordReset, 

    // --- Hospital Vetting ---
    updateHospitalStatus, // 🟢 ADD THIS LINE TO FIX THE ERROR

    // --- Emergency Feed & Actions ---
    activeEmergencies,
    dispatchEmergency, 
    updateEmergencyType, 
    updateEmergencyStatus,
    assignHospital,
    rejectEmergency, 
    resolveEmergency, 
    addVideoEvidence,
    updateEmergencyLocation
  }}>
    {children}
  </EmergencyContext.Provider>
);
};

// 🟢 Named export for the hook
export const useEmergencySystem = () => {
  const context = useContext(EmergencyContext);
  if (!context) throw new Error('useEmergencySystem must be used within EmergencyProvider');
  return context;
};

// 🔴 Do NOT use "export default EmergencyProvider;" 
// Keep the EmergencyProvider as a named export at the top of the file.