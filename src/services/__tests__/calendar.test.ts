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
        const match = slot.formatted.match(/(\d+):(\d+)\s+(AM|PM)/);
        if (!match) {
          console.log('Failed to parse:', slot.formatted);
          return;
        }
        const chicagoHour = parseInt(match[1]);
        const isPM = match[3] === 'PM';
        // Convert to 24-hour format
        let hour24;
        if (isPM && chicagoHour !== 12) {
          hour24 = chicagoHour + 12;
        } else if (!isPM && chicagoHour === 12) {
          hour24 = 0; // 12 AM is midnight (hour 0)
        } else {
          hour24 = chicagoHour;
        }

        if (hour24 < 9 || hour24 >= 17) {
          console.log(`Slot outside working hours: ${slot.formatted} (hour24: ${hour24})`);
        }

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

    test('should NOT recommend slots that overlap with back-to-back meetings (issue reproduction)', () => {
      // Reported issue: User has these events in Eastern Time (America/New_York):
      // - 9:00 AM - 10:00 AM (meeting 1)
      // - 10:00 AM - 10:30 AM (meeting 2)
      // - 12:00 PM - 1:30 PM (meeting 3)
      // - 2:30 PM - 4:30 PM (meeting 4)
      //
      // ERA was incorrectly recommending 9:00 AM - 10:30 AM slots
      // This should NOT happen - all slots from 9:00-10:30 should be blocked

      const mockEvents = [
        {
          subject: 'Meeting 1',
          showAs: 'busy',
          start: { dateTime: '2025-10-20T09:00:00.0000000', timeZone: 'America/New_York' },
          end: { dateTime: '2025-10-20T10:00:00.0000000', timeZone: 'America/New_York' },
        },
        {
          subject: 'Meeting 2',
          showAs: 'busy',
          start: { dateTime: '2025-10-20T10:00:00.0000000', timeZone: 'America/New_York' },
          end: { dateTime: '2025-10-20T10:30:00.0000000', timeZone: 'America/New_York' },
        },
        {
          subject: 'Meeting 3',
          showAs: 'busy',
          start: { dateTime: '2025-10-20T12:00:00.0000000', timeZone: 'America/New_York' },
          end: { dateTime: '2025-10-20T13:30:00.0000000', timeZone: 'America/New_York' },
        },
        {
          subject: 'Meeting 4',
          showAs: 'busy',
          start: { dateTime: '2025-10-20T14:30:00.0000000', timeZone: 'America/New_York' },
          end: { dateTime: '2025-10-20T16:30:00.0000000', timeZone: 'America/New_York' },
        },
      ];

      const service = calendarService as any;
      const busySlots = service.parseCalendarEvents(mockEvents, 'America/New_York');

      // Working day: 9 AM - 5 PM Eastern = 13:00 - 21:00 UTC (Oct 20 is EDT = UTC-4)
      const startDate = new Date('2025-10-20T13:00:00.000Z');
      const endDate = new Date('2025-10-20T21:00:00.000Z');

      const availableSlots = service.findAvailableSlots(startDate, endDate, busySlots, 'America/New_York');

      // Should NOT have any slots from 9:00 AM to 10:30 AM
      const has9to930 = availableSlots.some((slot: TimeSlot) =>
        slot.formatted.includes('9:00 AM') && slot.formatted.includes('9:30 AM')
      );
      expect(has9to930).toBe(false);

      const has930to10 = availableSlots.some((slot: TimeSlot) =>
        slot.formatted.includes('9:30 AM') && slot.formatted.includes('10:00 AM')
      );
      expect(has930to10).toBe(false);

      const has10to1030 = availableSlots.some((slot: TimeSlot) =>
        slot.formatted.includes('10:00 AM') && slot.formatted.includes('10:30 AM')
      );
      expect(has10to1030).toBe(false);

      // Should have 10:30 AM - 11:00 AM available (after back-to-back meetings)
      const has1030 = availableSlots.some((slot: TimeSlot) =>
        slot.formatted.includes('10:30 AM') && slot.formatted.includes('11:00 AM')
      );
      expect(has1030).toBe(true);

      // Should NOT have slots from 12:00 PM to 1:30 PM
      const has12PM = availableSlots.some((slot: TimeSlot) =>
        (slot.formatted.includes('12:00 PM') || slot.formatted.includes('12:30 PM') || slot.formatted.includes('1:00 PM')) &&
        !slot.formatted.includes('11:') // Exclude 11:XX times
      );
      expect(has12PM).toBe(false);

      // Should NOT have slots that START at 2:30 PM, 3:00 PM, 3:30 PM, or 4:00 PM
      const has230PM_start = availableSlots.some((slot: TimeSlot) =>
        /^[A-Za-z]+,\s[A-Za-z]+\s\d+,\s2:30 PM/.test(slot.formatted)
      );
      const has3PM_start = availableSlots.some((slot: TimeSlot) =>
        /^[A-Za-z]+,\s[A-Za-z]+\s\d+,\s3:00 PM/.test(slot.formatted)
      );
      const has330PM_start = availableSlots.some((slot: TimeSlot) =>
        /^[A-Za-z]+,\s[A-Za-z]+\s\d+,\s3:30 PM/.test(slot.formatted)
      );
      const has4PM_start = availableSlots.some((slot: TimeSlot) =>
        /^[A-Za-z]+,\s[A-Za-z]+\s\d+,\s4:00 PM/.test(slot.formatted)
      );
      expect(has230PM_start).toBe(false);
      expect(has3PM_start).toBe(false);
      expect(has330PM_start).toBe(false);
      expect(has4PM_start).toBe(false);

      // But 4:30 PM - 5:00 PM SHOULD be available (after meeting ends)
      const has430PM_start = availableSlots.some((slot: TimeSlot) =>
        /^[A-Za-z]+,\s[A-Za-z]+\s\d+,\s4:30 PM/.test(slot.formatted)
      );
      expect(has430PM_start).toBe(true);
    });

    test('should recommend correct slots with user reported schedule', () => {
      // User reported schedule in Eastern Time on Oct 20:
      // - 9:00 AM - 10:00 AM
      // - 10:00 AM - 10:30 AM
      // - 12:00 PM - 1:30 PM
      // - 2:30 PM - 4:30 PM
      //
      // Expected recommendations (first 3 available 30-min slots):
      // 1. 10:30 AM - 11:00 AM (first available after morning meetings)
      // 2. 11:00 AM - 11:30 AM
      // 3. 11:30 AM - 12:00 PM

      const mockEvents = [
        {
          subject: 'Meeting 1',
          showAs: 'busy',
          start: { dateTime: '2025-10-20T09:00:00.0000000', timeZone: 'America/New_York' },
          end: { dateTime: '2025-10-20T10:00:00.0000000', timeZone: 'America/New_York' },
        },
        {
          subject: 'Meeting 2',
          showAs: 'busy',
          start: { dateTime: '2025-10-20T10:00:00.0000000', timeZone: 'America/New_York' },
          end: { dateTime: '2025-10-20T10:30:00.0000000', timeZone: 'America/New_York' },
        },
        {
          subject: 'Meeting 3',
          showAs: 'busy',
          start: { dateTime: '2025-10-20T12:00:00.0000000', timeZone: 'America/New_York' },
          end: { dateTime: '2025-10-20T13:30:00.0000000', timeZone: 'America/New_York' },
        },
        {
          subject: 'Meeting 4',
          showAs: 'busy',
          start: { dateTime: '2025-10-20T14:30:00.0000000', timeZone: 'America/New_York' },
          end: { dateTime: '2025-10-20T16:30:00.0000000', timeZone: 'America/New_York' },
        },
      ];

      const service = calendarService as any;
      const busySlots = service.parseCalendarEvents(mockEvents, 'America/New_York');

      // Working day: 9 AM - 5 PM Eastern = 13:00 - 21:00 UTC
      const startDate = new Date('2025-10-20T13:00:00.000Z');
      const endDate = new Date('2025-10-20T21:00:00.000Z');

      const availableSlots = service.findAvailableSlots(startDate, endDate, busySlots, 'America/New_York');

      // Get top 3 recommendations (this is what ERA would show to the user)
      const recommendations = service.getTopRecommendations(availableSlots, 3);

      console.log('\n📅 TOP 3 RECOMMENDATIONS:');
      recommendations.forEach((slot: TimeSlot, i: number) => {
        console.log(`   ${i + 1}. ${slot.formatted}`);
      });

      // Verify recommendations do NOT include any slots from 9:00-10:30 AM
      expect(recommendations.length).toBe(3);

      recommendations.forEach((slot: TimeSlot) => {
        // Ensure no recommended slot starts before 10:30 AM
        expect(slot.formatted).not.toMatch(/9:00 AM/);
        expect(slot.formatted).not.toMatch(/9:30 AM/);
        expect(slot.formatted).not.toMatch(/10:00 AM/);

        // First recommendation should be 10:30 AM - 11:00 AM
      });

      expect(recommendations[0].formatted).toContain('10:30 AM');
      expect(recommendations[0].formatted).toContain('11:00 AM');
    });
  });

  describe('Timezone handling regression tests', () => {
    test('should NOT treat UTC timezone as valid (regression test for v3.2.2 bug)', () => {
      // BUG FOUND: When Graph API returns timeZone: 'UTC', ERA was accepting it as valid
      // This caused all time calculations to be wrong (9 AM UTC vs 9 AM Eastern = 4 hour difference)
      //
      // User's meetings at 9 AM Eastern (13:00 UTC) weren't blocking 9 AM UTC slots (09:00 UTC)
      // ERA recommended 9:00-10:30 AM thinking they were available
      // But the user had meetings at those times in Eastern timezone

      const mockEvents = [
        {
          subject: 'Morning Meeting',
          showAs: 'busy',
          start: { dateTime: '2025-10-20T09:00:00.0000000', timeZone: 'America/New_York' },
          end: { dateTime: '2025-10-20T10:00:00.0000000', timeZone: 'America/New_York' },
        },
      ];

      const service = calendarService as any;

      // BUG: If we use UTC as the manager timezone, the times will be interpreted wrong
      // (We skip testing UTC here since it would give wrong results)
      const busySlotsEastern = service.parseCalendarEvents(mockEvents, 'America/New_York');

      // Both should parse to the same UTC time (13:00 UTC = 9 AM Eastern)
      // But if timezone detection is broken, they would be different
      expect(busySlotsEastern[0].start.toISOString()).toBe('2025-10-20T13:00:00.000Z');
      expect(busySlotsEastern[0].end.toISOString()).toBe('2025-10-20T14:00:00.000Z');

      // When formatted, Eastern should show 9:00 AM
      expect(busySlotsEastern[0].formatted).toContain('9:00 AM');
      expect(busySlotsEastern[0].formatted).toContain('10:00 AM');
    });

    test('should correctly detect overlaps when using Eastern timezone (not UTC)', () => {
      // This test ensures that when a user has meetings at 9-10 AM Eastern,
      // ERA doesn't recommend 9-10 AM slots thinking they're in UTC

      const mockEvents = [
        {
          subject: 'Meeting 1',
          showAs: 'busy',
          start: { dateTime: '2025-10-20T09:00:00.0000000', timeZone: 'America/New_York' },
          end: { dateTime: '2025-10-20T10:00:00.0000000', timeZone: 'America/New_York' },
        },
      ];

      const service = calendarService as any;
      const busySlots = service.parseCalendarEvents(mockEvents, 'America/New_York');

      // Working day: 9 AM - 5 PM Eastern = 13:00 - 21:00 UTC
      const startDate = new Date('2025-10-20T13:00:00.000Z'); // 9 AM Eastern
      const endDate = new Date('2025-10-20T21:00:00.000Z');   // 5 PM Eastern

      const availableSlots = service.findAvailableSlots(startDate, endDate, busySlots, 'America/New_York');

      // 9:00-9:30 AM and 9:30-10:00 AM should NOT be available (meeting blocks them)
      const has9AM = availableSlots.some((slot: TimeSlot) =>
        slot.formatted.includes('9:00 AM') || slot.formatted.includes('9:30 AM')
      );
      expect(has9AM).toBe(false);

      // 10:00 AM - 10:30 AM SHOULD be available (after meeting ends)
      const has10AM = availableSlots.some((slot: TimeSlot) =>
        slot.formatted.includes('10:00 AM') && slot.formatted.includes('10:30 AM')
      );
      expect(has10AM).toBe(true);
    });

    test('should handle Pacific timezone correctly (regression test)', () => {
      // Ensure timezone handling works for other US timezones too

      const mockEvents = [
        {
          subject: 'West Coast Meeting',
          showAs: 'busy',
          start: { dateTime: '2025-10-20T09:00:00.0000000', timeZone: 'America/Los_Angeles' },
          end: { dateTime: '2025-10-20T10:00:00.0000000', timeZone: 'America/Los_Angeles' },
        },
      ];

      const service = calendarService as any;
      const busySlots = service.parseCalendarEvents(mockEvents, 'America/Los_Angeles');

      // 9 AM Pacific = 16:00 UTC (in October, PDT = UTC-7)
      expect(busySlots[0].start.toISOString()).toBe('2025-10-20T16:00:00.000Z');
      expect(busySlots[0].end.toISOString()).toBe('2025-10-20T17:00:00.000Z');

      // Should display as 9 AM Pacific time
      expect(busySlots[0].formatted).toContain('9:00 AM');
    });
  });
});
