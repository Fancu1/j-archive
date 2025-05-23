/**
 * Types for J-Archive Chrome Extension
 */

export interface UIState {
  isLoading: boolean;
  hasArchive: boolean;
  archiveUrl?: string;
  error?: string;
}

export enum MessageType {
  FIND_ARCHIVE = 'find_archive',
  ARCHIVE_FOUND = 'archive_found',
  ARCHIVE_ERROR = 'archive_error',
  OPEN_ARCHIVE = 'open_archive'
}

export interface ExtensionMessage {
  type: MessageType;
  payload?: any;
}
