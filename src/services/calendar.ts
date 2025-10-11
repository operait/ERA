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

  /**
   * Get available time slots for a manager
   */
  async getAvailableSlots(
    managerEmail: string,
    daysAhead: number = this.DAYS_AHEAD
  ): Promise<TimeSlot[]> {
    try {
      const now = new Date();
      const startDate = this.getNextBusinessHour(now);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + daysAhead);

      // Get calendar events from Graph API
      const calendarView = await graphClient.getCalendarView(
        managerEmail,
        startDate.toISOString(),
        endDate.toISOString()
      );

      const busySlots = this.parseCalendarEvents(calendarView.value || []);
      const availableSlots = this.findAvailableSlots(startDate, endDate, busySlots);

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
    return events.map(event => ({
      start: new Date(event.start.dateTime),
      end: new Date(event.end.dateTime),
      formatted: this.formatTimeSlot(
        new Date(event.start.dateTime),
        new Date(event.end.dateTime)
      ),
    }));
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

    while (currentSlot < endDate) {
      // Skip weekends
      if (currentSlot.getDay() === 0 || currentSlot.getDay() === 6) {
        currentSlot.setDate(currentSlot.getDate() + 1);
        currentSlot.setHours(this.WORKING_HOURS_START, 0, 0, 0);
        continue;
      }

      // Skip outside working hours
      const hour = currentSlot.getHours();
      if (hour < this.WORKING_HOURS_START || hour >= this.WORKING_HOURS_END) {
        if (hour >= this.WORKING_HOURS_END) {
          currentSlot.setDate(currentSlot.getDate() + 1);
          currentSlot.setHours(this.WORKING_HOURS_START, 0, 0, 0);
        } else {
          currentSlot.setHours(this.WORKING_HOURS_START, 0, 0, 0);
        }
        continue;
      }

      const slotEnd = new Date(currentSlot);
      slotEnd.setMinutes(slotEnd.getMinutes() + this.DEFAULT_MEETING_DURATION);

      // Check if slot overlaps with any busy time
      const isAvailable = !this.overlapsWithBusySlot(currentSlot, slotEnd, busySlots);

      if (isAvailable && slotEnd.getHours() <= this.WORKING_HOURS_END) {
        availableSlots.push({
          start: new Date(currentSlot),
          end: new Date(slotEnd),
          formatted: this.formatTimeSlot(currentSlot, slotEnd),
        });
      }

      // Move to next 30-minute slot
      currentSlot.setMinutes(currentSlot.getMinutes() + 30);
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
    return busySlots.some(busy => {
      return (
        (start >= busy.start && start < busy.end) ||
        (end > busy.start && end <= busy.end) ||
        (start <= busy.start && end >= busy.end)
      );
    });
  }

  /**
   * Format time slot for display
   */
  private formatTimeSlot(start: Date, end: Date): string {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    };

    const startStr = start.toLocaleString('en-US', options);
    const endTime = end.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return `${startStr} - ${endTime}`;
  }

  /**
   * Get next business hour (skip weekends and outside working hours)
   */
  private getNextBusinessHour(date: Date): Date {
    const next = new Date(date);

    // If weekend, move to Monday
    while (next.getDay() === 0 || next.getDay() === 6) {
      next.setDate(next.getDate() + 1);
    }

    // If outside working hours, move to next working hour
    const hour = next.getHours();
    if (hour < this.WORKING_HOURS_START) {
      next.setHours(this.WORKING_HOURS_START, 0, 0, 0);
    } else if (hour >= this.WORKING_HOURS_END) {
      next.setDate(next.getDate() + 1);
      next.setHours(this.WORKING_HOURS_START, 0, 0, 0);
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
      const hour = slot.start.getHours();

      // Prefer morning slots (9 AM - 12 PM)
      if (hour >= 9 && hour < 12) {
        score += 10;
      }

      // Prefer early in the week
      const day = slot.start.getDay();
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

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map(s => s.slot);
  }

  /**
   * Book a calendar event
   */
  async bookEvent(
    managerId: string,
    managerEmail: string,
    booking: BookingRequest
  ): Promise<BookingResult> {
    try {
      // Create calendar event
      const event = {
        subject: `Call: ${booking.employeeName} - ${booking.topic}`,
        body: {
          contentType: 'html' as const,
          content: this.createEventDescription(booking),
        },
        start: {
          dateTime: booking.startTime.toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: booking.endTime.toISOString(),
          timeZone: 'UTC',
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
