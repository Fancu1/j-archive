/// <reference types="chrome"/>
/**
 * UI Components for J-Archive Chrome Extension
 */

import { ExtensionMessage, MessageType, UIState } from './types.js';

export class ArchiveUI {
  private container: HTMLElement | null = null;
  private state: UIState = {
    isLoading: false,
    hasArchive: false
  };

  /**
   * Initialize and inject the archive UI into the page
   */
  public init(): void {
    this.createUI();
    this.bindEvents();
  }

  /**
   * Create the main UI container and inject it into the page
   */
  private createUI(): void {
    // Remove existing container if present
    this.cleanup();

    // Create container
    this.container = document.createElement('div');
    this.container.id = 'j-archive-container';
    this.container.className = 'j-archive-container';
    
    // Inject into page
    const target = this.findInjectionTarget();
    if (target) {
      target.insertBefore(this.container, target.firstChild);
      this.renderUI();
    }
  }

  /**
   * Find the best location to inject the UI
   */
  private findInjectionTarget(): HTMLElement | null {
    // Try different selectors for Medium's article layout
    const selectors = [
      'article',
      '[data-testid="storyContent"]',
      '.meteredContent',
      'main',
      'body'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector) as HTMLElement;
      if (element) {
        return element;
      }
    }

    return document.body;
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
      <div class="j-archive-card">
        <div class="j-archive-header">
          <span class="j-archive-icon j-archive-spinning">⌛</span>
          <span class="j-archive-title">Searching Archive...</span>
        </div>
        <div class="j-archive-content">
          <p>Looking for cached version on archive.ph</p>
        </div>
      </div>
    `;
  }

  /**
   * Get HTML for archive found state
   */
  private getArchiveFoundHTML(): string {
    return `
      <div class="j-archive-card j-archive-success">
        <div class="j-archive-header">
          <span class="j-archive-icon">✅</span>
          <span class="j-archive-title">Archive Found!</span>
        </div>
        <div class="j-archive-content">
          <p>Cached version is available on archive.ph</p>
          <button id="j-archive-open-btn" class="j-archive-btn j-archive-btn-success">
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
      <div class="j-archive-card j-archive-error">
        <div class="j-archive-header">
          <span class="j-archive-icon">❌</span>
          <span class="j-archive-title">Archive Not Found</span>
        </div>
        <div class="j-archive-content">
          <p>${this.state.error || 'No cached version available'}</p>
          <button id="j-archive-retry-btn" class="j-archive-btn j-archive-btn-secondary">
            Try Again
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Bind event listeners
   */
  private bindEvents(): void {
    document.addEventListener('click', this.handleClick.bind(this));
  }

  /**
   * Handle click events on UI elements
   */
  private handleClick(event: Event): void {
    const target = event.target as HTMLElement;
    
    if (target.id === 'j-archive-retry-btn') {
      this.findArchive();
    } else if (target.id === 'j-archive-open-btn') {
      this.openArchive();
    }
  }

  /**
   * Trigger archive finding process
   */
  private findArchive(): void {
    this.updateState({ isLoading: true, error: undefined });
    
    const message: ExtensionMessage = {
      type: MessageType.FIND_ARCHIVE,
      payload: { url: window.location.href }
    };
    
    chrome.runtime.sendMessage(message);
  }

  /**
   * Open the archived version
   */
  private openArchive(): void {
    if (this.state.archiveUrl) {
      const message: ExtensionMessage = {
        type: MessageType.OPEN_ARCHIVE,
        payload: { url: this.state.archiveUrl }
      };
      
      chrome.runtime.sendMessage(message);
    }
  }

  /**
   * Update UI state and re-render
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
          archiveUrl: message.payload.archiveUrl
        });
        break;
        
      case MessageType.ARCHIVE_ERROR:
        this.updateState({
          isLoading: false,
          hasArchive: false,
          error: message.payload.error
        });
        break;
    }
  }

  /**
   * Clean up the UI
   */
  public cleanup(): void {
    const existing = document.getElementById('j-archive-container');
    if (existing) {
      existing.remove();
    }
    this.container = null;
  }

  /**
   * Show/hide the UI
   */
  public setVisible(visible: boolean): void {
    if (this.container) {
      this.container.style.display = visible ? 'block' : 'none';
    }
  }
} 
