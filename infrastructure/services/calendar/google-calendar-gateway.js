const jwt = require('jsonwebtoken');
const { GoogleCalendarSyncException } = require('../../../domain/exceptions/calendar/google-calendar-sync-exception');

class GoogleCalendarGateway {
  constructor(config = {}) {
    this.calendarId = config.calendarId || process.env.GOOGLE_CALENDAR_ID;
    this.clientEmail = config.clientEmail || process.env.GOOGLE_CLIENT_EMAIL;
    this.privateKey = config.privateKey || process.env.GOOGLE_PRIVATE_KEY;
    this.accessToken = null;
    this.tokenExp = 0;
  }

  async _getAccessToken() {
    if (!this.calendarId || !this.clientEmail || !this.privateKey) {
      throw new GoogleCalendarSyncException('Credenciales de Google Calendar no configuradas');
    }

    const now = Math.floor(Date.now() / 1000);
    if (this.accessToken && this.tokenExp > now + 60) {
      return this.accessToken;
    }

    const claim = {
      iss: this.clientEmail,
      scope: 'https://www.googleapis.com/auth/calendar',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    };

    let tokenJwt;
    try {
      const privateKeyStr = this.privateKey.replace(/\\n/g, '\n');
      tokenJwt = jwt.sign(claim, privateKeyStr, { algorithm: 'RS256' });
    } catch (err) {
      throw new GoogleCalendarSyncException('Error firmando JWT para Google Calendar: ' + err.message);
    }

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: tokenJwt,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Google Auth API respondió con estado ${response.status}: ${text}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExp = now + data.expires_in;
      return this.accessToken;
    } catch (err) {
      throw new GoogleCalendarSyncException('Fallo al obtener el token de acceso de Google: ' + err.message);
    }
  }

  async upsertEvent(googleEventId, event, options = {}) {
    try {
      const token = await this._getAccessToken();
      const encodedCalendarId = encodeURIComponent(this.calendarId);

      const safeGoogleEventId = googleEventId.toLowerCase().replace(/[^a-v0-9]/g, '') || `evt${Date.now()}`;
      
      const payload = {
        id: safeGoogleEventId,
        summary: event.summary,
        description: event.description,
        location: event.location || '',
        start: { dateTime: event.startAt.toISOString() },
        end: { dateTime: event.endAt.toISOString() },
      };

      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events/${safeGoogleEventId}`;
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`API Calendar respondió con estado ${response.status}: ${text}`);
      }

      return { googleEventId: safeGoogleEventId };
    } catch (err) {
      throw new GoogleCalendarSyncException('Fallo al sincronizar evento con Google Calendar: ' + err.message);
    }
  }

  async deleteEvent(googleEventId) {
    try {
      if (!googleEventId) return;
      const token = await this._getAccessToken();
      const encodedCalendarId = encodeURIComponent(this.calendarId);
      
      const safeGoogleEventId = googleEventId.toLowerCase().replace(/[^a-v0-9]/g, '');
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events/${safeGoogleEventId}`;

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.status !== 204 && response.status !== 410 && response.status !== 404) {
        const text = await response.text();
        throw new Error(`API Calendar (DELETE) respondió con estado ${response.status}: ${text}`);
      }
    } catch (err) {
      throw new GoogleCalendarSyncException('Fallo al eliminar evento de Google Calendar: ' + err.message);
    }
  }
}

module.exports = GoogleCalendarGateway;
