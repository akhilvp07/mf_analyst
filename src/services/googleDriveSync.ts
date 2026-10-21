import { TransactionRecord, MutualFundScheme, FundMarketCapSplit } from '../types';
import { mergeTransactions } from '../utils/financialCalculations';

export const DRIVE_PORTFOLIO_FILENAME = 'mftracker_portfolio_data.json';

const STORAGE_KEYS = {
  DEVICE_ID: 'mftracker_sync_device_id',
  LAST_SYNCED_TIME: 'mftracker_last_synced_drive_time',
  LOCAL_MODIFIED_TIME: 'mftracker_local_modified_time',
  CACHED_FILE_ID: 'mftracker_drive_file_id'
};

export interface SyncedPortfolioPayload {
  formatVersion: number;
  app: 'MFTracker';
  updatedAt: string;
  deviceId: string;
  transactions: TransactionRecord[];
  schemes: Record<string, MutualFundScheme>;
  settings?: any;
  fundMcapSplits?: Record<string, FundMarketCapSplit>;
}

export interface DriveFileInfo {
  id: string;
  name: string;
  modifiedTime?: string;
  size?: string;
  version?: string;
}

export interface SyncResult {
  success: boolean;
  action: 'pulled' | 'pushed' | 'created' | 'merged_conflict' | 'up_to_date' | 'offline_cached';
  conflict: boolean;
  message: string;
  syncedAt: string;
  remoteUpdatedAt?: string;
  remoteFileId?: string;
  payload?: SyncedPortfolioPayload;
  error?: string;
}

/**
 * Get or initialize a stable unique device identifier for multi-device sync
 */
export function getOrCreateDeviceId(): string {
  try {
    let id = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
    if (!id) {
      id = `dev_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`;
      localStorage.setItem(STORAGE_KEYS.DEVICE_ID, id);
    }
    return id;
  } catch {
    return `dev_fallback_${Date.now().toString(36)}`;
  }
}

/**
 * Record that local data was modified (e.g. user added a transaction, edited folio, or imported CAS)
 */
export function markLocalDataModified(): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LOCAL_MODIFIED_TIME, new Date().toISOString());
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get local modified timestamp
 */
export function getLocalModifiedTime(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.LOCAL_MODIFIED_TIME);
  } catch {
    return null;
  }
}

/**
 * Get last successful sync timestamp
 */
export function getLastSyncedTime(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.LAST_SYNCED_TIME);
  } catch {
    return null;
  }
}

/**
 * Set last successful sync timestamp
 */
export function setLastSyncedTime(time: string, fileId?: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_SYNCED_TIME, time);
    if (fileId) {
      localStorage.setItem(STORAGE_KEYS.CACHED_FILE_ID, fileId);
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Locate the application's portfolio JSON file inside the user's private Google Drive AppData folder
 */
export async function findDrivePortfolioFile(accessToken: string): Promise<DriveFileInfo | null> {
  const query = encodeURIComponent(`name='${DRIVE_PORTFOLIO_FILENAME}' and trashed=false`);
  const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=files(id,name,modifiedTime,size,version)&pageSize=1`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to query Google Drive AppData: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  if (data.files && data.files.length > 0) {
    return data.files[0];
  }

  return null;
}

/**
 * Download the portfolio JSON content from Google Drive
 */
export async function downloadDrivePortfolio(accessToken: string, fileId: string): Promise<SyncedPortfolioPayload> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to download portfolio from Google Drive: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  return payload as SyncedPortfolioPayload;
}

/**
 * Create a new private portfolio file in the user's Google Drive AppData folder using multipart upload
 */
export async function createDrivePortfolioFile(
  accessToken: string,
  payload: SyncedPortfolioPayload
): Promise<DriveFileInfo> {
  const boundary = `-------314159265358979323846_${Date.now()}`;
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: DRIVE_PORTFOLIO_FILENAME,
    parents: ['appDataFolder'],
    mimeType: 'application/json',
    description: 'MFTracker encrypted/private mutual fund portfolio data and transaction history'
  };

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(payload, null, 2) +
    closeDelimiter;

  const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create portfolio file in Google Drive: ${response.status} ${errorText}`);
  }

  const createdFile: DriveFileInfo = await response.json();
  return createdFile;
}

