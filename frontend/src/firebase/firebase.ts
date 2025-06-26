import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
} from "firebase/auth";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyDPeegGakaWlCl21QBQ7cOQ_-6yWTxXG94",
  authDomain: "block-by-block-1d4af.firebaseapp.com",
  projectId: "block-by-block-1d4af",
  storageBucket: "block-by-block-1d4af.firebasestorage.app",
  messagingSenderId: "273436925782",
  appId: "1:273436925782:web:3b92d90098ab2489ba80f7",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app);
const googleProvider = new GoogleAuthProvider();

if (import.meta.env.DEV) {
  try {
    connectFunctionsEmulator(functions, "localhost", 5001);
    connectStorageEmulator(Storage, "localhost", 9199);
    console.log("Connected to Functions emulator");
  } catch {
    console.log("Functions emulator already connected or not available");
  }
}

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google:", error);
    throw error;
  }
};

export const signInAsAnonymous = async () => {
  try {
    const result = await signInAnonymously(auth);
    return result.user;
  } catch (error) {
    console.error("Error signing in anonymously:", error);
    throw error;
  }
};

export const signOut = async () => {
  try {
    await auth.signOut();
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
};

export { auth, functions, app };
function connectStorageEmulator(storage: any, arg1: string, arg2: number) {
  throw new Error("Function not implemented.");
}
