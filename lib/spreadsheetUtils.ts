/**
 * Utility functions for Google Sheets integration
 */

export function extractCleanSpreadsheetId(urlOrId: string): string {
  if (!urlOrId) return '';
  const trimmed = urlOrId.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  
  // If it's already an ID like 1HN2z0wfBY7vjuh_LJLYFVvDAkX8CN5AozEAoNxqh0wo
  if (/^[a-zA-Z0-9-_]{20,80}$/.test(trimmed)) {
    return trimmed;
  }
  
  // If it's an Apps Script Web App url
  const scriptMatch = trimmed.match(/\/macros\/s\/([a-zA-Z0-9-_]+)/);
  if (scriptMatch) return scriptMatch[1];

  return trimmed;
}

export function buildSpreadsheetUrl(spreadsheetIdOrUrl: string): string {
  if (!spreadsheetIdOrUrl) return '';
  const trimmed = spreadsheetIdOrUrl.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://docs.google.com/spreadsheets/d/${trimmed}/edit`;
}
