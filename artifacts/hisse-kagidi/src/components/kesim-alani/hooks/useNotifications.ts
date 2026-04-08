import { useState } from "react";
import type { TrackingNote, GroupPhoto, NotificationLog } from "@/lib/api";

export function useNotifications() {
  const [trackingNotesOpen, setTrackingNotesOpen] = useState(false);
  const [trackingNotes, setTrackingNotes] = useState<TrackingNote[]>([]);
  const [trackingNotesLoading, setTrackingNotesLoading] = useState(false);
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});
  const [photoViewGroup, setPhotoViewGroup] = useState<{ id: string; animalNo: number } | null>(null);
  const [photoViewPhotos, setPhotoViewPhotos] = useState<GroupPhoto[]>([]);
  const [photoViewLoading, setPhotoViewLoading] = useState(false);
  const [notificationLogsOpen, setNotificationLogsOpen] = useState(false);
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([]);
  const [notificationLogsLoading, setNotificationLogsLoading] = useState(false);
  const [notificationTemplateOpen, setNotificationTemplateOpen] = useState(false);
  const [notificationTemplate, setNotificationTemplate] = useState("Hayvan {animalNo} kesildi. Hayırlı olsun!");
  const [notificationTemplateSaving, setNotificationTemplateSaving] = useState(false);

  return {
    trackingNotesOpen, setTrackingNotesOpen,
    trackingNotes, setTrackingNotes,
    trackingNotesLoading, setTrackingNotesLoading,
    photoCounts, setPhotoCounts,
    photoViewGroup, setPhotoViewGroup,
    photoViewPhotos, setPhotoViewPhotos,
    photoViewLoading, setPhotoViewLoading,
    notificationLogsOpen, setNotificationLogsOpen,
    notificationLogs, setNotificationLogs,
    notificationLogsLoading, setNotificationLogsLoading,
    notificationTemplateOpen, setNotificationTemplateOpen,
    notificationTemplate, setNotificationTemplate,
    notificationTemplateSaving, setNotificationTemplateSaving,
  };
}
