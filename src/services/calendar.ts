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
  private readonly DEFAULT_TIMEZONE = 'America/Chicago'; // Central Time (Fitness Connection HQ)

  /**
   * Get available time slots for a manager
   */
  async getAvailableSlots(
    managerEmail: string,
    daysAhead: number = this.DAYS_AHEAD,
    managerTimezone: string = this.DEFAULT_TIMEZONE
  ): Promise<TimeSlot[]> {
    try {
      // Create dates in UTC to match how we parse calendar events
      const now = new Date();
      const startDate = this.getNextBusinessHour(now);
      const endDate = new Date(startDate);
      endDate.setUTCDate(endDate.getUTCDate() + daysAhead);

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

      console.log(`   Found ${calendarView.value?.length || 0} calendar events`);

      if (calendarView.value && calendarView.value.length > 0) {
        console.log('   Calendar events found:');
        calendarView.value.forEach((event: any) => {
          const status = event.showAs || 'unknown';
          console.log(`     - ${event.subject} [${status}]: ${event.start.dateTime} to ${event.end.dateTime}`);
        });
      }

      const busySlots = this.parseCalendarEvents(calendarView.value || []);
      console.log(`   Busy slots after filtering: ${busySlots.length}`);

      const availableSlots = this.findAvailableSlots(startDate, endDate, busySlots);

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
   */
  private parseCalendarEvents(events: any[]): TimeSlot[] {
    return events
      .filter(event => {
        // Filter out events marked as "free" (they don't block availability)
        // showAs values: free, tentative, busy, oof, workingElsewhere, unknown
        return event.showAs !== 'free';
      })
      .map(event => {
        // Graph API returns dateTime in format: "2025-10-14T09:00:00.0000000"
        // When we use the Prefer header with timezone, Graph returns times in that timezone
        // However, the dateTime string has no timezone indicator, so JavaScript interprets it incorrectly
        const startDateTime = event.start.dateTime;
        const endDateTime = event.end.dateTime;
        const timeZone = event.start.timeZone;

        console.log(`     Parsing event: ${event.subject} (${event.showAs || 'busy'})`);
        console.log(`       Raw start: ${startDateTime} (${timeZone})`);
        console.log(`       Raw end: ${endDateTime}`);

        // CRITICAL FIX: The Graph API returns datetime without timezone indicator
        // e.g., "2025-10-14T09:00:00.0000000" means 9 AM in the manager's timezone
        // We need to parse this correctly - JavaScript's Date() without 'Z' treats it as LOCAL time
        // Since the server might be in a different timezone, we need to parse manually

        // Remove the trailing zeros that Graph API adds
        const cleanStart = startDateTime.split('.')[0]; // "2025-10-14T09:00:00"
        const cleanEnd = endDateTime.split('.')[0];

        // Parse as UTC by appending 'Z' - this creates the Date in UTC representation
        // The times ARE in the manager's timezone, so this preserves the actual time values
        const start = new Date(cleanStart + 'Z');
        const end = new Date(cleanEnd + 'Z');

        console.log(`       Parsed start: ${start.toISOString()} (local: ${start.toLocaleString('en-US')})`);
        console.log(`       Parsed end: ${end.toISOString()} (local: ${end.toLocaleString('en-US')})`);

        return {
          start,
          end,
          formatted: this.formatTimeSlot(start, end),
        };
      });
  }

  /**
   * Find available time slots within working hours
   */
  private findAvailableSlots(
    startDate: Date,
    endDate: Date,
    busySlots: TimeSlot[]
  ): TimeSlot[] {
    const availableSlots: TimeSlot[] = [];
    const currentSlot = new Date(startDate);

    console.log(`   Finding slots between ${startDate.toISOString()} and ${endDate.toISOString()}`);
    console.log(`   Working hours: ${this.WORKING_HOURS_START} - ${this.WORKING_HOURS_END} (using UTC hours)`);

    while (currentSlot < endDate) {
      // Use UTC methods since our busySlots are in UTC representation
      // Skip weekends
      if (currentSlot.getUTCDay() === 0 || currentSlot.getUTCDay() === 6) {
        currentSlot.setUTCDate(currentSlot.getUTCDate() + 1);
        currentSlot.setUTCHours(this.WORKING_HOURS_START, 0, 0, 0);
        continue;
      }

      // Skip outside working hours
      const hour = currentSlot.getUTCHours();
      if (hour < this.WORKING_HOURS_START || hour >= this.WORKING_HOURS_END) {
        if (hour >= this.WORKING_HOURS_END) {
          currentSlot.setUTCDate(currentSlot.getUTCDate() + 1);
          currentSlot.setUTCHours(this.WORKING_HOURS_START, 0, 0, 0);
        } else {
          currentSlot.setUTCHours(this.WORKING_HOURS_START, 0, 0, 0);
        }
        continue;
      }

      const slotEnd = new Date(currentSlot);
      slotEnd.setUTCMinutes(slotEnd.getUTCMinutes() + this.DEFAULT_MEETING_DURATION);

      // Check if slot overlaps with any busy time
      const isAvailable = !this.overlapsWithBusySlot(currentSlot, slotEnd, busySlots);

      // Debug logging for first few slots
      if (availableSlots.length < 5 || !isAvailable) {
        console.log(`     Checking slot: ${this.formatTimeSlot(currentSlot, slotEnd)}`);
        console.log(`       Slot start: ${currentSlot.toISOString()}`);
        console.log(`       Slot end: ${slotEnd.toISOString()}`);
        console.log(`       Available: ${isAvailable}`);
        if (!isAvailable) {
          console.log(`       BLOCKED by existing calendar event`);
        }
      }

      if (isAvailable && slotEnd.getUTCHours() <= this.WORKING_HOURS_END) {
        availableSlots.push({
          start: new Date(currentSlot),
          end: new Date(slotEnd),
          formatted: this.formatTimeSlot(currentSlot, slotEnd),
        });
      }

      // Move to next 30-minute slot
      currentSlot.setUTCMinutes(currentSlot.getUTCMinutes() + 30);
    }

    return availableSlots;
  }

  /**
   * Check if a time slot overlaps with any busy slots
   */
  private overlapsWithBusySlot(
    start: Date,
    end: Date,
    busySlots: TimeSlot[]
  ): boolean {
    const overlapping = busySlots.find(busy => {
      const overlaps = (
        (start >= busy.start && start < busy.end) ||
        (end > busy.start && end <= busy.end) ||
        (start <= busy.start && end >= busy.end)
      );

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
   * Format time slot for display
   * Uses UTC methods since our Date objects are stored in UTC representation
   * of the manager's local time
   */
  private formatTimeSlot(start: Date, end: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC', // CRITICAL: Use UTC since our dates are UTC-represented local times
    };

    const startStr = start.toLocaleString('en-US', options);
    const endTime = end.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC', // CRITICAL: Use UTC since our dates are UTC-represented local times
    });

    return `${startStr} - ${endTime}`;
  }

  /**
   * Get next business hour (skip weekends and outside working hours)
   * Uses UTC to match how we parse calendar events
   */
  private getNextBusinessHour(date: Date): Date {
    const next = new Date(date);

    // If weekend, move to Monday (using UTC day)
    while (next.getUTCDay() === 0 || next.getUTCDay() === 6) {
      next.setUTCDate(next.getUTCDate() + 1);
    }

    // If outside working hours, move to next working hour
    const hour = next.getUTCHours();
    if (hour < this.WORKING_HOURS_START) {
      next.setUTCHours(this.WORKING_HOURS_START, 0, 0, 0);
    } else if (hour >= this.WORKING_HOURS_END) {
      next.setUTCDate(next.getUTCDate() + 1);
      next.setUTCHours(this.WORKING_HOURS_START, 0, 0, 0);
      // Check if next day is weekend
      return this.getNextBusinessHour(next);
    }

    return next;
  }

  /**
   * Get top N recommended time slots
   */
  getTopRecommendations(slots: TimeSlot[], count: number = 3): TimeSlot[] {
    // Preference: Next business day, morning slots
    const scored = slots.map(slot => {
      let score = 0;
      const hour = slot.start.getUTCHours();

      // Prefer morning slots (9 AM - 12 PM)
      if (hour >= 9 && hour < 12) {
        score += 10;
      }

      // Prefer early in the week
      const day = slot.start.getUTCDay();
      if (day === 1 || day === 2) {
        score += 5;
      }

      // Prefer sooner dates
      const daysFromNow = Math.floor(
        (slot.start.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      score -= daysFromNow;

      return { slot, score };
    });

    const topSlots = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map(s => s.slot);

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
      // Format the datetime for Graph API without timezone conversion
      // The Date objects are already in the manager's local time
      const formatDateTimeLocal = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
      };

      // Use manager's timezone or fall back to default
      const timezone = managerTimezone || this.DEFAULT_TIMEZONE;

      console.log(`📅 Booking calendar event in timezone: ${timezone}`);
      console.log(`   Start: ${formatDateTimeLocal(booking.startTime)}`);
      console.log(`   End: ${formatDateTimeLocal(booking.endTime)}`);

      // Create calendar event
      const event = {
        subject: `Call: ${booking.employeeName} - ${booking.topic}`,
        body: {
          contentType: 'html' as const,
          content: this.createEventDescription(booking),
        },
        start: {
          dateTime: formatDateTimeLocal(booking.startTime),
          timeZone: timezone,
        },
        end: {
          dateTime: formatDateTimeLocal(booking.endTime),
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
