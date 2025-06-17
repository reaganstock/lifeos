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
  // Simple visual feedback for copy operations
  if (element) {
    const originalText = element.textContent;
    element.textContent = '✓ Copied!';
    element.style.color = '#10b981';
    
    setTimeout(() => {
      element.textContent = originalText;
      element.style.color = '';
    }, 1000);
  }
}; 