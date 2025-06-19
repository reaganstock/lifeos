// Clipboard utility that works on both HTTPS and non-HTTPS connections

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    // Try modern clipboard API first (works on HTTPS and localhost)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback for non-HTTPS environments
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    return successful;
  } catch (error) {
    console.error('Failed to copy text:', error);
    return false;
  }
};

export const showCopyFeedback = (element?: HTMLElement) => {
  // Minimal feedback - just a quick visual hint without text change
  if (element) {
    element.style.transform = 'scale(0.95)';
    element.style.opacity = '0.7';
    
    setTimeout(() => {
      element.style.transform = '';
      element.style.opacity = '';
    }, 150);
  }
}; 