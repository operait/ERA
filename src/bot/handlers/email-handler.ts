/**
 * Email Handler for ERA Bot
 * Handles multi-turn conversation flow for email sending
 */

import { TurnContext, MessageFactory } from 'botbuilder';
import { emailComposer } from '../../services/email-composer';
import { conversationStateManager } from '../../services/conversation-state';
import type { EmailConversationState, ConversationState } from '../../services/conversation-state';

export class EmailHandler {
  /**
   * Detect if response recommends sending an email
   * @deprecated Use detectEmailRecommendationWithContext for context-aware detection
   */
  detectEmailRecommendation(response: string): boolean {
    const emailKeywords = [
      'send an email',
      'email the employee',
      'written warning via email',
      'send a written',
      'email template',
      'follow up via email',
      'send them an email',
    ];

    const lowerResponse = response.toLowerCase();
    return emailKeywords.some(keyword => lowerResponse.includes(keyword));
  }

  /**
   * Context-aware email detection
   * Prevents premature triggers during clarification phase
   * Based on: specs/CONTEXT_AWARE_ACTIONS.md
   */
  detectEmailRecommendationWithContext(
    response: string,
    conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    conversationState: ConversationState | null
  ): boolean {
    // Step 1: State guard - don't trigger if already in email flow
    if (conversationState?.type === 'email') {
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
    return this.containsEmailKeywords(response);
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
      'what type',
      'which policy',
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
    // This avoids catching full sentences like "would you like me to draft an email warning?"
    if (lastSentence.trim().length < 50) {
      const confirmationPatterns = [
        /^.*draft it\?$/i,
        /^.*draft an email\?$/i,
        /^.*draft that\?$/i,
        /^.*send it\?$/i,
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
   * Check if response contains email action keywords
   */
  private containsEmailKeywords(response: string): boolean {
    const emailKeywords = [
      'send an email',
      'email the employee',
      'written warning via email',
      'send a written',
      'email template',
      'would you like me to draft',
      'i can draft',
      'draft an email',
    ];

    const lowerResponse = response.toLowerCase();
    return emailKeywords.some(keyword => lowerResponse.includes(keyword));
  }

  /**
   * Start email conversation flow
   */
  async startEmailFlow(
    context: TurnContext,
    conversationId: string,
    subject?: string,
    body?: string
  ): Promise<void> {
    conversationStateManager.startEmailConversation(conversationId, undefined, subject, body);

    await context.sendActivity(MessageFactory.text(
      "I can help you send that email. First, what is the employee's full name?"
    ));
  }

  /**
   * Handle email conversation step
   */
  async handleEmailStep(
    context: TurnContext,
    conversationId: string,
    userInput: string,
    managerEmail: string,
    managerId: string,
    firstName: string
  ): Promise<boolean> {
    const state = conversationStateManager.getState(conversationId) as EmailConversationState;

    if (!state || state.type !== 'email') {
      return false;
    }

    switch (state.step) {
      case 'awaiting_employee_name':
        return await this.handleEmployeeName(context, conversationId, userInput, state);

      case 'awaiting_employee_email':
        return await this.handleEmployeeEmail(context, conversationId, userInput, state);

      case 'awaiting_variables':
        return await this.handleVariableCollection(context, conversationId, userInput, state);

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
   * Handle employee name input
   */
  private async handleEmployeeName(
    context: TurnContext,
    conversationId: string,
    employeeName: string,
    state: EmailConversationState
  ): Promise<boolean> {
    conversationStateManager.updateEmailState(conversationId, {
      recipientName: employeeName.trim(),
      step: 'awaiting_employee_email',
    });

    await context.sendActivity(MessageFactory.text(
      `What is ${employeeName.trim()}'s email address?`
    ));

    return true;
  }

  /**
   * Handle employee email input
   */
  private async handleEmployeeEmail(
    context: TurnContext,
    conversationId: string,
    employeeEmail: string,
    state: EmailConversationState
  ): Promise<boolean> {
    const email = employeeEmail.trim();

    // Validate email format
    if (!emailComposer.validateEmail(email)) {
      await context.sendActivity(MessageFactory.text(
        `"${email}" doesn't look like a valid email address. Please provide a valid email address.`
      ));
      return true;
    }

    // Get manager name from context
    const managerName = context.activity.from?.name || 'Manager';
    const managerFirstName = managerName.split(' ')[0];

    // Update state with email and pre-fill known variables
    const knownVariables: Record<string, string> = {
      ...state.variables,
      // Auto-fill employee name/email variables from already collected data
      'employee_name': state.recipientName || '',
      'EMPLOYEE_NAME': state.recipientName || '',
      'employee_email': email,
      'EMPLOYEE_EMAIL': email,
      // Auto-fill manager information
      'manager_name': managerName,
      'MANAGER_NAME': managerName,
      'your_name': managerName,
      // Other common fields
      'today': new Date().toLocaleDateString(),
      'current_date': new Date().toLocaleDateString(),
    };

    // Convert [Bracket] style variables to {{bracket}} style
    let normalizedSubject = this.normalizeBracketVariables(state.subject || '');
    let normalizedBody = this.normalizeBracketVariables(state.body || '');

    conversationStateManager.updateEmailState(conversationId, {
      recipientEmail: email,
      variables: knownVariables,
      subject: normalizedSubject,
      body: normalizedBody,
    });

    // Check for missing variables in template
    const missingVariables = emailComposer.getMissingVariables(
      normalizedSubject + '\n' + normalizedBody,
      knownVariables
    );

    if (missingVariables.length > 0) {
      // Need to collect variables
      conversationStateManager.updateEmailState(conversationId, {
        missingVariables,
        currentVariableIndex: 0,
        step: 'awaiting_variables',
      });

      const firstVariable = missingVariables[0];
      const question = conversationStateManager.generateVariableQuestion(firstVariable);

      await context.sendActivity(MessageFactory.text(question));
    } else {
      // No variables needed, show preview
      await this.showEmailPreview(context, conversationId, state);
    }

    return true;
  }

  /**
   * Convert [Variable Name] format to {{variable_name}} format
   */
  private normalizeBracketVariables(text: string): string {
    return text.replace(/\[([^\]]+)\]/g, (match, varName) => {
      // Convert to lowercase and replace spaces with underscores
      const normalized = varName.toLowerCase().replace(/\s+/g, '_');
      return `{{${normalized}}}`;
    });
  }

  /**
   * Handle variable collection
   */
  private async handleVariableCollection(
    context: TurnContext,
    conversationId: string,
    userInput: string,
    state: EmailConversationState
  ): Promise<boolean> {
    const currentVariable = conversationStateManager.getNextMissingVariable(state);

    if (!currentVariable) {
      // All variables collected, show preview
      await this.showEmailPreview(context, conversationId, state);
      return true;
    }

    // Record variable value
    conversationStateManager.recordVariable(conversationId, currentVariable, userInput.trim());

    // Check if more variables needed
    const updatedState = conversationStateManager.getState(conversationId) as EmailConversationState;
    const nextVariable = conversationStateManager.getNextMissingVariable(updatedState);

    if (nextVariable) {
      // Ask for next variable
      const question = conversationStateManager.generateVariableQuestion(nextVariable);
      await context.sendActivity(MessageFactory.text(question));
    } else {
      // All variables collected, show preview
      await this.showEmailPreview(context, conversationId, updatedState);
    }

    return true;
  }

  /**
   * Show email preview and ask for confirmation
   */
  private async showEmailPreview(
    context: TurnContext,
    conversationId: string,
    state: EmailConversationState
  ): Promise<void> {
    const subject = emailComposer.fillTemplate(state.subject || '', state.variables);
    const body = emailComposer.fillTemplate(state.body || '', state.variables);

    const preview = `
📧 **Email Preview**

**To:** ${state.recipientName} <${state.recipientEmail}>
**Subject:** ${subject}

**Message:**
${body}

---
Would you like me to send this email? (Reply "yes" to send, or "no" to cancel)
`;

    conversationStateManager.updateEmailState(conversationId, {
      step: 'awaiting_confirmation',
    });

    await context.sendActivity(MessageFactory.text(preview));
  }

  /**
   * Handle send confirmation
   */
  private async handleConfirmation(
    context: TurnContext,
    conversationId: string,
    userInput: string,
    managerEmail: string,
    managerId: string,
    firstName: string,
    state: EmailConversationState
  ): Promise<boolean> {
    const input = userInput.toLowerCase().trim();

    if (input === 'yes' || input === 'y' || input === 'send' || input === 'send it') {
      // Send the email
      await context.sendActivity(MessageFactory.text('📤 Sending email...'));

      const result = await emailComposer.sendEmail(managerId, managerEmail, {
        recipientEmail: state.recipientEmail!,
        recipientName: state.recipientName,
        templateId: state.templateId,
        subject: state.subject!,
        body: state.body!,
        variables: state.variables,
      });

      if (result.success) {
        await context.sendActivity(MessageFactory.text(
          `✅ Email sent successfully to ${state.recipientEmail}!\n\nIs there anything else I can help you with${firstName !== 'there' ? ', ' + firstName : ''}?`
        ));
      } else {
        await context.sendActivity(MessageFactory.text(
          `❌ Failed to send email: ${result.error}\n\nPlease try again or contact IT support if the issue persists.`
        ));
      }

      // Clear conversation state
      conversationStateManager.clearState(conversationId);
      return true;
    } else if (input === 'no' || input === 'n' || input === 'cancel') {
      await context.sendActivity(MessageFactory.text(
        `Email cancelled. Is there anything else I can help you with${firstName !== 'there' ? ', ' + firstName : ''}?`
      ));

      // Clear conversation state
      conversationStateManager.clearState(conversationId);
      return true;
    } else {
      await context.sendActivity(MessageFactory.text(
        'Please reply "yes" to send the email or "no" to cancel.'
      ));
      return true;
    }
  }

  /**
   * Extract email template from Claude response
   */
  extractEmailTemplate(response: string): { subject: string; body: string } | null {
    // Remove internal guidance sections (anything between ** markers that's not part of email)
    let cleaned = response;

    // Remove documentation tips, coaching notes, and other internal guidance
    const internalSections = [
      /\*\*Documentation Tips:\*\*[\s\S]*?(?=\n\n(?:[A-Z]|$))/gi,
      /\*\*Coaching Notes:\*\*[\s\S]*?(?=\n\n(?:[A-Z]|$))/gi,
      /\*\*Next Steps:\*\*[\s\S]*?(?=\n\n(?:[A-Z]|$))/gi,
      /\*\*Important:\*\*[\s\S]*?(?=\n\n(?:[A-Z]|$))/gi,
      /\*\*Caution:\*\*[\s\S]*?(?=\n\n(?:[A-Z]|$))/gi,
      /⚠️[\s\S]*?(?=\n\n(?:[A-Z]|$))/gi,
      /🚩[\s\S]*?(?=\n\n(?:[A-Z]|$))/gi,
    ];

    for (const pattern of internalSections) {
      cleaned = cleaned.replace(pattern, '');
    }

    // Extract subject line - look for explicit "Subject:" or "**Subject Line:**" markers
    let subject = 'HR Notice';
    const subjectPatterns = [
      /\*\*Subject Line:\*\*\s*(.+?)(?:\n|$)/i,
      /\*\*Subject:\*\*\s*(.+?)(?:\n|$)/i,
      /Subject:\s*(.+?)(?:\n|$)/i,
    ];

    for (const pattern of subjectPatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        subject = match[1].trim();
        // Remove the subject line from the body
        cleaned = cleaned.replace(match[0], '').trim();
        break;
      }
    }

    // Extract body - look for the actual email content
    // Start from "Hi [" or "Dear [" and end at signature
    const bodyPattern = /((?:Hi|Dear)\s+\[[\s\S]+?(?:Best regards|Sincerely|Thank you)[^\n]*)/i;
    const bodyMatch = cleaned.match(bodyPattern);

    if (bodyMatch) {
      return {
        subject,
        body: bodyMatch[1].trim(),
      };
    }

    // Fallback: if we can't find a clear email body, return null
    // This will prevent malformed emails from being sent
    console.warn('Could not extract proper email template from response');
    return null;
  }
}

export const emailHandler = new EmailHandler();
