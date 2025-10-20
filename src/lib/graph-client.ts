/**
 * Microsoft Graph API Client
 * Handles authentication and API calls to Microsoft Graph
 */

import { Client } from '@microsoft/microsoft-graph-client';
import { ClientSecretCredential } from '@azure/identity';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials';

interface GraphConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  scopes?: string[];
}

class GraphClient {
  private client: Client | null = null;
  private config: GraphConfig;

  constructor() {
    this.config = {
      clientId: process.env.MICROSOFT_CLIENT_ID || '',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
      tenantId: process.env.MICROSOFT_TENANT_ID || '',
      scopes: ['https://graph.microsoft.com/.default'],
    };
  }

  /**
   * Initialize the Graph client with credentials
   */
  private async initialize(): Promise<Client> {
    if (this.client) {
      return this.client;
    }

    if (!this.config.clientId || !this.config.clientSecret || !this.config.tenantId) {
      throw new Error('Microsoft Graph API credentials not configured');
    }

    const credential = new ClientSecretCredential(
      this.config.tenantId,
      this.config.clientId,
      this.config.clientSecret
    );

    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: this.config.scopes || ['https://graph.microsoft.com/.default'],
    });

    this.client = Client.initWithMiddleware({ authProvider });
    return this.client;
  }

  /**
   * Get authenticated Graph client instance
   */
  async getClient(): Promise<Client> {
    return await this.initialize();
  }

  /**
   * Send an email on behalf of a user
   */
  async sendMail(userId: string, message: any, saveToSentItems: boolean = true): Promise<void> {
    const client = await this.getClient();

    await client
      .api(`/users/${userId}/sendMail`)
      .post({
        message,
        saveToSentItems,
      });
  }

  /**
   * Get user's calendar events within a date range
   */
  async getCalendarView(
    userId: string,
    startDateTime: string,
    endDateTime: string,
    timezone: string = 'America/New_York'
  ): Promise<any> {
    const client = await this.getClient();

    // Fetch all events in the date range (default top is 10, we need more)
    const response = await client
      .api(`/users/${userId}/calendar/calendarView`)
      .header('Prefer', `outlook.timezone="${timezone}"`)
      .query({
        startDateTime,
        endDateTime,
      })
      .select('subject,start,end,location,attendees,showAs')
      .orderby('start/dateTime')
      .top(250) // Fetch up to 250 events to ensure we get all events
      .get();

    return response;
  }

  /**
   * Create a calendar event
   */
  async createCalendarEvent(userId: string, event: any): Promise<any> {
    const client = await this.getClient();

    const response = await client
      .api(`/users/${userId}/calendar/events`)
      .post(event);

    return response;
  }

  /**
   * Update a calendar event
   */
  async updateCalendarEvent(userId: string, eventId: string, updates: any): Promise<any> {
    const client = await this.getClient();

    const response = await client
      .api(`/users/${userId}/calendar/events/${eventId}`)
      .patch(updates);

    return response;
  }

  /**
   * Delete a calendar event
   */
  async deleteCalendarEvent(userId: string, eventId: string): Promise<void> {
    const client = await this.getClient();

    await client
      .api(`/users/${userId}/calendar/events/${eventId}`)
      .delete();
  }

  /**
   * Get user information
   */
  async getUser(userId: string): Promise<any> {
    const client = await this.getClient();

    const response = await client
      .api(`/users/${userId}`)
      .select('id,displayName,mail,userPrincipalName')
      .get();

    return response;
  }

  /**
   * Get user's mailbox settings (includes timezone)
   */
  async getUserMailboxSettings(userId: string): Promise<any> {
    const client = await this.getClient();

    try {
      const response = await client
        .api(`/users/${userId}/mailboxSettings`)
        .get();

      return response;
    } catch (error: any) {
      console.warn(`Failed to get mailbox settings for ${userId}:`, error.message || error);

      // Try alternative: Get timezone from a calendar event
      try {
        console.log('Attempting to detect timezone from calendar events...');
        const calendarView = await client
          .api(`/users/${userId}/calendar/calendarView`)
          .query({
            startDateTime: new Date().toISOString(),
            endDateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .top(1)
          .select('start')
          .get();

        if (calendarView.value && calendarView.value.length > 0) {
          const eventTimezone = calendarView.value[0].start.timeZone;
          if (eventTimezone) {
            console.log(`✅ Detected timezone from calendar event: ${eventTimezone}`);
            return { timeZone: eventTimezone };
          }
        }
      } catch (altError) {
        console.warn('Alternative timezone detection also failed:', altError);
      }

      // Final fallback - return null to force using default
      return { timeZone: null };
    }
  }
}

// Export singleton instance
export const graphClient = new GraphClient();
