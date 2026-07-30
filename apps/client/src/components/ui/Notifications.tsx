import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCircleCheck,
  IconInfoCircle,
  IconX,
} from "@tabler/icons-react";
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

const MAX_VISIBLE = 5;
const DEFAULT_AUTO_CLOSE = 4500;

let pushNotification: ((data: NotificationData) => void) | null = null;

export const notifications: NotificationsApi = {
  show(data) {
    pushNotification?.(data);
  },
};

const NotificationsContext = createContext<NotificationsApi | null>(null);

const COLOR_ICONS = {
  green: IconCircleCheck,
  red: IconAlertCircle,
  yellow: IconAlertTriangle,
  blue: IconInfoCircle,
  gray: IconInfoCircle,
} as const;

function NotificationView({
  item,
  onDismiss,
}: {
  item: NotificationItem;
  onDismiss: (id: string) => void;
}) {
  const [paused, setPaused] = useState(false);
  const [tapToDismiss, setTapToDismiss] = useState(false);
  const timerRef = useRef<number | null>(null);
  const remainingRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setTapToDismiss(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const color = item.color ?? "gray";
  const Icon = COLOR_ICONS[color];
  const autoCloseMs =
    item.autoClose === false ? null : (item.autoClose ?? DEFAULT_AUTO_CLOSE);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleDismiss = useCallback(
    (delay: number) => {
      clearTimer();
      if (delay <= 0) {
        onDismiss(item.id);
        return;
      }
      startedAtRef.current = Date.now();
      remainingRef.current = delay;
      timerRef.current = window.setTimeout(() => onDismiss(item.id), delay);
    },
    [clearTimer, item.id, onDismiss],
  );

  useEffect(() => {
    if (autoCloseMs === null) return;
    scheduleDismiss(autoCloseMs);
    return clearTimer;
  }, [autoCloseMs, clearTimer, scheduleDismiss]);

  const pause = useCallback(() => {
    if (autoCloseMs === null || paused) return;
    setPaused(true);
    if (timerRef.current !== null && startedAtRef.current !== null) {
      const elapsed = Date.now() - startedAtRef.current;
      remainingRef.current = Math.max(
        (remainingRef.current ?? autoCloseMs) - elapsed,
        0,
      );
      clearTimer();
    }
  }, [autoCloseMs, clearTimer, paused]);

  const resume = useCallback(() => {
    if (autoCloseMs === null || !paused) return;
    setPaused(false);
    scheduleDismiss(remainingRef.current ?? autoCloseMs);
  }, [autoCloseMs, paused, scheduleDismiss]);

  const colorClass = classes[color];

  const handleTapDismiss = useCallback(() => {
    if (!tapToDismiss) return;
    onDismiss(item.id);
  }, [item.id, onDismiss, tapToDismiss]);

  return (
    <motion.div
      layout
      role={tapToDismiss ? "button" : color === "red" ? "alert" : "status"}
      tabIndex={tapToDismiss ? 0 : undefined}
      className={[classes.toast, colorClass, tapToDismiss ? classes.tappable : ""]
        .filter(Boolean)
        .join(" ")}
      data-glass-surface
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      onClick={tapToDismiss ? handleTapDismiss : undefined}
      onKeyDown={
        tapToDismiss
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onDismiss(item.id);
              }
            }
          : undefined
      }
      onMouseEnter={tapToDismiss ? undefined : pause}
      onMouseLeave={tapToDismiss ? undefined : resume}
      onFocusCapture={tapToDismiss ? undefined : pause}
      onBlurCapture={tapToDismiss ? undefined : resume}
    >
      <div className={classes.body}>
        <span className={classes.iconWrap} aria-hidden>
          <Icon size={15} stroke={1.6} />
        </span>
        <div className={classes.content}>
          {item.title ? <p className={classes.title}>{item.title}</p> : null}
          <p className={classes.message}>{item.message}</p>
        </div>
        <button
          type="button"
          className={classes.close}
          aria-label="Dismiss notification"
          onClick={(event) => {
            event.stopPropagation();
            onDismiss(item.id);
          }}
        >
          <IconX size={14} stroke={1.75} />
        </button>
      </div>
      {autoCloseMs !== null ? (
        <div className={classes.progressTrack} aria-hidden>
          <div
            className={[classes.progressBar, paused ? classes.progressPaused : ""]
              .filter(Boolean)
              .join(" ")}
            style={{ animationDuration: `${autoCloseMs}ms` }}
          />
        </div>
      ) : null}
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
      setItems((current) => {
        const next = [...current, { ...data, id }];
        if (next.length <= MAX_VISIBLE) return next;
        return next.slice(next.length - MAX_VISIBLE);
      });
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
      <div
        className={classes.stack}
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Notifications"
      >
        <AnimatePresence initial={false} mode="popLayout">
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
