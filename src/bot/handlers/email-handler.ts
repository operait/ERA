/**
 * Email Handler for ERA Bot
 * Handles multi-turn conversation flow for email sending
 */

import { TurnContext, MessageFactory } from 'botbuilder';
import { emailComposer } from '../../services/email-composer';
import { conversationStateManager } from '../../services/conversation-state';
import type { EmailConversationState } from '../../services/conversation-state';

export class EmailHandler {
  /**
   * Detect if response recommends sending an email
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

    conversationStateManager.updateEmailState(conversationId, {
      recipientEmail: email,
    });

    // Check for missing variables in template
    const subject = state.subject || 'HR Notice';
    const body = state.body || '';
    const missingVariables = emailComposer.getMissingVariables(
      subject + '\n' + body,
      state.variables
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
    // Try to find email template in response
    // Look for patterns like "Subject: ..." and email body content

    const subjectMatch = response.match(/subject:\s*(.+)/i);
    const subject = subjectMatch ? subjectMatch[1].trim() : 'HR Notice';

    // Try to extract email body (content after "Dear" or email-like content)
    const bodyMatch = response.match(/Dear\s+.+?[\s\S]+?(?=\n\n(?:Best|Sincerely|Regards)|$)/i);

    if (bodyMatch) {
      return {
        subject,
        body: bodyMatch[0].trim(),
      };
    }

    // Fallback: use a generic template
    return {
      subject,
      body: `Dear {{employee_name}},\n\n${response}\n\nBest regards,\nManagement`,
    };
  }
}

export const emailHandler = new EmailHandler();
