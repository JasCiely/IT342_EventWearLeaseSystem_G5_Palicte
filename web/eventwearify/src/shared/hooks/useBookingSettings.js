import { useState, useEffect } from 'react';
import { fetchBookingSettings, getDefaultSettings } from '../services/bookingSettingsApi';

export function useBookingSettings() {
  const [settings, setSettings] = useState(getDefaultSettings());
  const [loaded, setLoaded]     = useState(false);

  useEffect(() => {
    fetchBookingSettings()
      .then(s => { setSettings(s); setLoaded(true); })
      .catch(()  => setLoaded(true));
  }, []);

  return { settings, loaded };
}
