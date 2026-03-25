import type { KesimAlani } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Edit3, Loader2, MessageSquarePlus, Send, Settings2, X } from "lucide-react";
import { updateTrackingNoteStatus, fetchNotificationTemplate, updateNotificationTemplate } from "@/lib/api";

interface NotificationDialogsProps {
  kesim: KesimAlani;
  toast: (opts: any) => void;
  trackingNotesOpen: boolean;
  setTrackingNotesOpen: (val: boolean) => void;
  trackingNotes: any[];
  setTrackingNotes: React.Dispatch<React.SetStateAction<any[]>>;
  trackingNotesLoading: boolean;
  notificationLogsOpen: boolean;
  setNotificationLogsOpen: (val: boolean) => void;
  notificationLogs: any[];
  notificationLogsLoading: boolean;
  notificationTemplateOpen: boolean;
  setNotificationTemplateOpen: (val: boolean) => void;
  notificationTemplate: string;
  setNotificationTemplate: (val: string) => void;
  notificationTemplateSaving: boolean;
  setNotificationTemplateSaving: (val: boolean) => void;
}

export default function NotificationDialogs({
  kesim,
  toast,
  trackingNotesOpen,
  setTrackingNotesOpen,
  trackingNotes,
  setTrackingNotes,
  trackingNotesLoading,
  notificationLogsOpen,
  setNotificationLogsOpen,
  notificationLogs,
  notificationLogsLoading,
  notificationTemplateOpen,
  setNotificationTemplateOpen,
  notificationTemplate,
  setNotificationTemplate,
  notificationTemplateSaving,
  setNotificationTemplateSaving,
}: NotificationDialogsProps) {
  return (
    <>
      <Dialog open={trackingNotesOpen} onOpenChange={setTrackingNotesOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquarePlus className="w-5 h-5" />
              Saha Notları ve Düzenleme Talepleri
            </DialogTitle>
          </DialogHeader>
          {trackingNotesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : trackingNotes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Henüz saha notu veya düzenleme talebi yok.
            </div>
          ) : (
            <div className="space-y-2">
              {trackingNotes.map(note => {
                const groupNo = note.animalGroupId && kesim
                  ? kesim.animalGroups.find(g => g.id === note.animalGroupId)?.animalNo
                  : null;
                return (
                  <div
                    key={note.id}
                    className={`rounded-lg p-3 text-sm border ${
                      note.type === "edit_request"
                        ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                        : "bg-muted/30 border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        {note.type === "edit_request" ? (
                          <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                        ) : (
                          <MessageSquarePlus className="w-3.5 h-3.5 text-blue-500" />
                        )}
                        <span className="text-xs font-semibold">
                          {note.type === "edit_request" ? "Düzenleme Talebi" : "Not"}
                          {groupNo != null && ` — Hayvan ${groupNo}`}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(note.createdAt).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    {note.type === "edit_request" ? (
                      <>
                        <div className="text-xs mb-1">
                          <span className="font-medium">{
                            note.fieldName === "name" ? "Adına Kesilen" :
                            note.fieldName === "description" ? "Vekaleti Veren" :
                            note.fieldName === "donationType" ? "Cinsi" :
                            note.fieldName === "vekalet" ? "Vekalet" :
                            note.fieldName === "notes" ? "Notlar" : note.fieldName
                          }</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs flex-wrap">
                          <span className="line-through text-red-400">{note.oldValue || "—"}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-medium text-emerald-600">{note.newValue}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-2">
                          {note.status === "pending" ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-[10px] text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                                onClick={async () => {
                                  try {
                                    await updateTrackingNoteStatus(kesim!.id, note.id, "approved");
                                    setTrackingNotes(prev => prev.map(n => n.id === note.id ? { ...n, status: "approved" as const } : n));
                                    toast({ title: "Talep onaylandı" });
                                  } catch {
                                    toast({ title: "Hata", variant: "destructive" });
                                  }
                                }}
                              >
                                <Check className="w-2.5 h-2.5 mr-0.5" /> Onayla
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-[10px] text-red-600 border-red-300 hover:bg-red-50"
                                onClick={async () => {
                                  try {
                                    await updateTrackingNoteStatus(kesim!.id, note.id, "rejected");
                                    setTrackingNotes(prev => prev.map(n => n.id === note.id ? { ...n, status: "rejected" as const } : n));
                                    toast({ title: "Talep reddedildi" });
                                  } catch {
                                    toast({ title: "Hata", variant: "destructive" });
                                  }
                                }}
                              >
                                <X className="w-2.5 h-2.5 mr-0.5" /> Reddet
                              </Button>
                            </>
                          ) : (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                              note.status === "approved"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                                : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                            }`}>
                              {note.status === "approved" ? "Onaylandı" : "Reddedildi"}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs whitespace-pre-wrap">{note.content}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={notificationLogsOpen} onOpenChange={setNotificationLogsOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Kesim Bildirimleri
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-end mb-2">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                setNotificationTemplateOpen(true);
                try {
                  const tmpl = await fetchNotificationTemplate();
                  setNotificationTemplate(tmpl);
                } catch {
                  toast({ title: "Hata", description: "Şablon yüklenemedi", variant: "destructive" });
                }
              }}
            >
              <Settings2 className="w-3.5 h-3.5 mr-1" />
              Şablon Düzenle
            </Button>
          </div>
          {notificationLogsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : notificationLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Henüz bildirim kaydı yok. Hayvan kesildi olarak işaretlendiğinde burada görünecek.
            </div>
          ) : (
            <div className="space-y-2">
              {notificationLogs.map(log => (
                <div key={log.id} className="rounded-lg p-3 text-sm border bg-muted/30 border-border">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-xs font-semibold">
                        Hayvan {log.animalNo || "?"} — {log.donorName}
                      </span>
                      {log.phone && (
                        <span className="text-[10px] text-muted-foreground">({log.phone})</span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(log.createdAt).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-xs whitespace-pre-wrap text-muted-foreground">{log.message}</p>
                  <div className="mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-medium">
                      {log.channel === "browser" ? "Tarayıcı" : log.channel}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={notificationTemplateOpen} onOpenChange={setNotificationTemplateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5" />
              Bildirim Şablonu
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="text-xs text-muted-foreground">
              Kullanılabilir değişkenler: <code className="bg-muted px-1 rounded">{"{animalNo}"}</code> (hayvan numarası), <code className="bg-muted px-1 rounded">{"{donorName}"}</code> (bağışçı adı)
            </div>
            <Input
              value={notificationTemplate}
              onChange={(e) => setNotificationTemplate(e.target.value)}
              placeholder="Bildirim mesaj şablonu..."
            />
            <div className="text-xs text-muted-foreground">
              Önizleme: <span className="italic">{notificationTemplate.replace("{animalNo}", "5").replace("{donorName}", "Ahmet Yılmaz")}</span>
            </div>
            <Button
              className="w-full"
              onClick={async () => {
                setNotificationTemplateSaving(true);
                try {
                  await updateNotificationTemplate(notificationTemplate);
                  toast({ title: "Şablon kaydedildi" });
                  setNotificationTemplateOpen(false);
                } catch {
                  toast({ title: "Hata", variant: "destructive" });
                } finally {
                  setNotificationTemplateSaving(false);
                }
              }}
              disabled={notificationTemplateSaving || !notificationTemplate.trim()}
            >
              {notificationTemplateSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Kaydet
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
