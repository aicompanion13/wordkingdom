const CAPTURE_TIMEOUT_MS = 7000;

export async function captureElementScreenshot(element: HTMLElement): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import("html2canvas-pro");
  const capture = html2canvas(element, {
    backgroundColor: null,
    useCORS: true,
    scale: Math.min(window.devicePixelRatio || 1, 2),
  });
  const timeout = new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error("Screenshot capture timed out")), CAPTURE_TIMEOUT_MS);
  });
  return Promise.race([capture, timeout]);
}
