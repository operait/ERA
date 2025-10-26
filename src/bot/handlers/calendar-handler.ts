/**
 * Calendar Handler for ERA Bot
 * Handles multi-turn conversation flow for calendar booking
 */

import { TurnContext, MessageFactory } from 'botbuilder';
import { calendarService } from '../../services/calendar';
import { conversationStateManager } from '../../services/conversation-state';
import { graphClient } from '../../lib/graph-client';
import type { CalendarConversationState, ConversationState } from '../../services/conversation-state';

export class CalendarHandler {
  /**
   * Detect if response recommends calling/scheduling
   * @deprecated Use detectCalendarRecommendationWithContext for context-aware detection
   */
  detectCalendarRecommendation(response: string): boolean {
    const calendarKeywords = [
      'schedule a call',
      'call the employee',
      'phone call',
      'schedule a meeting',
      'set up a call',
      'arrange a call',
      'recommend calling',
      'you should call',
      'best to call',
      'one-on-one call',
      'speak with them',
      'reach out by phone',
      'contact them by phone',
      'have a conversation with',
      'discuss with them',
      'speak with the employee',
      'talk to them',
      'call them',
      'phone them',
      'make contact',
      'reach them',
      'schedule that call',
      'set up a meeting',
      'would you like me to schedule',
      'i can schedule',
      'check your calendar',
      'find available times',
    ];

    const lowerResponse = response.toLowerCase();
    return calendarKeywords.some(keyword => lowerResponse.includes(keyword));
  }

  /**
   * Context-aware calendar detection
   * Prevents premature triggers during clarification phase
   * Based on: specs/CONTEXT_AWARE_ACTIONS.md
   */
  detectCalendarRecommendationWithContext(
    response: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    conversationState: ConversationState | null
  ): boolean {
    // Step 1: State guard - don't trigger if already in calendar flow
    if (conversationState?.type === 'calendar') {
      return false;
    }

    // Step 2: Clarification detection - don't trigger if ERA is asking questions
    if (this.containsClarifyingQuestions(response)) {
      return false;
    }

    // Step 3: Conversation depth check - require minimum turns
    if (conversationHistory.length < 2) {
      return false;
    }

    // Step 4: Context gathering verification - ensure manager answered ERA's questions
    if (!this.isContextGathered(conversationHistory)) {
      return false;
    }

    // Step 5: Keyword matching - final check
    return this.containsCalendarKeywords(response);
  }

  /**
   * Check if response contains clarifying questions
   * Returns true if ERA is still gathering context
   */
  private containsClarifyingQuestions(response: string): boolean {
    const lowerResponse = response.toLowerCase();

    // Check for clarification phrases (strong signals)
    const clarificationPhrases = [
      'just to make sure',
      'just to confirm',
      'can you clarify',
      'need to know',
      'could you provide',
      'what about',
      'have you',
      'did you',
      'were these',
      'was this',
      'to confirm',
    ];

    const hasClarificationPhrases = clarificationPhrases.some(
      phrase => lowerResponse.includes(phrase)
    );

    if (hasClarificationPhrases) {
      return true; // Definitely clarifying
    }

    // Check for questions, but exclude simple confirmation questions
    const hasQuestions = response.includes('?');
    if (!hasQuestions) {
      return false; // No questions at all
    }

    // Extract the last sentence (after the last period or newline)
    const lastSentence = response.split(/[.\n]/).filter(s => s.trim()).pop() || response;

    // Only treat as confirmation if the final question is short (< 50 chars)
    // This avoids catching full sentences like "would you like me to schedule a call?"
    if (lastSentence.trim().length < 50) {
      const confirmationPatterns = [
        /^.*schedule that\?$/i,
        /^.*draft it\?$/i,
        /^.*schedule the call\?$/i,
        /^.*draft an email\?$/i,
        /^.*schedule that call\?$/i,
      ];

      const isConfirmationOnly = confirmationPatterns.some(
        pattern => pattern.test(lastSentence.trim())
      );

      if (isConfirmationOnly) {
        return false; // Don't treat as clarification
      }
    }

    // Check if question is an action offer (should not block trigger)
    const actionOfferPhrases = [
      'would you like me to schedule',
      'would you like me to draft',
      'would you like me to',
      'i can schedule',
      'i can draft',
      'want me to schedule',
      'want me to draft',
      'shall i schedule',
      'shall i draft',
    ];

    if (actionOfferPhrases.some(phrase => lowerResponse.includes(phrase))) {
      return false; // Action offer, not clarification
    }

    // If we get here, it's a real clarifying question
    return true;
  }

