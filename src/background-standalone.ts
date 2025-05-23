/// <reference types="chrome"/>
/**
 * Background Service Worker for J-Archive Chrome Extension
 * Handles archive searching and tab management
 * Self-contained version without module imports
 */

namespace JArchiveBackground {
  interface ArchiveResponse {
    success: boolean;
    archiveUrl?: string;
    error?: string;
  }

  enum MessageType {
    FIND_ARCHIVE = 'find_archive',
    ARCHIVE_FOUND = 'archive_found',
    ARCHIVE_ERROR = 'archive_error',
    OPEN_ARCHIVE = 'open_archive',
    INJECT_CONTENT_SCRIPT = 'inject_content_script'
  }

  interface ExtensionMessage {
    type: MessageType;
    payload?: any;
  }

  // Utility functions (inline)
  function buildArchiveSearchUrl(url: string): string {
    return `https://archive.ph/${encodeURIComponent(url)}`;
  }

  function isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }

  function cleanUrl(url: string): string {
    try {
      // Remove query parameters and hash fragments for archive search
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
    } catch {
      return url;
    }
  }

  export class BackgroundService {
    private readonly ARCHIVE_TIMEOUT = 10000; // 10 seconds timeout

    constructor() {
      this.setupMessageListener();
      this.setupActionListener();
      this.setupInstallListener();
    }

    /**
     * Setup message listener for communication with content scripts
     */
    private setupMessageListener(): void {
      chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
        console.log('J-Archive Background: Message received:', message);

        switch (message.type) {
          case MessageType.FIND_ARCHIVE:
            this.handleFindArchive(message.payload.url, sender.tab?.id);
            break;
            
          case MessageType.OPEN_ARCHIVE:
            this.handleOpenArchive(message.payload.url);
            break;
        }

        return false;
      });
    }

    /**
     * Setup action listener for extension icon clicks
     */
    private setupActionListener(): void {
      chrome.action.onClicked.addListener(async (tab: chrome.tabs.Tab) => {
        console.log('J-Archive Background: Extension icon clicked for tab:', tab.id);
        
        if (!tab.id || !tab.url) {
          console.error('J-Archive Background: Invalid tab data');
          return;
        }

        if (!isValidUrl(tab.url)) {
          console.error('J-Archive Background: Invalid URL:', tab.url);
          return;
        }

        try {
          await this.injectContentScript(tab.id);
          
          setTimeout(() => {
            this.initiateArchiveSearch(tab.url!, tab.id!);
          }, 100);
          
        } catch (error) {
          console.error('J-Archive Background: Failed to inject content script:', error);
        }
      });
    }

    /**
     * Setup installation listener
     */
    private setupInstallListener(): void {
      chrome.runtime.onInstalled.addListener((details: chrome.runtime.InstalledDetails) => {
        console.log('J-Archive Background: Extension installed/updated:', details.reason);
      });
    }

    /**
     * Inject content script into the specified tab
     */
    private async injectContentScript(tabId: number): Promise<void> {
      try {
        // Inject the CSS first
        await chrome.scripting.insertCSS({
          target: { tabId },
          files: ['src/styles.css']
        });

        // Then inject the JavaScript
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['dist/content-standalone.js']
        });

        console.log('J-Archive Background: Content script injected successfully');
      } catch (error) {
        console.error('J-Archive Background: Content script injection failed:', error);
        throw error;
      }
    }

    /**
     * Initiate archive search for the given URL
     */
    private async initiateArchiveSearch(url: string, tabId: number): Promise<void> {
      try {
        // Send message to content script to show UI and start search
        await this.sendMessageToTab(tabId, {
          type: MessageType.INJECT_CONTENT_SCRIPT,
          payload: { url: url }
        });

        // Start the archive search
        await this.handleFindArchive(url, tabId);
      } catch (error) {
        console.error('J-Archive Background: Failed to initiate archive search:', error);
      }
    }

    /**
     * Handle archive finding request
     */
    private async handleFindArchive(url: string, tabId?: number): Promise<void> {
      if (!tabId) {
        console.error('J-Archive Background: No tab ID provided');
        return;
      }

      try {
        const archiveResult = await this.findArchiveVersion(url);
        
        if (archiveResult.success && archiveResult.archiveUrl) {
          this.sendMessageToTab(tabId, {
            type: MessageType.ARCHIVE_FOUND,
            payload: { archiveUrl: archiveResult.archiveUrl }
          });
        } else {
          this.sendMessageToTab(tabId, {
            type: MessageType.ARCHIVE_ERROR,
            payload: { error: archiveResult.error || 'Archive not found' }
          });
        }
      } catch (error) {
        console.error('J-Archive Background: Error finding archive:', error);
        this.sendMessageToTab(tabId, {
          type: MessageType.ARCHIVE_ERROR,
          payload: { error: 'Failed to search for archive' }
        });
      }
    }

    /**
     * Find archive version of any URL
     */
    private async findArchiveVersion(url: string): Promise<ArchiveResponse> {
      try {
        const cleanedUrl = cleanUrl(url);
        const archiveSearchUrl = buildArchiveSearchUrl(cleanedUrl);
        
        console.log('J-Archive Background: Searching at:', archiveSearchUrl);

        return await this.searchArchiveResults(archiveSearchUrl, cleanedUrl);
        
      } catch (error) {
        console.error('J-Archive Background: Archive search failed:', error);
        return {
          success: false,
          error: 'Search failed: ' + (error as Error).message
        };
      }
    }

    /**
     * Search archive.ph for any URL and parse results from TEXT-BLOCK
     */
    private async searchArchiveResults(searchUrl: string, originalUrl: string): Promise<ArchiveResponse> {
      try {
        const response = await fetch(searchUrl, {
          signal: AbortSignal.timeout(this.ARCHIVE_TIMEOUT)
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();
        const archiveUrl = this.parseArchiveResults(html, originalUrl);

        console.log('J-Archive Background: Archive URL:', archiveUrl);

        if (archiveUrl) {
          return {
            success: true,
            archiveUrl: archiveUrl
          };
        }

        return {
          success: false,
          error: 'No archive results found'
        };
      } catch (error) {
        return {
          success: false,
          error: 'Search failed: ' + (error as Error).message
        };
      }
    }

    /**
     * Parse archive.ph search results to find the first valid archive
     */
    private parseArchiveResults(html: string, originalUrl: string): string | null {
      try {
        html = html.slice(html.indexOf('TEXT-BLOCK'));
        const matches = html.match(/https:\/\/archive\.ph\/[a-zA-Z0-9]{5,}/g);
        if (matches && matches.length > 0) {
          return matches[0];
        }
        return null;
      } catch (error) {
        console.error('J-Archive Background: Error parsing results with regex:', error);
        return null;
      }
    }

    /**
     * Handle opening archive in new tab
     */
    private async handleOpenArchive(archiveUrl: string): Promise<void> {
      try {
        await chrome.tabs.create({
          url: archiveUrl,
          active: true
        });
        console.log('J-Archive Background: Opened archive tab:', archiveUrl);
      } catch (error) {
        console.error('J-Archive Background: Failed to open archive tab:', error);
      }
    }

    /**
     * Send message to specific tab
     */
    private async sendMessageToTab(tabId: number, message: ExtensionMessage): Promise<void> {
      try {
        console.log('J-Archive Background: Sending message to tab:', tabId, message);
        await chrome.tabs.sendMessage(tabId, message);
      } catch (error) {
        console.error('J-Archive Background: Failed to send message to tab:', error);
      }
    }
  }
}

// Initialize background service
new JArchiveBackground.BackgroundService();

console.log('J-Archive Background: Service worker initialized'); 
