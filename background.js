/**
 * YouTube Time Tracker - Background Script
 * 
 * Manages video history data and handles communication with content script.
 */

// Constants
const MAX_HISTORY_ENTRIES = 100;
const STORAGE_KEY = 'youtubeHistory';

// Data structure for video history
class VideoHistory {
  constructor() {
    this.entries = [];
    this.loaded = false;
  }

  async load() {
    try {
      console.log('Loading history from storage');
      const data = await browser.storage.local.get(STORAGE_KEY);
      this.entries = data[STORAGE_KEY] || [];
      this.loaded = true;
      console.log(`Loaded ${this.entries.length} history entries`);
    } catch (error) {
      console.error('Error loading history:', error);
      this.entries = [];
    }
  }

  async save() {
    try {
      console.log(`Saving ${this.entries.length} history entries`);
      await browser.storage.local.set({ [STORAGE_KEY]: this.entries });
      console.log('History saved successfully');
    } catch (error) {
      console.error('Error saving history:', error);
    }
  }

  addOrUpdateEntry(url, title, videoTime) {
    const existingEntry = this.entries.find(entry => entry.url === url);
    const timestamp = new Date().toISOString();

    if (existingEntry) {
      console.log(`Updating entry: ${title} (${videoTime.toFixed(1)}s)`);
      existingEntry.videoTime = videoTime;
      existingEntry.lastVisited = timestamp;
      existingEntry.title = title; // Update title in case it changed
    } else {
      console.log(`Adding new entry: ${title} (${videoTime.toFixed(1)}s)`);
      this.entries.unshift({
        url,
        title,
        videoTime,
        firstVisited: timestamp,
        lastVisited: timestamp
      });

      // Limit the number of entries
      if (this.entries.length > MAX_HISTORY_ENTRIES) {
        this.entries = this.entries.slice(0, MAX_HISTORY_ENTRIES);
      }
    }
  }

  getEntries() {
    return this.entries;
  }

  clear() {
    console.log('Clearing all history entries');
    this.entries = [];
  }
}

// Initialize video history
console.log('Initializing YouTube Time Tracker background script');
const videoHistory = new VideoHistory();
videoHistory.load();

// Message handlers
browser.runtime.onMessage.addListener((message, sender) => {
  console.log('Received message:', message.type);
  
  // Handle different message types
  switch (message.type) {
    case 'updateVideoTime':
      return handleUpdateVideoTime(message);

    case 'getHistory':
      return handleGetHistory();

    case 'clearHistory':
      return handleClearHistory();

    case 'exportCSV':
      return Promise.resolve(handleExportCSV());
      
    default:
      console.warn('Unknown message type:', message.type);
      return Promise.resolve({ error: 'Unknown message type' });
  }
});

// Message handler functions
async function handleUpdateVideoTime(message) {
  if (!videoHistory.loaded) {
    await videoHistory.load();
  }
  
  videoHistory.addOrUpdateEntry(
    message.url,
    message.title,
    message.videoTime
  );
  
  await videoHistory.save();
  return { success: true };
}

async function handleGetHistory() {
  if (!videoHistory.loaded) {
    await videoHistory.load();
  }
  
  return videoHistory.getEntries();
}

async function handleClearHistory() {
  if (!videoHistory.loaded) {
    await videoHistory.load();
  }
  
  videoHistory.clear();
  await videoHistory.save();
  return { success: true };
}

function handleExportCSV() {
  if (!videoHistory.loaded || videoHistory.entries.length === 0) {
    console.log('No entries to export or history not loaded yet');
    // Return empty CSV with headers instead of null
    const headers = ['Title', 'URL', 'Watch Time (seconds)', 'First Visited', 'Last Visited'];
    return headers.join(',');
  }
  
  console.log(`Generating CSV for ${videoHistory.entries.length} entries`);
  
  const headers = ['Title', 'URL', 'Watch Time (seconds)', 'First Visited', 'Last Visited'];
  const rows = videoHistory.entries.map(entry => [
    entry.title || 'Unknown Title',
    entry.url || 'Unknown URL',
    (entry.videoTime || 0).toFixed(1),
    entry.firstVisited || new Date().toISOString(),
    entry.lastVisited || new Date().toISOString()
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  return csvContent;
} 