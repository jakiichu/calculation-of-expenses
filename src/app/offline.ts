export async function initializeOffline(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    if (import.meta.env.DEV) {
      // Remove only this app's previous worker, so cached vanilla assets cannot shadow Vite.
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations
          .filter((registration) => registration.active?.scriptURL === `${location.origin}/sw.js`)
          .map((registration) => registration.unregister()),
      );
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key.startsWith('balance-shell-')).map((key) => caches.delete(key)),
      );
    } else {
      await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
    }
  } catch {
    console.warn('Офлайн-кэш недоступен. Для открытия приложения потребуется сервер.');
  }
}
