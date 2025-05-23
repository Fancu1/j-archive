/// <reference types="chrome"/>
/**
 * Content Script for J-Archive Chrome Extension
 * Runs on any webpage to provide archive functionality when manually triggered
 * Self-contained version without module imports
 */

namespace JArchiveContent {
  interface UIState {
    isLoading: boolean;
    hasArchive: boolean;
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

  // Archive Notification UI Class
  export class ArchiveNotificationUI {
    private container: HTMLElement | null = null;
    private state: UIState = {
      isLoading: false,
      hasArchive: false
    };
    private currentUrl: string = '';

    /**
     * Initialize and inject the notification UI into the page
     */
    public init(url: string): void {
      this.currentUrl = url;
      this.createNotificationUI();
      this.bindEvents();
      // Start in loading state
      this.updateState({ isLoading: true });
    }

    /**
     * Create the notification UI container and inject it into the page
     */
    private createNotificationUI(): void {
      this.cleanup();

      this.container = document.createElement('div');
      this.container.id = 'j-archive-notification';
      this.container.className = 'j-archive-notification';
      
      document.body.appendChild(this.container);
      this.renderUI();
      
      setTimeout(() => {
        this.container?.classList.add('j-archive-notification-visible');
      }, 10);
    }

    /**
     * Render the UI based on current state
     */
    private renderUI(): void {
      if (!this.container) return;

      if (this.state.isLoading) {
        this.container.innerHTML = this.getLoadingHTML();
      } else if (this.state.hasArchive && this.state.archiveUrl) {
        this.container.innerHTML = this.getArchiveFoundHTML();
      } else if (this.state.error) {
        this.container.innerHTML = this.getErrorHTML();
      }
    }

    /**
     * Get HTML for loading state
     */
    private getLoadingHTML(): string {
      return `
        <div class="j-archive-notification-content">
          <div class="j-archive-notification-header">
            <span class="j-archive-notification-icon j-archive-spinning">🔍</span>
            <span class="j-archive-notification-title">Searching Archive...</span>
            <button class="j-archive-notification-close" id="j-archive-close-btn">×</button>
          </div>
          <div class="j-archive-notification-body">
            <p>Looking for archived version on archive.ph</p>
          </div>
        </div>
      `;
    }

    /**
     * Get HTML for archive found state
     */
    private getArchiveFoundHTML(): string {
      return `
        <div class="j-archive-notification-content j-archive-success">
          <div class="j-archive-notification-header">
            <span class="j-archive-notification-icon">✅</span>
            <span class="j-archive-notification-title">Archive Found!</span>
            <button class="j-archive-notification-close" id="j-archive-close-btn">×</button>
          </div>
          <div class="j-archive-notification-body">
            <p>Archived version is available</p>
            <button id="j-archive-open-btn" class="j-archive-notification-btn j-archive-btn-success">
              Open Archive
            </button>
          </div>
        </div>
      `;
    }

    /**
     * Get HTML for error state
     */
    private getErrorHTML(): string {
      return `
        <div class="j-archive-notification-content j-archive-error">
          <div class="j-archive-notification-header">
            <span class="j-archive-notification-icon">❌</span>
            <span class="j-archive-notification-title">Archive Not Found</span>
            <button class="j-archive-notification-close" id="j-archive-close-btn">×</button>
          </div>
          <div class="j-archive-notification-body">
            <p>${this.state.error || 'No archived version available'}</p>
          </div>
        </div>
      `;
    }

    /**
     * Bind event listeners to the UI elements
     */
    private bindEvents(): void {
      if (!this.container) return;

      this.container.addEventListener('click', (event) => {
        this.handleClick(event);
      });
    }

    /**
     * Handle click events within the notification
     */
    private handleClick(event: Event): void {
      const target = event.target as HTMLElement;
      
      if (target.id === 'j-archive-close-btn') {
        this.close();
      } else if (target.id === 'j-archive-open-btn') {
        this.openArchive();
      }
    }

    /**
     * Close the notification with animation
     */
    private close(): void {
      if (!this.container) return;
      
      this.container.classList.add('j-archive-notification-closing');
      setTimeout(() => {
        this.cleanup();
      }, 300);
    }

    /**
     * Open the archive URL in a new tab
     */
    private openArchive(): void {
      if (this.state.archiveUrl) {
        // Send message to background script to open the archive
        chrome.runtime.sendMessage({
          type: MessageType.OPEN_ARCHIVE,
          payload: { url: this.state.archiveUrl }
        });
        this.close();
      }
    }

    /**
     * Update the UI state and re-render
     */
    public updateState(newState: Partial<UIState>): void {
      this.state = { ...this.state, ...newState };
      this.renderUI();
    }

    /**
     * Handle messages from background script
     */
    public handleMessage(message: ExtensionMessage): void {
      switch (message.type) {
        case MessageType.ARCHIVE_FOUND:
          this.updateState({
            isLoading: false,
            hasArchive: true,
            archiveUrl: message.payload.archiveUrl,
            error: undefined
          });
          break;
          
        case MessageType.ARCHIVE_ERROR:
          this.updateState({
            isLoading: false,
            hasArchive: false,
            archiveUrl: undefined,
            error: message.payload.error
          });
          break;
      }
    }

    /**
     * Clean up and remove the notification from the page
     */
    public cleanup(): void {
      if (this.container) {
        this.container.remove();
        this.container = null;
      }
    }
  }

  // Content Script Manager
  export class ContentScript {
    private ui: ArchiveNotificationUI | null = null;
    private initialized = false;

    /**
     * Initialize the content script (called when injected)
     */
    public init(): void {
      if (this.initialized) {
        console.log('J-Archive Content: Already initialized');
        return;
      }

      console.log('J-Archive Content: Initializing on', window.location.href);
      this.setupMessageListener();
      this.initialized = true;
    }

    /**
     * Setup message listener for communication with background script
     */
    private setupMessageListener(): void {
      chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
        console.log('J-Archive Content: Message received:', message);

        switch (message.type) {
          case MessageType.INJECT_CONTENT_SCRIPT:
            this.handleInjection(message.payload.url);
            break;
        }

        return false;
      });
    }

    /**
     * Handle content script injection and UI initialization
     */
    private handleInjection(url: string): void {
      console.log('J-Archive Content: Handling injection for URL:', url);
      
      // Clean up any existing UI
      if (this.ui) {
        this.ui.cleanup();
      }

      // Create new UI instance
      this.ui = new ArchiveNotificationUI();
      this.ui.init(url);

      // Setup message forwarding to UI
      chrome.runtime.onMessage.addListener((message: ExtensionMessage) => {
        if (this.ui && [MessageType.ARCHIVE_FOUND, MessageType.ARCHIVE_ERROR].includes(message.type)) {
          this.ui.handleMessage(message);
        }
      });
    }

    /**
     * Clean up the content script
     */
    public cleanup(): void {
      if (this.ui) {
        this.ui.cleanup();
        this.ui = null;
      }
      this.initialized = false;
    }
  }

  // Global initialization
  let contentScript: ContentScript | null = null;

  // Initialize when the script is injected
  if (typeof window !== 'undefined') {
    contentScript = new ContentScript();
    contentScript.init();
  }

  // Export for potential external access
  (window as any).JArchiveContent = {
    contentScript,
    cleanup: () => contentScript?.cleanup()
  };
} 
