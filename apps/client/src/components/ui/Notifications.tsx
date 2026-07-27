import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import { IconX } from "@tabler/icons-react";
import classes from "./Notifications.module.css";

export type NotificationColor = "green" | "red" | "yellow" | "blue" | "gray";

export type NotificationData = {
  id?: string;
  title?: string;
  message: string;
  color?: NotificationColor;
  autoClose?: number | false;
};

type NotificationItem = Required<Pick<NotificationData, "id" | "message">> &
  Omit<NotificationData, "id" | "message">;

type NotificationsApi = {
  show: (data: NotificationData) => void;
};

let pushNotification: ((data: NotificationData) => void) | null = null;

export const notifications: NotificationsApi = {
  show(data) {
    pushNotification?.(data);
  },
};

const NotificationsContext = createContext<NotificationsApi | null>(null);

function NotificationView({
  item,
  onDismiss,
}: {
  item: NotificationItem;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    if (item.autoClose === false) return;
    const delay = item.autoClose ?? 4000;
    const timer = window.setTimeout(() => onDismiss(item.id), delay);
    return () => window.clearTimeout(timer);
  }, [item, onDismiss]);

  const colorClass = item.color ? classes[item.color] : undefined;

  return (
    <motion.div
      layout
      className={[classes.toast, colorClass].filter(Boolean).join(" ")}
      data-glass-surface
      initial={{ opacity: 0, x: 20, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.98 }}
      transition={{ duration: 0.18 }}
    >
      <div className={classes.header}>
        <div>
          {item.title ? <p className={classes.title}>{item.title}</p> : null}
          <p className={classes.message}>{item.message}</p>
        </div>
        <button
          type="button"
          className={classes.close}
          aria-label="Dismiss notification"
          onClick={() => onDismiss(item.id)}
        >
          <IconX size={12} />
        </button>
      </div>
    </motion.div>
  );
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const idPrefix = useId();

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const show = useCallback(
    (data: NotificationData) => {
      const id =
        data.id ??
        `${idPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setItems((current) => [...current, { ...data, id }]);
    },
    [idPrefix],
  );

  useEffect(() => {
    pushNotification = show;
    return () => {
      if (pushNotification === show) pushNotification = null;
    };
  }, [show]);

  return (
    <NotificationsContext.Provider value={{ show }}>
      {children}
      <div className={classes.stack} aria-live="polite" aria-relevant="additions">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <NotificationView key={item.id} item={item} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const api = useContext(NotificationsContext);
  if (!api) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }
  return api;
}
