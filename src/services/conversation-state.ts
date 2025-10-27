/**
 * Conversation State Management
 * Handles multi-turn conversations for email and calendar flows
 */

export type ConversationType = 'email' | 'calendar' | 'none';

export interface EmailConversationState {
  type: 'email';
  step: 'awaiting_employee_name' | 'awaiting_employee_email' | 'awaiting_variables' | 'awaiting_confirmation';
  templateId?: string;
  recipientName?: string;
  recipientEmail?: string;
  subject?: string;
  body?: string;
  variables: Record<string, string>;
  missingVariables: string[];
  currentVariableIndex: number;
}

export interface CalendarConversationState {
  type: 'calendar';
  step: 'awaiting_initial_confirmation' | 'fetching_availability' | 'awaiting_time_selection' | 'awaiting_employee_name' | 'awaiting_employee_phone' | 'awaiting_confirmation' | 'completed';
  availableSlots?: Array<{ start: Date; end: Date; formatted: string }>;
  selectedSlotIndex?: number;
  employeeName?: string;
  employeePhone?: string;
  topic?: string;
  managerEmail?: string; // Store manager email for later use
  managerTimezone?: string;
  bookedTime?: string; // Store the formatted time for reference
}

export type ConversationState = EmailConversationState | CalendarConversationState | null;

/**
 * Manages conversation state for multi-turn flows
 */
class ConversationStateManager {
  private states: Map<string, ConversationState> = new Map();

  /**
   * Initialize email conversation
   */
  startEmailConversation(
    conversationId: string,
    templateId?: string,
    subject?: string,
    body?: string
  ): EmailConversationState {
    const state: EmailConversationState = {
      type: 'email',
      step: 'awaiting_employee_name',
      templateId,
      subject,
      body,
      variables: {},
      missingVariables: [],
      currentVariableIndex: 0,
    };

    this.states.set(conversationId, state);
    return state;
  }

  /**
   * Initialize calendar conversation
   */
  startCalendarConversation(
    conversationId: string,
    topic?: string
  ): CalendarConversationState {
    const state: CalendarConversationState = {
      type: 'calendar',
      step: 'fetching_availability',
      topic,
    };

    this.states.set(conversationId, state);
    return state;
  }

  /**
   * Get current conversation state
   */
  getState(conversationId: string): ConversationState {
    return this.states.get(conversationId) || null;
  }

  /**
   * Update conversation state
   */
  updateState(conversationId: string, updates: Partial<ConversationState>): void {
    const currentState = this.states.get(conversationId);
    if (currentState) {
      this.states.set(conversationId, { ...currentState, ...updates } as ConversationState);
    }
  }

  /**
   * Update email state
   */
  updateEmailState(
    conversationId: string,
    updates: Partial<EmailConversationState>
  ): void {
    const currentState = this.states.get(conversationId);
    if (currentState && currentState.type === 'email') {
      this.states.set(conversationId, { ...currentState, ...updates });
    }
  }

  /**
   * Update calendar state
   */
  updateCalendarState(
    conversationId: string,
    updates: Partial<CalendarConversationState>
  ): void {
    const currentState = this.states.get(conversationId);
    if (currentState && currentState.type === 'calendar') {
      this.states.set(conversationId, { ...currentState, ...updates });
    }
  }

  /**
   * Clear conversation state
   */
  clearState(conversationId: string): void {
    this.states.delete(conversationId);
  }

  /**
   * Check if conversation is active
   */
  isActive(conversationId: string): boolean {
    return this.states.has(conversationId);
  }

  /**
   * Get conversation type
   */
  getType(conversationId: string): ConversationType {
    const state = this.states.get(conversationId);
    return state?.type || 'none';
  }

  /**
   * Get next missing variable for email flow
   */
  getNextMissingVariable(state: EmailConversationState): string | null {
    if (state.currentVariableIndex < state.missingVariables.length) {
      return state.missingVariables[state.currentVariableIndex];
    }
    return null;
  }

  /**
   * Record variable value for email flow
   */
  recordVariable(
    conversationId: string,
    variableName: string,
    value: string
  ): void {
    const state = this.states.get(conversationId);
    if (state && state.type === 'email') {
      state.variables[variableName] = value;
      state.currentVariableIndex++;
      this.states.set(conversationId, state);
    }
  }

  /**
   * Check if all variables are collected
   */
  areAllVariablesCollected(state: EmailConversationState): boolean {
    return state.currentVariableIndex >= state.missingVariables.length;
  }

  /**
   * Format variable name for display
   */
  formatVariableName(variableName: string): string {
    // Convert snake_case to Title Case
    return variableName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Generate question for variable
   */
  generateVariableQuestion(variableName: string): string {
    const formatted = this.formatVariableName(variableName);

    const questionMap: Record<string, string> = {
      employee_name: "What is the employee's full name?",
      employee_email: "What is the employee's email address?",
      dates: "What are the specific dates or date range?",
      incident_date: "What date did the incident occur?",
      policy_reference: "What is the policy reference number or section?",
      warning_type: "What type of warning is this? (verbal, written, final)",
      violation_description: "Please describe the policy violation:",
      next_steps: "What are the next steps or expectations?",
      deadline: "What is the deadline for compliance?",
    };

    return questionMap[variableName] || `What is the ${formatted}?`;
  }

  /**
   * Clean up old states (optional, for memory management)
   */
  cleanupOldStates(_maxAgeMinutes: number = 60): void {
    // This is a simple implementation - in production, you'd want to track timestamps
    // For now, we keep all states in memory
    // TODO: Add timestamp tracking and cleanup logic
  }
}

// Export singleton instance
export const conversationStateManager = new ConversationStateManager();
