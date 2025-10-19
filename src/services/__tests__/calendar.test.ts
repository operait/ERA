/**
 * Calendar Service Tests
 * Tests timezone handling and availability calculation
 */

import { calendarService } from '../calendar';
import type { TimeSlot } from '../../types/graph';

describe('Calendar Service - Timezone Handling', () => {
  describe('parseCalendarEvents', () => {
    test('should correctly parse Graph API event times for Chicago timezone', () => {
      // Simulate Graph API response for an 8:00 AM - 8:30 AM Chicago event
      const mockEvents = [
        {
          subject: 'Morning Meeting',
          showAs: 'busy',
          start: {
            dateTime: '2025-10-21T08:00:00.0000000',
            timeZone: 'America/Chicago',
          },
          end: {
            dateTime: '2025-10-21T08:30:00.0000000',
            timeZone: 'America/Chicago',
          },
        },
      ];

      // Access private method via type casting for testing
      const service = calendarService as any;
      const busySlots = service.parseCalendarEvents(mockEvents, 'America/Chicago');

      expect(busySlots).toHaveLength(1);
      const slot = busySlots[0];

      // In October, Chicago is UTC-5 (CDT)
      // 8:00 AM Chicago = 13:00 UTC (1:00 PM UTC)
      expect(slot.start.toISOString()).toBe('2025-10-21T13:00:00.000Z');
      expect(slot.end.toISOString()).toBe('2025-10-21T13:30:00.000Z');

      // The formatted string should show 8:00 AM (Chicago local time)
      expect(slot.formatted).toContain('8:00 AM');
      expect(slot.formatted).toContain('8:30 AM');
    });

    test('should correctly parse Graph API event times for Pacific timezone', () => {
      const mockEvents = [
        {
          subject: 'West Coast Call',
          showAs: 'busy',
          start: {
            dateTime: '2025-10-21T10:00:00.0000000',
            timeZone: 'America/Los_Angeles',
          },
          end: {
            dateTime: '2025-10-21T11:00:00.0000000',
            timeZone: 'America/Los_Angeles',
          },
        },
      ];

      const service = calendarService as any;
      const busySlots = service.parseCalendarEvents(mockEvents, 'America/Los_Angeles');

      expect(busySlots).toHaveLength(1);
      const slot = busySlots[0];

      // In October, Los Angeles is UTC-7 (PDT)
      // 10:00 AM Pacific = 17:00 UTC (5:00 PM UTC)
      expect(slot.start.toISOString()).toBe('2025-10-21T17:00:00.000Z');
      expect(slot.end.toISOString()).toBe('2025-10-21T18:00:00.000Z');

      // The formatted string should show 10:00 AM (Pacific local time)
      expect(slot.formatted).toContain('10:00 AM');
      expect(slot.formatted).toContain('11:00 AM');
    });

    test('should filter out events marked as "free"', () => {
      const mockEvents = [
        {
          subject: 'Busy Event',
          showAs: 'busy',
          start: {
            dateTime: '2025-10-21T09:00:00.0000000',
            timeZone: 'America/Chicago',
          },
          end: {
            dateTime: '2025-10-21T10:00:00.0000000',
            timeZone: 'America/Chicago',
          },
        },
        {
          subject: 'Free Event - Should be ignored',
          showAs: 'free',
          start: {
            dateTime: '2025-10-21T10:00:00.0000000',
            timeZone: 'America/Chicago',
          },
          end: {
            dateTime: '2025-10-21T11:00:00.0000000',
            timeZone: 'America/Chicago',
          },
        },
      ];

      const service = calendarService as any;
      const busySlots = service.parseCalendarEvents(mockEvents, 'America/Chicago');

      // Should only have the busy event, not the free one
      expect(busySlots).toHaveLength(1);
      expect(busySlots[0].formatted).toContain('9:00 AM');
    });
  });

  describe('findAvailableSlots', () => {
    test('should find slots that do not overlap with busy times in Chicago timezone', () => {
      // Manager in Chicago has meeting 8:00 AM - 8:30 AM Chicago time
      // That's 13:00 - 13:30 UTC
      const busySlots: TimeSlot[] = [
        {
          start: new Date('2025-10-21T13:00:00.000Z'), // 8:00 AM Chicago
          end: new Date('2025-10-21T13:30:00.000Z'),   // 8:30 AM Chicago
          formatted: 'Tue, Oct 21, 8:00 AM - 8:30 AM',
        },
      ];

      // Working hours in Chicago: 9 AM - 5 PM Chicago time
      // That's 14:00 - 22:00 UTC (in October, CDT = UTC-5)
      const startDate = new Date('2025-10-21T14:00:00.000Z'); // 9 AM Chicago
      const endDate = new Date('2025-10-21T22:00:00.000Z');   // 5 PM Chicago

      const service = calendarService as any;
      const availableSlots = service.findAvailableSlots(startDate, endDate, busySlots, 'America/Chicago');

      // Should have available slots from 9:00 AM - 5:00 PM Chicago (excluding busy time)
      expect(availableSlots.length).toBeGreaterThan(0);

      // First available slot should be 9:00 AM Chicago (14:00 UTC)
      expect(availableSlots[0].start.toISOString()).toBe('2025-10-21T14:00:00.000Z');
      expect(availableSlots[0].formatted).toContain('9:00 AM');

      // Should NOT include the 8:00 AM slot (it's busy)
      const hasEightAM = availableSlots.some((slot: TimeSlot) => slot.formatted.includes('8:00 AM'));
      expect(hasEightAM).toBe(false);
    });

    test('should skip weekend days', () => {
      // October 25, 2025 is a Saturday
      const startDate = new Date('2025-10-25T14:00:00.000Z'); // 9 AM Chicago on Saturday
      const endDate = new Date('2025-10-27T22:00:00.000Z');   // 5 PM Chicago on Monday

      const service = calendarService as any;
      const availableSlots = service.findAvailableSlots(startDate, endDate, [], 'America/Chicago');

      // Should only have slots from Monday (Oct 27)
      availableSlots.forEach((slot: TimeSlot) => {
        const day = slot.start.getUTCDay();
        expect(day).not.toBe(0); // Not Sunday
        expect(day).not.toBe(6); // Not Saturday
      });
    });

    test('should respect working hours (9 AM - 5 PM)', () => {
      // Full business day in Chicago timezone
      const startDate = new Date('2025-10-21T00:00:00.000Z'); // Midnight UTC
      const endDate = new Date('2025-10-22T00:00:00.000Z');   // Next midnight UTC

      const service = calendarService as any;
      const availableSlots = service.findAvailableSlots(startDate, endDate, [], 'America/Chicago');

      // All slots should be within working hours when converted to Chicago time
      availableSlots.forEach((slot: TimeSlot) => {
        // Convert to Chicago time to check hours
        const chicagoHour = parseInt(slot.formatted.match(/(\d+):/)![1]);
        const isPM = slot.formatted.includes('PM');
        const hour24 = isPM && chicagoHour !== 12 ? chicagoHour + 12 : chicagoHour;

        expect(hour24).toBeGreaterThanOrEqual(9);
        expect(hour24).toBeLessThan(17);
      });
    });
  });

  describe('formatTimeSlot', () => {
    test('should format time slot correctly for Chicago timezone', () => {
      // 9:00 AM - 9:30 AM Chicago = 14:00 - 14:30 UTC
      const start = new Date('2025-10-21T14:00:00.000Z');
      const end = new Date('2025-10-21T14:30:00.000Z');

      const service = calendarService as any;
      const formatted = service.formatTimeSlot(start, end, 'America/Chicago');

      expect(formatted).toContain('9:00 AM');
      expect(formatted).toContain('9:30 AM');
      expect(formatted).toContain('Oct 21');
    });

    test('should format time slot correctly for Pacific timezone', () => {
      // 10:00 AM - 10:30 AM Pacific = 17:00 - 17:30 UTC
      const start = new Date('2025-10-21T17:00:00.000Z');
      const end = new Date('2025-10-21T17:30:00.000Z');

      const service = calendarService as any;
      const formatted = service.formatTimeSlot(start, end, 'America/Los_Angeles');

      expect(formatted).toContain('10:00 AM');
      expect(formatted).toContain('10:30 AM');
      expect(formatted).toContain('Oct 21');
    });
  });

  describe('Integration: Full workflow', () => {
    test('should correctly identify available slots when manager has busy events', () => {
      // Scenario: Manager in Chicago has these events on Oct 21, 2025:
      // - 8:00 AM - 8:30 AM: Morning standup (busy)
      // - 9:30 AM - 11:00 AM: Team meeting (busy)
      // - 1:00 PM - 3:30 PM: Project workshop (busy)
      //
      // Available slots should be:
      // - 9:00 AM - 9:30 AM
      // - 11:00 AM - 1:00 PM
      // - 3:30 PM - 5:00 PM

      const mockEvents = [
        {
          subject: 'Morning Standup',
          showAs: 'busy',
          start: { dateTime: '2025-10-21T08:00:00.0000000', timeZone: 'America/Chicago' },
          end: { dateTime: '2025-10-21T08:30:00.0000000', timeZone: 'America/Chicago' },
        },
        {
          subject: 'Team Meeting',
          showAs: 'busy',
          start: { dateTime: '2025-10-21T09:30:00.0000000', timeZone: 'America/Chicago' },
          end: { dateTime: '2025-10-21T11:00:00.0000000', timeZone: 'America/Chicago' },
        },
        {
          subject: 'Project Workshop',
          showAs: 'busy',
          start: { dateTime: '2025-10-21T13:00:00.0000000', timeZone: 'America/Chicago' },
          end: { dateTime: '2025-10-21T15:30:00.0000000', timeZone: 'America/Chicago' },
        },
      ];

      const service = calendarService as any;
      const busySlots = service.parseCalendarEvents(mockEvents, 'America/Chicago');

      // Working day: 9 AM - 5 PM Chicago = 14:00 - 22:00 UTC
      const startDate = new Date('2025-10-21T14:00:00.000Z');
      const endDate = new Date('2025-10-21T22:00:00.000Z');

      const availableSlots = service.findAvailableSlots(startDate, endDate, busySlots, 'America/Chicago');

      // Should have 9:00 AM - 9:30 AM available
      const has9AM = availableSlots.some((slot: TimeSlot) =>
        slot.formatted.includes('9:00 AM') && slot.formatted.includes('9:30 AM')
      );
      expect(has9AM).toBe(true);

      // Should have 11:00 AM - 11:30 AM available
      const has11AM = availableSlots.some((slot: TimeSlot) =>
        slot.formatted.includes('11:00 AM')
      );
      expect(has11AM).toBe(true);

      // Should have 3:30 PM - 4:00 PM available
      const has330PM = availableSlots.some((slot: TimeSlot) =>
        slot.formatted.includes('3:30 PM')
      );
      expect(has330PM).toBe(true);

      // Should NOT have 8:00 AM, 9:30 AM, or 1:00 PM (all busy)
      const has8AM = availableSlots.some((slot: TimeSlot) =>
        slot.formatted.includes('8:00 AM')
      );
      expect(has8AM).toBe(false);

      const has930AM = availableSlots.some((slot: TimeSlot) =>
        slot.formatted.includes('9:30 AM') && slot.formatted.includes('10:00 AM')
      );
      expect(has930AM).toBe(false);
    });
  });
});
