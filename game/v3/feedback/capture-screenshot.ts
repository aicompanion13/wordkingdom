export async function captureElementScreenshot(element: HTMLElement): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import("html2canvas-pro");
  return html2canvas(element, {
    backgroundColor: null,
    useCORS: true,
    scale: Math.min(window.devicePixelRatio || 1, 2),
  });
}
