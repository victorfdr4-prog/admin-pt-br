import html2canvas from 'html2canvas';

export const waitForImages = async (container: HTMLElement) => {
  const images = Array.from(container.querySelectorAll('img'));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<boolean>((resolve) => {
          if (img.complete) resolve(true);
          else {
            img.onload = () => resolve(true);
            img.onerror = () => resolve(true);
          }
        })
    )
  );
};

const fileToDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Falha ao converter para Base64.'));
    reader.readAsDataURL(file);
  });

const ensureImageBase64 = async (image: HTMLImageElement, fallbackSrc: string) => {
  const source = image.getAttribute('src') || '';
  if (!source || source.startsWith('data:')) return;

  try {
    const response = await fetch(source, { mode: 'cors', cache: 'force-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    image.src = await fileToDataUrl(blob);
  } catch {
    image.src = fallbackSrc;
  }
};

export const cloneForCanvasExport = async (element: HTMLElement, fallbackImageSrc: string) => {
  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.width = `${element.offsetWidth}px`;
  clone.style.height = `${element.offsetHeight}px`;
  clone.style.position = 'fixed';
  clone.style.left = '-100000px';
  clone.style.top = '0';
  clone.style.pointerEvents = 'none';
  document.body.appendChild(clone);

  const images = Array.from(clone.querySelectorAll('img'));
  await Promise.all(images.map((img) => ensureImageBase64(img, fallbackImageSrc)));
  await waitForImages(clone);
  return clone;
};

export const captureElementPngDataUrl = async (element: HTMLElement) => {
  const canvas = await html2canvas(element, {
    useCORS: false,
    allowTaint: false,
    backgroundColor: null,
    scale: Math.max(2, window.devicePixelRatio || 1),
  });
  return canvas.toDataURL('image/png');
};
