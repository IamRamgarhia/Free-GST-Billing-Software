// Google Drive integration via Google Identity Services + REST API
// No backend needed — runs entirely in the browser.

const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

let tokenClient = null;
let accessToken = null;
let tokenExpiry = 0;

// Dynamically load Google Identity Services script
function loadGIS() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

// Initialize the token client with user's Client ID
export async function initGoogleDrive(clientId) {
  await loadGIS();
  return new Promise((resolve) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          resolve({ success: false, error: response.error });
          return;
        }
        accessToken = response.access_token;
        tokenExpiry = Date.now() + (response.expires_in * 1000);
        resolve({ success: true });
      },
    });
    // Request token immediately
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

// Check if connected and token is valid
export function isConnected() {
  return !!accessToken && Date.now() < tokenExpiry;
}

// Silently refresh token (or prompt if needed)
export async function ensureToken(clientId) {
  if (isConnected()) return true;
  if (!clientId) return false;
  await loadGIS();
  return new Promise((resolve) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          resolve(false);
          return;
        }
        accessToken = response.access_token;
        tokenExpiry = Date.now() + (response.expires_in * 1000);
        resolve(true);
      },
    });
    // Try silent, fallback to prompt
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

// Disconnect
export function disconnect() {
  if (accessToken) {
    window.google?.accounts?.oauth2?.revoke?.(accessToken);
  }
  accessToken = null;
  tokenExpiry = 0;
  tokenClient = null;
}

// Find or create a folder in Google Drive
export async function findOrCreateFolder(folderName) {
  if (!accessToken) throw new Error('Not connected to Google Drive');

  // Search for existing folder
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
    )}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const searchData = await searchRes.json();
  if (searchData.files?.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  const folder = await createRes.json();
  return folder.id;
}

// Upload a PDF file to a specific folder
export async function uploadPDF(fileName, pdfBlob, folderId) {
  if (!accessToken) throw new Error('Not connected to Google Drive');

  const metadata = {
    name: fileName,
    mimeType: 'application/pdf',
    parents: folderId ? [folderId] : [],
  };

  // Use multipart upload
  const boundary = '---gstbiller' + Date.now();
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) + '\r\n' +
    `--${boundary}\r\n` +
    'Content-Type: application/pdf\r\n' +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    await blobToBase64(pdfBlob) + '\r\n' +
    `--${boundary}--`;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'Upload failed');
  }

  return await res.json();
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Upload a JSON file (e.g. an app backup) to a folder. Same multipart pattern as
// uploadPDF but with application/json. Used by the Backup → "Save to Drive" button.
export async function uploadJSON(fileName, jsonString, folderId) {
  if (!accessToken) throw new Error('Not connected to Google Drive');

  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    parents: folderId ? [folderId] : [],
  };

  const boundary = '---gstbiller-json-' + Date.now();
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) + '\r\n' +
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    jsonString + '\r\n' +
    `--${boundary}--`;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'JSON upload failed');
  }
  return await res.json();
}

// List the most recent backup files in a folder. Used by Restore from Drive.
export async function listBackupsInFolder(folderId, limit = 20) {
  if (!accessToken) throw new Error('Not connected to Google Drive');
  const q = `'${folderId}' in parents and mimeType='application/json' and trashed=false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&orderBy=modifiedTime%20desc&pageSize=${limit}&fields=files(id,name,modifiedTime,size)`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error('Failed to list Drive files');
  const data = await res.json();
  return data.files || [];
}

// Download a Drive file by id and return its text content.
export async function downloadFileText(fileId) {
  if (!accessToken) throw new Error('Not connected to Google Drive');
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) throw new Error('Failed to download Drive file');
  return await res.text();
}