/**
 * Update an existing portfolio file in Google Drive
 */
export async function updateDrivePortfolioFile(
  accessToken: string,
  fileId: string,
  payload: SyncedPortfolioPayload
): Promise<DriveFileInfo> {
  const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&fields=id,name,modifiedTime,size`;

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload, null, 2)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update portfolio file in Google Drive: ${response.status} ${errorText}`);
  }

  const updatedFile: DriveFileInfo = await response.json();
  return updatedFile;
}

/**
 * Synchronize local portfolio data with Google Drive.
 * Implements intelligent multi-device conflict resolution:
 * - If Drive has no file: writes local data to Drive
 * - If Drive is newer and local was unchanged: pulls newest Drive state
 * - If local is newer and Drive was unchanged: pushes local state to Drive
 * - If BOTH Drive and local have independent changes (concurrent modification conflict):
 *   merges transaction sets safely (union without duplicates) so no investment entries are lost,
 *   updates Drive with the merged result, and flags conflict = true for user awareness.
 */
export async function syncPortfolioWithDrive(
  accessToken: string,
  localState: {
    transactions: TransactionRecord[];
    schemes: Record<string, MutualFundScheme>;
    settings?: any;
    fundMcapSplits?: Record<string, FundMarketCapSplit>;
  },
  options: {
    forceDirection?: 'pull' | 'push' | 'auto';
  } = {}
): Promise<SyncResult> {
  const now = new Date().toISOString();
  const deviceId = getOrCreateDeviceId();
  const lastSynced = getLastSyncedTime();
  const localModified = getLocalModifiedTime() || (localState.transactions.length > 0 ? now : null);

  try {
    // 1. Search for existing file in Drive AppData
    const existingFile = await findDrivePortfolioFile(accessToken);

    // 2. No file exists in Drive yet: create it with local state
    if (!existingFile) {
      const payload: SyncedPortfolioPayload = {
        formatVersion: 2,
        app: 'MFTracker',
        updatedAt: now,
        deviceId,
        transactions: localState.transactions,
        schemes: localState.schemes,
        settings: localState.settings,
        fundMcapSplits: localState.fundMcapSplits
      };

      const created = await createDrivePortfolioFile(accessToken, payload);
      setLastSyncedTime(now, created.id);

      return {
        success: true,
        action: 'created',
        conflict: false,
        message: 'Created initial portfolio backup in your private Google Drive.',
        syncedAt: now,
        remoteFileId: created.id,
        payload
      };
    }

    // 3. File exists: Download remote content
    const remotePayload = await downloadDrivePortfolio(accessToken, existingFile.id);
    const remoteUpdatedAt = remotePayload.updatedAt || existingFile.modifiedTime || '';

    // If explicit pull forced
    if (options.forceDirection === 'pull') {
      setLastSyncedTime(remoteUpdatedAt || now, existingFile.id);
      return {
        success: true,
        action: 'pulled',
        conflict: false,
        message: 'Loaded latest portfolio from Google Drive.',
        syncedAt: now,
        remoteUpdatedAt,
        remoteFileId: existingFile.id,
        payload: remotePayload
      };
    }

    // If explicit push forced
    if (options.forceDirection === 'push') {
      const payloadToPush: SyncedPortfolioPayload = {
        formatVersion: 2,
        app: 'MFTracker',
        updatedAt: now,
        deviceId,
        transactions: localState.transactions,
        schemes: localState.schemes,
        settings: localState.settings,
        fundMcapSplits: localState.fundMcapSplits
      };

      const updated = await updateDrivePortfolioFile(accessToken, existingFile.id, payloadToPush);
      setLastSyncedTime(now, updated.id);

      return {
        success: true,
        action: 'pushed',
        conflict: false,
        message: 'Updated Google Drive backup with latest local changes.',
        syncedAt: now,
        remoteUpdatedAt: now,
        remoteFileId: updated.id,
        payload: payloadToPush
      };
    }

    // 4. Auto resolution based on timestamps
    // Has remote changed since our last sync?
    const remoteChangedSinceLastSync = !lastSynced || (remoteUpdatedAt && new Date(remoteUpdatedAt).getTime() > new Date(lastSynced).getTime());

    // Has local changed since our last sync?
    const localChangedSinceLastSync = !lastSynced || (localModified && new Date(localModified).getTime() > new Date(lastSynced).getTime());

    // Case 4A: Neither changed
    if (!remoteChangedSinceLastSync && !localChangedSinceLastSync) {
      return {
        success: true,
        action: 'up_to_date',
        conflict: false,
        message: 'Portfolio is already up-to-date with Google Drive.',
        syncedAt: now,
        remoteUpdatedAt,
        remoteFileId: existingFile.id,
        payload: remotePayload
      };
    }

    // Case 4B: Remote changed, but local did NOT have pending local changes -> Pull remote
    if (remoteChangedSinceLastSync && !localChangedSinceLastSync) {
      setLastSyncedTime(remoteUpdatedAt, existingFile.id);
      return {
        success: true,
        action: 'pulled',
        conflict: false,
        message: 'Loaded newer portfolio changes from your Google Drive.',
        syncedAt: now,
        remoteUpdatedAt,
        remoteFileId: existingFile.id,
        payload: remotePayload
      };
    }

    // Case 4C: Local changed, but remote did NOT change -> Push local
    if (localChangedSinceLastSync && !remoteChangedSinceLastSync) {
      const payloadToPush: SyncedPortfolioPayload = {
        formatVersion: 2,
        app: 'MFTracker',
        updatedAt: now,
        deviceId,
        transactions: localState.transactions,
        schemes: localState.schemes,
        settings: localState.settings,
        fundMcapSplits: localState.fundMcapSplits
      };

      const updated = await updateDrivePortfolioFile(accessToken, existingFile.id, payloadToPush);
      setLastSyncedTime(now, updated.id);

      return {
        success: true,
        action: 'pushed',
        conflict: false,
        message: 'Saved changes to your private Google Drive.',
        syncedAt: now,
        remoteUpdatedAt: now,
        remoteFileId: updated.id,
        payload: payloadToPush
      };
    }

    // Case 4D: CONFLICT DETECTED - Both remote and local changed independently!
    // Safe multi-device merger: combine transaction sets without deleting anything
    const remoteTxs = Array.isArray(remotePayload.transactions) ? remotePayload.transactions : [];
    const localTxs = localState.transactions || [];

    const mergeResult = mergeTransactions(localTxs, remoteTxs);
    const mergedSchemes = {
      ...(remotePayload.schemes || {}),
      ...(localState.schemes || {})
    };
    const mergedSplits = {
      ...(remotePayload.fundMcapSplits || {}),
      ...(localState.fundMcapSplits || {})
    };

    const mergedPayload: SyncedPortfolioPayload = {
      formatVersion: 2,
      app: 'MFTracker',
      updatedAt: now,
      deviceId,
      transactions: mergeResult.mergedTransactions,
      schemes: mergedSchemes,
      settings: localState.settings || remotePayload.settings,
      fundMcapSplits: mergedSplits
    };

    // Upload merged result to Google Drive to keep both devices in sync
    const updated = await updateDrivePortfolioFile(accessToken, existingFile.id, mergedPayload);
    setLastSyncedTime(now, updated.id);

    return {
      success: true,
      action: 'merged_conflict',
      conflict: true,
      message: `Multi-device change detected: merged ${mergeResult.addedCount} transaction(s) from your other device without losing local edits.`,
      syncedAt: now,
      remoteUpdatedAt: now,
      remoteFileId: updated.id,
      payload: mergedPayload
    };
  } catch (err: any) {
    console.error('Drive Sync Error:', err);
    return {
      success: false,
      action: 'offline_cached',
      conflict: false,
      message: err.message || 'Unable to sync with Google Drive. Local cache retained.',
      syncedAt: now,
      error: err.message
    };
  }
}
