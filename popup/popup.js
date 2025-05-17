/**
 * YouTube Time Tracker - Popup Script
 */

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('Popup initialized');
  
  // Cache DOM elements
  const historyList = document.getElementById('historyList');
  const emptyState = document.getElementById('emptyState');
  const exportButton = document.getElementById('exportButton');
  const clearButton = document.getElementById('clearButton');
  const toast = document.getElementById('toast');

  // Helper Functions
  function formatTime(seconds) {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      return `${Math.round(seconds / 60)}m`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.round((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  }

  function formatDate(isoString) {
    try {
      return new Date(isoString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      console.error('Error formatting date:', e);
      return 'Unknown date';
    }
  }

  function showToast(message, duration = 3000) {
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, duration);
  }

  // UI Functions
  function createHistoryItem(entry) {
    const item = document.createElement('div');
    item.className = 'history-item';
    
    const title = document.createElement('h3');
    title.textContent = entry.title || 'Unknown Title';
    
    const details = document.createElement('p');
    
    // "Watched for" text node
    details.appendChild(document.createTextNode('Watched for '));
    
    // Time span
    const timeSpan = document.createElement('span');
    timeSpan.className = 'time';
    timeSpan.textContent = formatTime(entry.videoTime || 0);
    details.appendChild(timeSpan);
    
    // Line break
    details.appendChild(document.createElement('br'));
    
    // "First visited" text node
    details.appendChild(document.createTextNode(`First: ${formatDate(entry.firstVisited)}`));
    
    // Line break
    details.appendChild(document.createElement('br'));
    
    // "Last visited" text node
    details.appendChild(document.createTextNode(`Last: ${formatDate(entry.lastVisited)}`));
    
    item.appendChild(title);
    item.appendChild(details);
    
    if (entry.url) {
      item.addEventListener('click', () => {
        browser.tabs.create({ url: entry.url });
      });
    }
    
    return item;
  }

  function updateHistoryDisplay(entries) {
    console.log(`Displaying ${entries ? entries.length : 0} history entries`);
    historyList.innerHTML = '';
    
    if (!entries || entries.length === 0) {
      emptyState.classList.remove('hidden');
      historyList.classList.add('hidden');
    } else {
      emptyState.classList.add('hidden');
      historyList.classList.remove('hidden');
      
      const fragment = document.createDocumentFragment();
      entries.forEach(entry => {
        fragment.appendChild(createHistoryItem(entry));
      });
      historyList.appendChild(fragment);
    }
  }

  // Event Handlers
  async function handleExport() {
    try {
      console.log('Exporting history to CSV');
      
      // Disable button while exporting
      exportButton.disabled = true;
      exportButton.textContent = 'Exporting...';
      
      const csvContent = await browser.runtime.sendMessage({
        type: 'exportCSV'
      });
      
      // Check if we have actual data (more than just the header row)
      const rowCount = csvContent.split('\n').length;
      if (rowCount <= 1) {
        showToast('No history to export');
        return;
      }
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = `youtube-history-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      URL.revokeObjectURL(url);
      showToast('History exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      showToast('Failed to export history');
    } finally {
      // Re-enable button
      exportButton.disabled = false;
      exportButton.textContent = 'Export to CSV';
    }
  }

  async function handleClear() {
    if (confirm('Are you sure you want to clear all watch history?')) {
      try {
        console.log('Clearing history');
        await browser.runtime.sendMessage({ type: 'clearHistory' });
        updateHistoryDisplay([]);
        showToast('History cleared successfully');
      } catch (error) {
        console.error('Clear failed:', error);
        showToast('Failed to clear history');
      }
    }
  }

  // Initialize
  async function init() {
    try {
      console.log('Loading history from background');
      const entries = await browser.runtime.sendMessage({ type: 'getHistory' });
      console.log('Received entries:', entries);
      updateHistoryDisplay(entries);
    } catch (error) {
      console.error('Failed to load history:', error);
      showToast('Failed to load history');
    }
  }

  // Event Listeners
  exportButton.addEventListener('click', handleExport);
  clearButton.addEventListener('click', handleClear);
  
  // Load history when popup is opened
  init();
}); 