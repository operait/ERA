/**
 * TypeScript types for Microsoft Graph API responses
 */

export interface GraphUser {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
}

export interface GraphMessage {
  id: string;
  subject: string;
  body: {
    contentType: 'text' | 'html';
    content: string;
  };
  toRecipients: EmailAddress[];
  from: EmailAddress;
  sentDateTime: string;
}

export interface EmailAddress {
  emailAddress: {
    address: string;
    name?: string;
  };
}

export interface SendMailRequest {
  message: {
    subject: string;
    body: {
      contentType: 'text' | 'html';
      content: string;
    };
    toRecipients: EmailAddress[];
  };
  saveToSentItems: boolean;
}

export interface CalendarEvent {
  id: string;
  subject: string;
  body: {
    contentType: 'text' | 'html';
    content: string;
  };
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location?: {
    displayName: string;
  };
  attendees?: Attendee[];
  isReminderOn: boolean;
  reminderMinutesBeforeStart: number;
}

export interface Attendee {
  emailAddress: {
    address: string;
    name?: string;
  };
  type: 'required' | 'optional' | 'resource';
}

export interface CalendarView {
  value: CalendarEvent[];
}

export interface TimeSlot {
  start: Date;
  end: Date;
  formatted: string;
}

export interface AvailabilityResult {
  availableSlots: TimeSlot[];
  busySlots: TimeSlot[];
}
