/**
 * Admin Service
 * System metrics, user management, billing overview, and audit logging.
 */

import {
  collection,
  doc,
  getDocs,
  updateDoc,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { UserProfile, Subscription, PaymentRecord, Project, DomainRecord, Deployment, AuditLog, InvoiceRecord } from '../types';

export const adminService = {
  /**
   * Get complete platform stats from real Firestore documents
   */
  async getAdminStats() {
    const usersSnap = await getDocs(collection(db, 'users'));
    const subsSnap = await getDocs(collection(db, 'subscriptions'));
    const paymentsSnap = await getDocs(collection(db, 'payments'));
    const projectsSnap = await getDocs(collection(db, 'projects'));
    const domainsSnap = await getDocs(collection(db, 'domains'));
    const deploymentsSnap = await getDocs(collection(db, 'deployments'));

    const totalUsers = usersSnap.size;

    // Active subscriptions
    let activeSubs = 0;
    subsSnap.forEach((d) => {
      const s = d.data() as Subscription;
      if (s.status === 'active') activeSubs++;
    });

    // Monthly revenue & payment counts
    let totalRevenue = 0;
    let failedPayments = 0;
    paymentsSnap.forEach((d) => {
      const p = d.data() as PaymentRecord;
      if (p.status === 'captured') {
        totalRevenue += p.amount || 0;
      } else if (p.status === 'failed') {
        failedPayments++;
      }
    });

    // Active domains
    let activeDomains = 0;
    domainsSnap.forEach((d) => {
      const dom = d.data() as DomainRecord;
      if (dom.status === 'active') activeDomains++;
    });

    return {
      totalUsers,
      activeSubs,
      totalRevenue,
      totalPayments: paymentsSnap.size,
      failedPayments,
      totalProjects: projectsSnap.size,
      activeDomains,
      totalDeployments: deploymentsSnap.size,
    };
  },

  /**
   * Get all users with search
   */
  async getAllUsers(search = ''): Promise<UserProfile[]> {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    const users = snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserProfile, 'uid'>) }));

    if (search.trim()) {
      const s = search.toLowerCase();
      return users.filter((u) => u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s));
    }
    return users;
  },

  /**
   * Change user role (user <-> admin)
   */
  async updateUserRole(uid: string, role: 'user' | 'admin'): Promise<void> {
    await updateDoc(doc(db, 'users', uid), {
      role,
      updatedAt: new Date().toISOString(),
    });
  },

  /**
   * Get all payments
   */
  async getAllPayments(): Promise<PaymentRecord[]> {
    const q = query(collection(db, 'payments'), orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PaymentRecord, 'id'>) }));
  },

  /**
   * Get all invoices
   */
  async getAllInvoices(): Promise<InvoiceRecord[]> {
    const q = query(collection(db, 'invoices'), orderBy('issuedAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InvoiceRecord, 'id'>) }));
  },

  /**
   * Get all projects
   */
  async getAllProjects(): Promise<Project[]> {
    const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Project, 'id'>) }));
  },

  /**
   * Get all domains
   */
  async getAllDomains(): Promise<DomainRecord[]> {
    const q = query(collection(db, 'domains'), orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DomainRecord, 'id'>) }));
  },

  /**
   * Get all deployments
   */
  async getAllDeployments(): Promise<Deployment[]> {
    const q = query(collection(db, 'deployments'), orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Deployment, 'id'>) }));
  },

  /**
   * Get all subscriptions
   */
  async getAllSubscriptions(): Promise<Subscription[]> {
    const q = query(collection(db, 'subscriptions'), orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Subscription, 'id'>) }));
  },
};
