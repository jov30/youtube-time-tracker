/**
 * YouTube Time Tracker - Content Script
 * 
 * This script runs on YouTube pages to track actual video watch time.
 * It monitors video playback state and sends accurate time data to background.js.
 */

// Tracking variables
let videoTime = 0;
let lastUpdateTime = 0;
let isPlaying = false;
let videoElement = null;
let timeUpdateInterval = null;
let lastUrl = location.href;
let lastUpdateSent = 0; // Timestamp of last update sent to background

// Throttle function to limit the rate of function calls
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Initialize video tracking by finding the video element and adding event listeners
 */
function initializeVideoTracking() {
  // Only initialize on YouTube watch pages
  if (!window.location.href.includes('youtube.com/watch')) {
    cleanup();
    return;
  }

  // Find video element
  videoElement = document.querySelector('video');
  if (!videoElement) {
    console.log('Video element not found, will try again on DOM changes');
    return;
  }

  console.log('Video tracking initialized');
  
  // Reset tracking state
  videoTime = 0;
  lastUpdateTime = Date.now();
  lastUpdateSent = 0;
  isPlaying = !videoElement.paused;

  // Add event listeners to video element
  videoElement.addEventListener('play', handlePlay);
  videoElement.addEventListener('pause', handlePause);
  videoElement.addEventListener('seeking', handleSeeking);
  videoElement.addEventListener('timeupdate', handleTimeUpdate);

  // Start tracking if video is already playing
  if (isPlaying) {
    startTimeTracking();
  }
  
  // Send initial update
  sendTimeUpdate(true);
}

/**
 * Handle video play event
 */
function handlePlay() {
  console.log('Video started playing');
  isPlaying = true;
  lastUpdateTime = Date.now();
  startTimeTracking();
}

/**
 * Handle video pause event
 */
function handlePause() {
  console.log('Video paused');
  isPlaying = false;
  updateVideoTime();
  stopTimeTracking();
  
  // Send an update when video is paused
  sendTimeUpdate(true);
}

/**
 * Handle video seeking event
 */
function handleSeeking() {
  // Reset the last update time when seeking occurs
  lastUpdateTime = Date.now();
}

/**
 * Handle video timeupdate event (throttled)
 */
const handleTimeUpdate = throttle(() => {
  if (isPlaying) {
    updateVideoTime();
  }
}, 1000);

/**
 * Update video time and send to background script
 */
function updateVideoTime() {
  const currentTime = Date.now();
  const timeDiff = (currentTime - lastUpdateTime) / 1000; // Convert to seconds
  
  if (timeDiff > 0 && isPlaying) {
    videoTime += timeDiff;
    lastUpdateTime = currentTime;
    
    // Send update to background script (throttled)
    sendTimeUpdate();
  }
}

/**
 * Send time update to background script (throttled unless force=true)
 */
function sendTimeUpdate(force = false) {
  const now = Date.now();
  
  // Only send updates every 5 seconds unless forced
  if (force || now - lastUpdateSent > 5000) {
    lastUpdateSent = now;
    
    // Extract video title
    const titleElement = document.querySelector('h1.title.style-scope.ytd-video-primary-info-renderer, h1.style-scope.ytd-watch-metadata');
    const title = titleElement ? titleElement.textContent.trim() : document.title;
    
    // Send updated time to background script
    console.log(`Sending tracked time: ${videoTime.toFixed(1)} seconds for: ${title}`);
    
    browser.runtime.sendMessage({
      type: 'updateVideoTime',
      videoTime: videoTime,
      url: window.location.href,
      title: title
    }).then(response => {
      console.log('Update response:', response);
    }).catch(error => {
      console.error('Error sending video time update:', error);
    });
  }
}

/**
 * Start interval for tracking time
 */
function startTimeTracking() {
  if (!timeUpdateInterval) {
    timeUpdateInterval = setInterval(updateVideoTime, 1000);
  }
}

/**
 * Stop interval for tracking time
 */
function stopTimeTracking() {
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval);
    timeUpdateInterval = null;
  }
}

/**
 * Clean up by removing event listeners and intervals
 */
function cleanup() {
  if (videoElement) {
    videoElement.removeEventListener('play', handlePlay);
    videoElement.removeEventListener('pause', handlePause);
    videoElement.removeEventListener('seeking', handleSeeking);
    videoElement.removeEventListener('timeupdate', handleTimeUpdate);
    videoElement = null;
  }
  stopTimeTracking();
  
  // Send a final update before cleanup
  sendTimeUpdate(true);
}

/**
 * Handle YouTube SPA navigation
 */
function handleUrlChange() {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    console.log('URL changed, reinitializing tracking');
    lastUrl = currentUrl;
    
    // Clean up existing tracking
    cleanup();
    
    // Reinitialize on watch pages
    if (currentUrl.includes('youtube.com/watch')) {
      // Small delay to let YouTube update the page
      setTimeout(initializeVideoTracking, 1000);
    }
  }
}

/**
 * Initialize the extension
 */
function init() {
  console.log('YouTube Time Tracker initialized');
  
  // Create an observer to watch for the video element
  const videoObserver = new MutationObserver(throttle(() => {
    if (document.querySelector('video') && window.location.href.includes('youtube.com/watch')) {
      videoObserver.disconnect();
      initializeVideoTracking();
    }
  }, 1000));

  // Start observing
  videoObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Create an observer for URL changes
  const urlObserver = new MutationObserver(throttle(handleUrlChange, 500));
  
  // Start URL observer
  urlObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Initial check
  if (window.location.href.includes('youtube.com/watch')) {
    setTimeout(initializeVideoTracking, 1000);
  }
}

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    // Update time when tab is hidden
    if (isPlaying) {
      updateVideoTime();
      sendTimeUpdate(true); // Force send update when tab is hidden
    }
  } else if (document.visibilityState === 'visible') {
    // Reset the timer when tab becomes visible again
    if (isPlaying) {
      lastUpdateTime = Date.now();
    }
  }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
  if (isPlaying) {
    updateVideoTime();
    sendTimeUpdate(true); // Force send update before unload
  }
  cleanup();
});

// Start the extension
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
} 