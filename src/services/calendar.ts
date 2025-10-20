/**
 * Calendar Service
 * Handles calendar availability checking and event booking via Microsoft Graph API
 */

import { graphClient } from '../lib/graph-client';
import { supabase } from '../lib/supabase';
import type { CalendarEvent, CalendarView, TimeSlot, AvailabilityResult } from '../types/graph';

export interface BookingRequest {
  employeeName: string;
  employeePhone?: string;
  topic: string;
  startTime: Date;
  endTime: Date;
  reminderMinutes?: number;
}

export interface BookingResult {
  success: boolean;
  eventId?: string;
  bookingId?: string;
  error?: string;
}

class CalendarService {
  private readonly WORKING_HOURS_START = 9; // 9 AM
  private readonly WORKING_HOURS_END = 17; // 5 PM
  private readonly DEFAULT_MEETING_DURATION = 30; // minutes
  private readonly DAYS_AHEAD = 7; // Look 7 days ahead
  private readonly DEFAULT_TIMEZONE = 'America/New_York'; // Eastern Time

  /**
   * Get available time slots for a manager
   */
  async getAvailableSlots(
    managerEmail: string,
    daysAhead: number = this.DAYS_AHEAD,
    managerTimezone: string = this.DEFAULT_TIMEZONE
  ): Promise<TimeSlot[]> {
    try {
      // Get current time in UTC
      const now = new Date();
      const startDate = this.getNextBusinessHour(now, managerTimezone);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + daysAhead);

      console.log(`📅 Fetching calendar availability for ${managerEmail}`);
      console.log(`   Timezone: ${managerTimezone}`);
      console.log(`   Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

      // Get calendar events from Graph API with timezone preference
      const calendarView = await graphClient.getCalendarView(
        managerEmail,
        startDate.toISOString(),
        endDate.toISOString(),
        managerTimezone
      );

      const totalEvents = calendarView.value?.length || 0;
      console.log(`   Found ${totalEvents} calendar events`);

      if (totalEvents >= 250) {
        console.warn(`   ⚠️  WARNING: Hit 250 event limit! Some events may be missing.`);
      }

      if (calendarView.value && calendarView.value.length > 0) {
        console.log('   Calendar events found:');
        calendarView.value.forEach((event: any) => {
          const status = event.showAs || 'unknown';
          console.log(`     - ${event.subject} [${status}]: ${event.start.dateTime} to ${event.end.dateTime}`);
        });
      }

      const busySlots = this.parseCalendarEvents(calendarView.value || [], managerTimezone);
      console.log(`   Busy slots after filtering: ${busySlots.length}`);

      const availableSlots = this.findAvailableSlots(startDate, endDate, busySlots, managerTimezone);

      console.log(`   Generated ${availableSlots.length} available slots`);
      if (availableSlots.length > 0) {
        console.log('   First few available:');
        availableSlots.slice(0, 5).forEach(slot => {
          console.log(`     - ${slot.formatted}`);
        });
      }

      return availableSlots;
    } catch (error: any) {
      console.error('Error getting available slots:', error);
      throw new Error(`Failed to fetch calendar availability: ${error.message}`);
    }
  }

  /**
   * Parse calendar events into busy time slots
   * Converts Graph API times (in manager's timezone) to UTC
   */
  private parseCalendarEvents(events: any[], managerTimezone: string): TimeSlot[] {
    return events
      .filter(event => {
        // Filter out events marked as "free" (they don't block availability)
        // showAs values: free, tentative, busy, oof, workingElsewhere, unknown
        return event.showAs !== 'free';
      })
      .map(event => {
        // Graph API returns dateTime in format: "2025-10-14T09:00:00.0000000"
        // This time is in the manager's timezone (timeZone field)
        const startDateTime = event.start.dateTime;
        const endDateTime = event.end.dateTime;
        const timeZone = event.start.timeZone || managerTimezone;

        console.log(`     Parsing event: ${event.subject} (${event.showAs || 'busy'})`);
        console.log(`       Raw start: ${startDateTime} (${timeZone})`);
        console.log(`       Raw end: ${endDateTime}`);

        // Parse the datetime strings (remove trailing zeros)
        const cleanStart = startDateTime.split('.')[0]; // "2025-10-14T09:00:00"
        const cleanEnd = endDateTime.split('.')[0];

        // Convert from manager's timezone to UTC
        // Strategy: Create a Date by telling JavaScript this is in the manager's timezone
        const start = this.parseInTimezone(cleanStart, timeZone);
        const end = this.parseInTimezone(cleanEnd, timeZone);

        console.log(`       Parsed start UTC: ${start.toISOString()}`);
        console.log(`       Parsed end UTC: ${end.toISOString()}`);
        console.log(`       Display in manager TZ: ${this.formatTimeSlot(start, end, timeZone)}`);

        return {
          start,
          end,
          formatted: this.formatTimeSlot(start, end, timeZone),
        };
      });
  }

  /**
   * Parse a datetime string in a specific timezone and return UTC Date
   * Example: "2025-10-21T08:00:00" in "America/Chicago" -> Date in UTC
   *
   * Strategy: We create a Date in UTC with the given date/time values, then find the
   * offset between UTC and the target timezone, and adjust accordingly.
   */
  private parseInTimezone(dateTimeStr: string, timezone: string): Date {
    // Parse the datetime components
    const parts = dateTimeStr.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
    if (!parts) {
      throw new Error(`Invalid datetime format: ${dateTimeStr}`);
    }

    const [, year, month, day, hour, minute, second] = parts;

    // Step 1: Create a Date in UTC with the given time components
    // This represents what the clock would show in UTC
    const utcClockTime = new Date(Date.UTC(
      parseInt(year),
      parseInt(month) - 1, // JavaScript months are 0-indexed
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    ));

    // Step 2: Format this UTC time as if it were displayed in the target timezone
    // This tells us what the clock would show in the target timezone for this UTC moment
    const clockInTargetTZ = utcClockTime.toLocaleString('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    // Step 3: Parse the formatted string to extract the components
    const tzMatch = clockInTargetTZ.match(/(\d{2})\/(\d{2})\/(\d{4}),\s(\d{2}):(\d{2}):(\d{2})/);
    if (!tzMatch) {
      // Fallback: assume the time is already in UTC
      console.warn(`Could not parse timezone formatted string: ${clockInTargetTZ}`);
      return utcClockTime;
    }

    const [, tzMonth, tzDay, tzYear, tzHour, tzMinute, tzSecond] = tzMatch;

    // Step 4: Calculate the offset
    // We want: when it's X:00 in the target timezone, what time is it in UTC?
    // We have: when it's Y:00 in UTC, it displays as Z:00 in the target timezone
    // Offset = (desired local time) - (actual local time from UTC moment)
    const desiredMs = Date.UTC(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second)
    );

    const actualInTZMs = Date.UTC(
      parseInt(tzYear),
      parseInt(tzMonth) - 1,
      parseInt(tzDay),
      parseInt(tzHour),
      parseInt(tzMinute),
      parseInt(tzSecond)
    );

    const offsetMs = desiredMs - actualInTZMs;

    // Step 5: Apply the offset to get the correct UTC time
    // When it's 8:00 AM in Chicago, we need to find what UTC time that represents
    return new Date(utcClockTime.getTime() + offsetMs);
  }

  /**
   * Find available time slots within working hours
   * All dates are in UTC, but we need to check working hours in the manager's timezone
   */
  private findAvailableSlots(
    startDate: Date,
    endDate: Date,
    busySlots: TimeSlot[],
    managerTimezone: string
  ): TimeSlot[] {
    const availableSlots: TimeSlot[] = [];
    const currentSlot = new Date(startDate);

    console.log(`   Finding slots between ${startDate.toISOString()} and ${endDate.toISOString()}`);
    console.log(`   Working hours: ${this.WORKING_HOURS_START} - ${this.WORKING_HOURS_END} (in ${managerTimezone})`);

    while (currentSlot < endDate) {
      // Get the hour in the manager's timezone
      const hourInTZ = parseInt(currentSlot.toLocaleString('en-US', {
        timeZone: managerTimezone,
        hour: '2-digit',
        hour12: false,
      }));

      const dayInTZ = currentSlot.toLocaleString('en-US', {
        timeZone: managerTimezone,
        weekday: 'short',
      });

      // Skip weekends
      if (dayInTZ === 'Sat' || dayInTZ === 'Sun') {
        currentSlot.setTime(currentSlot.getTime() + 24 * 60 * 60 * 1000); // Add 1 day
        continue;
      }

      // Skip outside working hours
      if (hourInTZ < this.WORKING_HOURS_START || hourInTZ >= this.WORKING_HOURS_END) {
        currentSlot.setTime(currentSlot.getTime() + 30 * 60 * 1000); // Move forward 30 min
        continue;
      }

      const slotEnd = new Date(currentSlot.getTime() + this.DEFAULT_MEETING_DURATION * 60 * 1000);

      // Check if slot end is still within working hours
      const endHourInTZ = parseInt(slotEnd.toLocaleString('en-US', {
        timeZone: managerTimezone,
        hour: '2-digit',
        hour12: false,
      }));

      if (endHourInTZ > this.WORKING_HOURS_END) {
        // Slot would go past end of working day, skip to next day
        currentSlot.setTime(currentSlot.getTime() + 30 * 60 * 1000);
        continue;
      }

      // Check if slot overlaps with any busy time
      const isAvailable = !this.overlapsWithBusySlot(currentSlot, slotEnd, busySlots);

      // Debug logging for first few slots
      if (availableSlots.length < 5 || !isAvailable) {
        console.log(`     Checking slot: ${this.formatTimeSlot(currentSlot, slotEnd, managerTimezone)}`);
        console.log(`       Slot start UTC: ${currentSlot.toISOString()}`);
        console.log(`       Slot end UTC: ${slotEnd.toISOString()}`);
        console.log(`       Available: ${isAvailable}`);
        if (!isAvailable) {
          console.log(`       BLOCKED by existing calendar event`);
        }
      }

      if (isAvailable) {
        availableSlots.push({
          start: new Date(currentSlot),
          end: new Date(slotEnd),
          formatted: this.formatTimeSlot(currentSlot, slotEnd, managerTimezone),
        });
      }

      // Move to next 30-minute slot
      currentSlot.setTime(currentSlot.getTime() + 30 * 60 * 1000);
    }

    return availableSlots;
  }

  /**
   * Check if a time slot overlaps with any busy slots
   * Two time ranges overlap if one starts before the other ends
   * BUT: If one ends exactly when the other starts, they do NOT overlap (back-to-back is OK)
   */
  private overlapsWithBusySlot(
    start: Date,
    end: Date,
    busySlots: TimeSlot[]
  ): boolean {
    const overlapping = busySlots.find(busy => {
      // Two ranges [start1, end1) and [start2, end2) overlap if:
      // start1 < end2 AND start2 < end1
      // This correctly handles back-to-back slots (e.g., 9:30 end meeting, 9:30 start slot = OK)
      const overlaps = start < busy.end && busy.start < end;

      if (overlaps) {
        console.log(`         Overlaps with busy slot: ${busy.formatted}`);
        console.log(`           Busy start: ${busy.start.toISOString()}`);
        console.log(`           Busy end: ${busy.end.toISOString()}`);
      }

      return overlaps;
    });

    return !!overlapping;
  }

  /**
   * Format time slot for display in the manager's timezone
   */
  private formatTimeSlot(start: Date, end: Date, timezone: string): string {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    };

    const startStr = start.toLocaleString('en-US', options);
    const endTime = end.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    });

    return `${startStr} - ${endTime}`;
  }

  /**
   * Get next business hour in the manager's timezone
   * Returns a Date in UTC that represents the next business hour in the manager's timezone
   */
  private getNextBusinessHour(date: Date, timezone: string): Date {
    let next = new Date(date);

    // Get the day and hour in the manager's timezone
    let dayInTZ = next.toLocaleString('en-US', { timeZone: timezone, weekday: 'short' });
    let hourInTZ = parseInt(next.toLocaleString('en-US', { timeZone: timezone, hour: '2-digit', hour12: false }));

    // Skip to next Monday if weekend
    while (dayInTZ === 'Sat' || dayInTZ === 'Sun') {
      next = new Date(next.getTime() + 24 * 60 * 60 * 1000);
      dayInTZ = next.toLocaleString('en-US', { timeZone: timezone, weekday: 'short' });
      hourInTZ = parseInt(next.toLocaleString('en-US', { timeZone: timezone, hour: '2-digit', hour12: false }));
    }

    // If before working hours, move to start of working day
    if (hourInTZ < this.WORKING_HOURS_START) {
      // Find the UTC time that corresponds to 9 AM in the manager's timezone on this date
      const dateInTZ = next.toLocaleString('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const [month, day, year] = dateInTZ.split('/');
      const startOfDay = this.parseInTimezone(
        `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${String(this.WORKING_HOURS_START).padStart(2, '0')}:00:00`,
        timezone
      );
      return startOfDay;
    }

    // If after working hours, move to next business day start
    if (hourInTZ >= this.WORKING_HOURS_END) {
      next = new Date(next.getTime() + 24 * 60 * 60 * 1000);
      return this.getNextBusinessHour(next, timezone);
    }

    // Round up to next 30-minute interval
    const minuteInTZ = parseInt(next.toLocaleString('en-US', { timeZone: timezone, minute: '2-digit' }));
    if (minuteInTZ > 0 && minuteInTZ <= 30) {
      // Round to 30
      next = new Date(next.getTime() + (30 - minuteInTZ) * 60 * 1000);
    } else if (minuteInTZ > 30) {
      // Round to next hour
      next = new Date(next.getTime() + (60 - minuteInTZ) * 60 * 1000);
    }

    return next;
  }

  /**
   * Get top N recommended time slots
   * NOTE: This method doesn't need timezone because the slots are already sorted
   * chronologically, and we prefer earlier times which is timezone-independent
   */
  getTopRecommendations(slots: TimeSlot[], count: number = 3): TimeSlot[] {
    // Simply return the first N slots, as they're already chronologically ordered
    // and we prefer to recommend sooner times over later times
    const topSlots = slots.slice(0, count);

    console.log(`   Recommended ${topSlots.length} top slots to user`);

    return topSlots;
  }

  /**
   * Book a calendar event
   */
  async bookEvent(
    managerId: string,
    managerEmail: string,
    booking: BookingRequest,
    managerTimezone?: string
  ): Promise<BookingResult> {
    try {
      // Use manager's timezone or fall back to default
      const timezone = managerTimezone || this.DEFAULT_TIMEZONE;

      // Format the datetime for Graph API in the manager's timezone
      // The booking times are in UTC, we need to convert to manager's timezone
      const formatDateTimeInTimezone = (utcDate: Date, tz: string): string => {
        // Get the local time representation in the target timezone
        const formatted = utcDate.toLocaleString('en-US', {
          timeZone: tz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        });

        // Parse MM/DD/YYYY, HH:mm:ss format
        const match = formatted.match(/(\d{2})\/(\d{2})\/(\d{4}),\s(\d{2}):(\d{2}):(\d{2})/);
        if (!match) {
          throw new Error(`Failed to format date: ${formatted}`);
        }

        const [, month, day, year, hour, minute, second] = match;
        return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
      };

      const startDateTime = formatDateTimeInTimezone(booking.startTime, timezone);
      const endDateTime = formatDateTimeInTimezone(booking.endTime, timezone);

      console.log(`📅 Booking calendar event in timezone: ${timezone}`);
      console.log(`   Start UTC: ${booking.startTime.toISOString()}`);
      console.log(`   Start ${timezone}: ${startDateTime}`);
      console.log(`   End UTC: ${booking.endTime.toISOString()}`);
      console.log(`   End ${timezone}: ${endDateTime}`);

      // Create calendar event
      const event = {
        subject: `Call: ${booking.employeeName} - ${booking.topic}`,
        body: {
          contentType: 'html' as const,
          content: this.createEventDescription(booking),
        },
        start: {
          dateTime: startDateTime,
          timeZone: timezone,
        },
        end: {
          dateTime: endDateTime,
          timeZone: timezone,
        },
        isReminderOn: true,
        reminderMinutesBeforeStart: booking.reminderMinutes || 15,
      };

      // Create event via Graph API
      const createdEvent = await graphClient.createCalendarEvent(managerEmail, event);

      // Log booking in database
      const { data: bookingLog, error: logError } = await supabase
        .from('calendar_bookings')
        .insert({
          manager_id: managerId,
          manager_email: managerEmail,
          employee_name: booking.employeeName,
          employee_phone: booking.employeePhone,
          event_id: createdEvent.id,
          scheduled_time: booking.startTime.toISOString(),
          duration_minutes:
            (booking.endTime.getTime() - booking.startTime.getTime()) / (1000 * 60),
          topic: booking.topic,
          status: 'scheduled',
        })
        .select()
        .single();

      if (logError) {
        console.error('Error creating booking log:', logError);
        // Event was created but logging failed - not critical
      }

      return {
        success: true,
        eventId: createdEvent.id,
        bookingId: bookingLog?.id,
      };
    } catch (error: any) {
      console.error('Error booking event:', error);
      return {
        success: false,
        error: error.message || 'Failed to book calendar event',
      };
    }
  }

  /**
   * Create event description with employee details
   */
  private createEventDescription(booking: BookingRequest): string {
    let description = `<p><strong>Employee:</strong> ${booking.employeeName}</p>`;

    if (booking.employeePhone) {
      description += `<p><strong>Phone:</strong> ${booking.employeePhone}</p>`;
    }

    description += `<p><strong>Topic:</strong> ${booking.topic}</p>`;
    description += `<hr><p><em>Scheduled by ERA - Fitness Connection HR Assistant</em></p>`;

    return description;
  }

  /**
   * Cancel a calendar event
   */
  async cancelEvent(
    managerEmail: string,
    eventId: string,
    bookingId?: string
  ): Promise<boolean> {
    try {
      await graphClient.deleteCalendarEvent(managerEmail, eventId);

      // Update booking status if bookingId provided
      if (bookingId) {
        await supabase
          .from('calendar_bookings')
          .update({ status: 'cancelled' })
          .eq('id', bookingId);
      }

      return true;
    } catch (error) {
      console.error('Error canceling event:', error);
      return false;
    }
  }

  /**
   * Get upcoming bookings for a manager
   */
  async getUpcomingBookings(managerId: string, limit: number = 10) {
    try {
      const { data, error } = await supabase
        .from('calendar_bookings')
        .select('*')
        .eq('manager_id', managerId)
        .eq('status', 'scheduled')
        .gte('scheduled_time', new Date().toISOString())
        .order('scheduled_time', { ascending: true })
        .limit(limit);

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching upcoming bookings:', error);
      return [];
    }
  }
}

// Export singleton instance
export const calendarService = new CalendarService();