  /**
   * Check if context has been gathered from manager
   * Returns true if manager has answered ERA's questions
   */
  private isContextGathered(
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
  ): boolean {
    // Find last ERA question
    let lastERAQuestionIndex = -1;
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      if (conversationHistory[i].role === 'assistant' &&
          conversationHistory[i].content.includes('?')) {
        lastERAQuestionIndex = i;
        break;
      }
    }

    // If ERA never asked questions, context is gathered
    if (lastERAQuestionIndex === -1) {
      return true;
    }

    // Check if user responded after ERA's question
    return conversationHistory.length > lastERAQuestionIndex + 1;
  }

  /**
   * Check if response contains calendar action keywords
   */
  private containsCalendarKeywords(response: string): boolean {
    const calendarKeywords = [
      'schedule a call',
      'schedule that call',
      'schedule the call',
      'call the employee',
      'phone call',
      'schedule a meeting',
      'set up a call',
      'arrange a call',
      'would you like me to schedule',
      'i can schedule',
      'check your calendar',
      'find available times',
      'you should call',
      'you need to call',
      'make a second call',
      'schedule that',
    ];

    const lowerResponse = response.toLowerCase();
    return calendarKeywords.some(keyword => lowerResponse.includes(keyword));
  }

  /**
   * Start calendar conversation flow
   */
  async startCalendarFlow(
    context: TurnContext,
    conversationId: string,
    managerEmail: string,
    topic: string = 'HR Discussion',
    firstName: string = 'there'
  ): Promise<void> {
    conversationStateManager.startCalendarConversation(conversationId, topic);

    await context.sendActivity(MessageFactory.text(
      `I'll help you schedule that call${firstName !== 'there' ? ', ' + firstName : ''}. Let me check your calendar for available times...`
    ));

    try {
      // Try multiple methods to detect the user's timezone (in priority order)
      let managerTimezone: string | undefined;

      // METHOD 1: Try to get timezone from Teams activity context (most reliable)
      try {
        // Teams provides timezone in the activity's localTimezone or entities
        const teamsTimezone = (context.activity as any).localTimezone;
        const entitiesTimezone = (context.activity as any).entities?.find((e: any) =>
          e.type === 'clientInfo' || e.type === 'timezone'
        )?.timezone;

        const detectedTeamsTimezone = teamsTimezone || entitiesTimezone;

        if (detectedTeamsTimezone && detectedTeamsTimezone !== 'UTC') {
          managerTimezone = detectedTeamsTimezone;
          console.log(`✅ Detected timezone from Teams context: ${managerTimezone}`);
        }
      } catch (error) {
        console.log('Could not detect timezone from Teams context:', error);
      }

      // METHOD 2: Fallback to mailbox settings if Teams didn't provide timezone
      if (!managerTimezone) {
        try {
          const mailboxSettings = await graphClient.getUserMailboxSettings(managerEmail);
          const detectedTimezone = mailboxSettings.timeZone;

          // Treat UTC as invalid - it means the user hasn't configured their timezone properly
          if (detectedTimezone && detectedTimezone !== 'UTC') {
            managerTimezone = detectedTimezone;
            console.log(`✅ Detected timezone from mailbox settings: ${managerTimezone}`);
          } else {
            console.log(`⚠️  Mailbox timezone is ${detectedTimezone || 'not set'}, will try calendar events`);
          }
        } catch (error) {
          console.log('Failed to fetch mailbox timezone:', error);
        }
      }

      // METHOD 3: Final fallback - use Eastern Time
      if (!managerTimezone) {
        console.log(`⚠️  Could not detect timezone, using default: America/New_York`);
        managerTimezone = 'America/New_York';
      }

      // Store timezone in conversation state for later use
      conversationStateManager.updateCalendarState(conversationId, {
        managerTimezone,
      });

      // Fetch available slots with manager's timezone
      const availableSlots = await calendarService.getAvailableSlots(
        managerEmail,
        7,
        managerTimezone
      );

      if (availableSlots.length === 0) {
        await context.sendActivity(MessageFactory.text(
          "I couldn't find any available time slots in the next 7 days. Your calendar might be fully booked. Please free up some time and try again."
        ));
        conversationStateManager.clearState(conversationId);
        return;
      }

      // Get top 3 recommendations
      const topSlots = calendarService.getTopRecommendations(availableSlots, 3);

      // Update state with available slots
      conversationStateManager.updateCalendarState(conversationId, {
        availableSlots: topSlots,
        step: 'awaiting_time_selection',
      });

      // Show available times
      let message = '📅 **Available Times:**\n\n';
      topSlots.forEach((slot, index) => {
        message += `${index + 1}. ${slot.formatted}\n`;
      });
      message += '\nWhich time works best? (Reply with the number)';

      await context.sendActivity(MessageFactory.text(message));
    } catch (error: any) {
      console.error('Error fetching calendar availability:', error);
      await context.sendActivity(MessageFactory.text(
        `I encountered an error checking your calendar: ${error.message}\n\nPlease ensure I have permission to access your calendar.`
      ));
      conversationStateManager.clearState(conversationId);
    }
  }

  /**
   * Handle calendar conversation step
   */
  async handleCalendarStep(
    context: TurnContext,
    conversationId: string,
    userInput: string,
    managerEmail: string,
    managerId: string,
    firstName: string
  ): Promise<boolean> {
    const state = conversationStateManager.getState(conversationId) as CalendarConversationState;

    if (!state || state.type !== 'calendar') {
      return false;
    }

    // If booking is completed, don't intercept - let main handler process follow-up questions
    // but keep the context available for reference
    if (state.step === 'completed') {
      return false;
    }

    switch (state.step) {
      case 'awaiting_time_selection':
        return await this.handleTimeSelection(context, conversationId, userInput, state);

      case 'awaiting_employee_name':
        return await this.handleEmployeeName(context, conversationId, userInput, state);

      case 'awaiting_employee_phone':
        return await this.handleEmployeePhone(context, conversationId, userInput, state);

      case 'awaiting_confirmation':
        return await this.handleConfirmation(
          context,
          conversationId,
          userInput,
          managerEmail,
          managerId,
          firstName,
          state
        );

      default:
        return false;
    }
  }

  /**
   * Handle time slot selection
   */
  private async handleTimeSelection(
    context: TurnContext,
    conversationId: string,
    userInput: string,
    state: CalendarConversationState
  ): Promise<boolean> {
    const input = userInput.trim();
    const slotNumber = parseInt(input, 10);

    if (isNaN(slotNumber) || slotNumber < 1 || slotNumber > (state.availableSlots?.length || 0)) {
      await context.sendActivity(MessageFactory.text(
        `Please enter a valid number (1-${state.availableSlots?.length || 0}).`
      ));
      return true;
    }

    const selectedIndex = slotNumber - 1;
    conversationStateManager.updateCalendarState(conversationId, {
      selectedSlotIndex: selectedIndex,
      step: 'awaiting_employee_name',
    });

    await context.sendActivity(MessageFactory.text(
      "Great! What is the employee's name for this call?"
    ));

    return true;
  }

  /**
   * Handle employee name input
   */
  private async handleEmployeeName(
    context: TurnContext,
    conversationId: string,
    employeeName: string,
    _state: CalendarConversationState
  ): Promise<boolean> {
    conversationStateManager.updateCalendarState(conversationId, {
      employeeName: employeeName.trim(),
      step: 'awaiting_employee_phone',
    });

    await context.sendActivity(MessageFactory.text(
      `What is ${employeeName.trim()}'s phone number? (Or type "skip" if you don't have it)`
    ));

    return true;
  }

  /**
   * Handle employee phone input
   */
  private async handleEmployeePhone(
    context: TurnContext,
    conversationId: string,
    userInput: string,
    state: CalendarConversationState
  ): Promise<boolean> {
    const input = userInput.trim().toLowerCase();
    const phone = input === 'skip' ? undefined : userInput.trim();

    conversationStateManager.updateCalendarState(conversationId, {
      employeePhone: phone,
      step: 'awaiting_confirmation',
    });

    // Show booking confirmation
    await this.showBookingPreview(context, conversationId, state);

    return true;
  }

  /**
   * Show booking preview
   */
  private async showBookingPreview(
    context: TurnContext,
    conversationId: string,
    state: CalendarConversationState
  ): Promise<void> {
    const selectedSlot = state.availableSlots?.[state.selectedSlotIndex!];

    if (!selectedSlot) {
      await context.sendActivity(MessageFactory.text(
        'Error: Selected time slot not found. Please start over.'
      ));
      conversationStateManager.clearState(conversationId);
      return;
    }

    let preview = `
📅 **Calendar Booking Preview**

**Employee:** ${state.employeeName}
**Time:** ${selectedSlot.formatted}
**Topic:** ${state.topic || 'HR Discussion'}
`;

    if (state.employeePhone) {
      preview += `**Phone:** ${state.employeePhone}\n`;
    }

    preview += '\n---\nShould I book this on your calendar? (Reply "yes" to confirm, or "no" to cancel)';

    await context.sendActivity(MessageFactory.text(preview));
  }

  /**
   * Handle booking confirmation
   */
  private async handleConfirmation(
    context: TurnContext,
    conversationId: string,
    userInput: string,
    managerEmail: string,
    managerId: string,
    firstName: string,
    state: CalendarConversationState
  ): Promise<boolean> {
    const input = userInput.toLowerCase().trim();

    if (input === 'yes' || input === 'y' || input === 'book' || input === 'book it') {
      await context.sendActivity(MessageFactory.text('📅 Booking calendar event...'));

      const selectedSlot = state.availableSlots?.[state.selectedSlotIndex!];

      if (!selectedSlot) {
        await context.sendActivity(MessageFactory.text(
          'Error: Selected time slot not found. Please start over.'
        ));
        conversationStateManager.clearState(conversationId);
        return true;
      }

      const result = await calendarService.bookEvent(
        managerId,
        managerEmail,
        {
          employeeName: state.employeeName!,
          employeePhone: state.employeePhone,
          topic: state.topic || 'HR Discussion',
          startTime: selectedSlot.start,
          endTime: selectedSlot.end,
          reminderMinutes: 15,
        },
        state.managerTimezone
      );

      if (result.success) {
        await context.sendActivity(MessageFactory.text(
          `✅ Calendar event booked successfully!\n\n**${state.employeeName} - ${state.topic}**\n${selectedSlot.formatted}\n\nYou'll receive a reminder 15 minutes before.\n\nIs there anything else I can help you with${firstName !== 'there' ? ', ' + firstName : ''}?`
        ));

        // Mark as completed but keep context for follow-up questions
        conversationStateManager.updateCalendarState(conversationId, {
          step: 'completed',
          bookedTime: selectedSlot.formatted,
        });
      } else {
        await context.sendActivity(MessageFactory.text(
          `❌ Failed to book calendar event: ${result.error}\n\nPlease try again or contact IT support if the issue persists.`
        ));

        // Clear state on failure
        conversationStateManager.clearState(conversationId);
      }

      return true;
    } else if (input === 'no' || input === 'n' || input === 'cancel') {
      await context.sendActivity(MessageFactory.text(
        `Booking cancelled. Is there anything else I can help you with${firstName !== 'there' ? ', ' + firstName : ''}?`
      ));

      // Clear conversation state
      conversationStateManager.clearState(conversationId);
      return true;
    } else {
      await context.sendActivity(MessageFactory.text(
        'Please reply "yes" to book the event or "no" to cancel.'
      ));
      return true;
    }
  }

  /**
   * Extract topic from Claude response
   */
  extractTopic(response: string, userQuery: string): string {
    // Try to infer topic from user query or response
    const topics: Record<string, string> = {
      'attendance': 'Attendance Discussion',
      'tardy': 'Tardiness Discussion',
      'performance': 'Performance Review',
      'warning': 'Disciplinary Warning',
      'termination': 'Termination Discussion',
      'leave': 'Leave Request Discussion',
    };

    const combinedText = (userQuery + ' ' + response).toLowerCase();

    for (const [keyword, topic] of Object.entries(topics)) {
      if (combinedText.includes(keyword)) {
        return topic;
      }
    }

    return 'HR Discussion';
  }
}

export const calendarHandler = new CalendarHandler();
