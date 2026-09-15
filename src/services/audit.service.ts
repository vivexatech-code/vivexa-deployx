/**
 * System Audit & Security Logging Service
 * Tracks logins, deployments, payments, domain verifications, and admin actions.
 */

import { collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { AuditLog } from '../types';

export const auditService = {
  async log(params: {
    userId?: string;
    userEmail?: string;
    action: string;
    details?: Record<string, any>;
    ip?: string;
  }): Promise<void> {
    try {
      const logsRef = collection(db, 'auditLogs');
      const entry: Omit<AuditLog, 'id'> = {
        userId: params.userId || 'system',
        userEmail: params.userEmail || 'anonymous',
        action: params.action,
        details: params.details || {},
        ip: params.ip || 'client-ip',
        createdAt: new Date().toISOString(),
      };
      await addDoc(logsRef, entry);
    } catch (err) {
      console.warn('Audit logging failed silently:', err);
    }
  },

  async getRecentLogs(maxCount = 100): Promise<AuditLog[]> {
    try {
      const logsRef = collection(db, 'auditLogs');
      const q = query(logsRef, orderBy('createdAt', 'desc'), limit(maxCount));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<AuditLog, 'id'>),
      }));
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      return [];
    }
  },
};
