/**
 * Notification Service
 * Delivers alerts for deployment states, billing reminders, and domain events.
 */

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { NotificationItem } from '../types';

export const notificationService = {
  async send(params: {
    userId: string;
    title: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    link?: string;
  }): Promise<void> {
    try {
      const ref = collection(db, 'notifications');
      await addDoc(ref, {
        userId: params.userId,
        title: params.title,
        message: params.message,
        type: params.type || 'info',
        read: false,
        link: params.link || '',
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Failed to send notification:', err);
    }
  },

  async getUserNotifications(userId: string): Promise<NotificationItem[]> {
    try {
      const ref = collection(db, 'notifications');
      const q = query(
        ref,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<NotificationItem, 'id'>),
      }));
    } catch (err) {
      console.warn('Failed to fetch user notifications:', err);
      return [];
    }
  },

  async markAsRead(notificationId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), {
        read: true,
      });
    } catch (err) {
      console.warn('Failed to mark notification as read:', err);
    }
  },
};
