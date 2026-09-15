/**
 * Authentication Service
 * Firebase Auth integration with Google sign-in, email/password, and account linking.
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  updateProfile,
  User,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../config/firebase';
import { UserProfile } from '../types';
import { auditService } from './audit.service';

export const authService = {
  /**
   * Sync or fetch user profile from Firestore users/{uid}
   */
  async syncUserProfile(user: User): Promise<UserProfile> {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);

    // Initial admin check - vivexatech@gmail.com is auto-assigned admin role
    const isAdminEmail = user.email?.toLowerCase() === 'vivexatech@gmail.com';

    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      // If user profile exists, update last active
      await updateDoc(userRef, {
        updatedAt: new Date().toISOString(),
        photoURL: user.photoURL || data.photoURL || '',
      }).catch(() => {});

      return {
        ...data,
        photoURL: user.photoURL || data.photoURL,
        role: isAdminEmail ? 'admin' : data.role || 'user',
      };
    }

    // Check if user with same email exists under a different UID (to prevent duplicates)
    if (user.email) {
      const usersQuery = query(
        collection(db, 'users'),
        where('email', '==', user.email.toLowerCase())
      );
      const existingUsers = await getDocs(usersQuery);
      if (!existingUsers.empty) {
        const existingDoc = existingUsers.docs[0];
        const existingData = existingDoc.data() as UserProfile;
        return existingData;
      }
    }

    // Create new profile
    const newProfile: UserProfile = {
      uid: user.uid,
      name: user.displayName || user.email?.split('@')[0] || 'Vivexa Developer',
      email: user.email || '',
      photoURL: user.photoURL || '',
      role: isAdminEmail ? 'admin' : 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(userRef, newProfile);

    await auditService.log({
      userId: user.uid,
      userEmail: user.email || '',
      action: 'USER_SIGNUP',
      details: { method: user.providerData[0]?.providerId || 'password' },
    });

    return newProfile;
  },

  /**
   * Sign up with email & password
   */
  async signUpWithEmail(name: string, email: string, pass: string): Promise<UserProfile> {
    const credential = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    if (name.trim()) {
      await updateProfile(credential.user, { displayName: name.trim() });
    }
    const profile = await this.syncUserProfile(credential.user);
    return profile;
  },

  /**
   * Sign in with email & password
   */
  async signInWithEmail(email: string, pass: string): Promise<UserProfile> {
    const credential = await signInWithEmailAndPassword(auth, email.trim(), pass);
    const profile = await this.syncUserProfile(credential.user);
    await auditService.log({
      userId: profile.uid,
      userEmail: profile.email,
      action: 'USER_LOGIN',
      details: { method: 'password' },
    });
    return profile;
  },

  /**
   * Sign in or link with Google
   */
  async signInWithGoogle(): Promise<UserProfile> {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const profile = await this.syncUserProfile(result.user);
      await auditService.log({
        userId: profile.uid,
        userEmail: profile.email,
        action: 'USER_LOGIN',
        details: { method: 'google' },
      });
      return profile;
    } catch (error: any) {
      // Handle account collision: auth/account-exists-with-different-credential
      if (error.code === 'auth/account-exists-with-different-credential' && error.customData?.email) {
        const pendingCred = GoogleAuthProvider.credentialFromError(error);
        const email = error.customData.email;
        const methods = await fetchSignInMethodsForEmail(auth, email);

        if (methods.includes('password')) {
          throw new Error(
            `An account already exists with ${email} using email & password. Please log in with your password to link your Google account.`
          );
        }
      }
      throw error;
    }
  },

  /**
   * Send password reset email
   */
  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(auth, email.trim());
  },

  /**
   * Log out
   */
  async signOut(): Promise<void> {
    await fbSignOut(auth);
  },

  /**
   * Fetch user profile by UID
   */
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const docSnap = await getDoc(doc(db, 'users', uid));
    if (docSnap.exists()) {
      return docSnap.data() as UserProfile;
    }
    return null;
  },

  /**
   * Update profile information
   */
  async updateProfileData(uid: string, updates: Partial<UserProfile>): Promise<void> {
    await updateDoc(doc(db, 'users', uid), {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  },

  /**
   * Delete user account and clean up database records
   */
  async deleteAccount(uid: string): Promise<void> {
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, 'users', uid)).catch(() => {});
    if (auth.currentUser && auth.currentUser.uid === uid) {
      await auth.currentUser.delete().catch(() => {});
    }
  },
};
