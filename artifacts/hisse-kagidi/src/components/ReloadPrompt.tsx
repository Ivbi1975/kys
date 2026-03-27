import { useRegisterSW } from "virtual:pwa-register/react";

function ReloadPrompt() {
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);
      }
    },
  });

  if (!needRefresh && !offlineReady) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border bg-background p-4 shadow-lg">
      {offlineReady ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Uygulama çevrimdışı kullanıma hazır.
          </p>
          <button
            className="shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
            onClick={() => setOfflineReady(false)}
          >
            Kapat
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">
            Yeni sürüm mevcut!
          </p>
          <button
            className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            onClick={() => updateServiceWorker(true)}
          >
            Güncelle
          </button>
        </div>
      )}
    </div>
  );
}

export default ReloadPrompt;
