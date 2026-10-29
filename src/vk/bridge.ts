import bridge from '@vkontakte/vk-bridge';

/** ID игры «Дуэль стихий» в каталоге VK Mini Apps. */
export const VK_APP_ID = 54865222;

/**
 * Встроенный клиент VK: посылаем обязательное событие инициализации.
 * В обычном браузере игру не блокируем и не запрашиваем разрешений.
 */
export function initVkMiniApp(): void {
  const appId = new URLSearchParams(window.location.search).get('vk_app_id');
  if (!bridge.isEmbedded() && appId !== String(VK_APP_ID)) return;

  void bridge.send('VKWebAppInit').catch((error: unknown) => {
    console.warn('VK Bridge: не удалось завершить VKWebAppInit', error);
  });
}
