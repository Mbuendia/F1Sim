import React, { useEffect } from 'react';
import styles from './DnfNotificationModal.module.css';
import { DnfNotification } from '../types/f1';
import { AlertOctagon, X } from 'lucide-react';

interface DnfNotificationModalProps {
  notification: DnfNotification | null;
  onDismiss: () => void;
}

export const DnfNotificationModal: React.FC<DnfNotificationModalProps> = ({
  notification,
  onDismiss
}) => {
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 7000); // Auto-dismiss after 7 seconds
    return () => clearTimeout(timer);
  }, [notification?.id, onDismiss]);

  if (!notification) return null;

  return (
    <div className={styles.notificationContainer}>
      <div className={styles.dnfCard}>
        <div className={styles.headerRow}>
          <div className={styles.badgeDnf}>
            <AlertOctagon size={13} />
            <span>ABANDONO · DNF</span>
          </div>
          <button 
            className={styles.closeBtn} 
            onClick={onDismiss}
            title="Cerrar notificación"
          >
            <X size={14} />
          </button>
        </div>

        <div className={styles.driverInfoRow}>
          <span className={styles.driverFlag}>{notification.driverCountryFlag}</span>
          <div className={styles.driverNameGroup}>
            <div className={styles.driverFullName}>
              <span>{notification.driverName}</span>
              <span style={{ color: notification.teamColor }}>#{notification.driverNumber}</span>
            </div>
            <div className={styles.driverTeam}>{notification.teamName}</div>
          </div>
        </div>

        <div className={styles.causeBox}>
          <span>{notification.reason}</span>
          <span className={styles.metaInfo}>VUELTA {notification.lap} · SECTOR {notification.sector}</span>
        </div>
      </div>
    </div>
  );
};
