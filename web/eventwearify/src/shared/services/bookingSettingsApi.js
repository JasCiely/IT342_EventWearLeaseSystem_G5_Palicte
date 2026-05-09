import { authFetch } from './apiClient.js';

const ENDPOINT = '/admin/booking-settings';

/**
 * Fetch booking time settings from the backend.
 * Returns a settings object shaped for the frontend:
 * {
 *   enabled: boolean,
 *   startHour: number,
 *   startMinute: number,
 *   endHour: number,
 *   endMinute: number,
 *   workingDays: number[],
 *   timezone: string,
 *   autoApproveThreshold: number,
 *   fittingDurationMinutes: number,
 * }
 */
export const fetchBookingSettings = async () => {
  try {
    const data = await authFetch(ENDPOINT);
    return mapFromApi(data);
  } catch (error) {
    console.error('Error fetching booking settings:', error);
    // Return sensible defaults so the UI is never broken
    return getDefaultSettings();
  }
};

/**
 * Persist booking time settings to the backend.
 * Accepts the same shape returned by fetchBookingSettings.
 */
export const saveBookingSettings = async (settings) => {
  try {
    const payload = mapToApi(settings);
    const data = await authFetch(ENDPOINT, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return mapFromApi(data);
  } catch (error) {
    console.error('Error saving booking settings:', error);
    throw error;
  }
};

// ── Shape converters ──────────────────────────────────────────────────────────

function mapFromApi(data) {
  const openParts  = (data.shopOpenTime  || '09:00').split(':');
  const closeParts = (data.shopCloseTime || '17:00').split(':');
  return {
    enabled:               data.enableTimeRestrictions ?? true,
    startHour:             parseInt(openParts[0],  10) || 9,
    startMinute:           parseInt(openParts[1],  10) || 0,
    endHour:               parseInt(closeParts[0], 10) || 17,
    endMinute:             parseInt(closeParts[1], 10) || 0,
    workingDays:           Array.isArray(data.workingDays) ? data.workingDays : [1, 2, 3, 4, 5],
    timezone:              data.timezone              || 'Asia/Manila',
    autoApproveThreshold:  Number(data.autoApproveThreshold) || 500,
    fittingDurationMinutes: data.fittingDurationMinutes || 30,
  };
}

function mapToApi(settings) {
  const pad = (n) => String(n).padStart(2, '0');
  return {
    enableTimeRestrictions: settings.enabled,
    shopOpenTime:           `${pad(settings.startHour)}:${pad(settings.startMinute ?? 0)}`,
    shopCloseTime:          `${pad(settings.endHour)}:${pad(settings.endMinute ?? 0)}`,
    workingDays:            settings.workingDays,
    timezone:               settings.timezone,
    autoApproveThreshold:   settings.autoApproveThreshold,
    fittingDurationMinutes: settings.fittingDurationMinutes || 30,
  };
}

export function getDefaultSettings() {
  return {
    enabled:                true,
    startHour:              9,
    startMinute:            0,
    endHour:                17,
    endMinute:              0,
    workingDays:            [1, 2, 3, 4, 5],
    timezone:               'Asia/Manila',
    autoApproveThreshold:   500,
    fittingDurationMinutes: 30,
  };
}