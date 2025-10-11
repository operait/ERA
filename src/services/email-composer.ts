/**
 * Email Composer Service
 * Handles email template filling and sending via Microsoft Graph API
 */

import { graphClient } from '../lib/graph-client';
import { supabase } from '../lib/supabase';
import type { SendMailRequest, EmailAddress } from '../types/graph';

export interface EmailTemplate {
  id?: string;
  subject: string;
  body: string;
  variables: string[]; // e.g., ['employee_name', 'dates', 'policy_reference']
}

export interface EmailData {
  recipientEmail: string;
  recipientName?: string;
  templateId?: string;
  subject: string;
  body: string;
  variables: Record<string, string>;
}

export interface SendEmailResult {
  success: boolean;
  emailLogId?: string;
  error?: string;
}

class EmailComposerService {
  /**
   * Extract template variables from content
   * Looks for {{variable_name}} patterns
   */
  extractVariables(content: string): string[] {
    const regex = /\{\{(\w+)\}\}/g;
    const variables = new Set<string>();
    let match;

    while ((match = regex.exec(content)) !== null) {
      variables.add(match[1]);
    }

    return Array.from(variables);
  }

  /**
   * Fill template with provided variables
   */
  fillTemplate(template: string, variables: Record<string, string>): string {
    let filled = template;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      filled = filled.replace(regex, value);
    }

    return filled;
  }

  /**
   * Get missing variables from a template
   */
  getMissingVariables(content: string, providedVariables: Record<string, string>): string[] {
    const requiredVariables = this.extractVariables(content);
    const providedKeys = Object.keys(providedVariables);

    return requiredVariables.filter(variable => !providedKeys.includes(variable));
  }

  /**
   * Validate email address format
   */
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Format email for Microsoft Graph API
   */
  private formatEmailForGraph(emailData: EmailData): SendMailRequest {
    const toRecipients: EmailAddress[] = [
      {
        emailAddress: {
          address: emailData.recipientEmail,
          name: emailData.recipientName || emailData.recipientEmail,
        },
      },
    ];

    return {
      message: {
        subject: emailData.subject,
        body: {
          contentType: 'html',
          content: this.convertToHtml(emailData.body),
        },
        toRecipients,
      },
      saveToSentItems: true,
    };
  }

  /**
   * Convert plain text to simple HTML
   */
  private convertToHtml(text: string): string {
    // Convert newlines to <br> and wrap in basic HTML
    const htmlBody = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('<br><br>');

    return `
      <html>
        <body style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333;">
          ${htmlBody}
        </body>
      </html>
    `.trim();
  }

  /**
   * Send email via Microsoft Graph API
   */
  async sendEmail(
    managerId: string,
    managerEmail: string,
    emailData: EmailData
  ): Promise<SendEmailResult> {
    try {
      // Validate email address
      if (!this.validateEmail(emailData.recipientEmail)) {
        return {
          success: false,
          error: `Invalid email address: ${emailData.recipientEmail}`,
        };
      }

      // Fill template with variables
      const filledSubject = this.fillTemplate(emailData.subject, emailData.variables);
      const filledBody = this.fillTemplate(emailData.body, emailData.variables);

      // Check for missing variables
      const missingInSubject = this.getMissingVariables(filledSubject, emailData.variables);
      const missingInBody = this.getMissingVariables(filledBody, emailData.variables);
      const allMissing = [...new Set([...missingInSubject, ...missingInBody])];

      if (allMissing.length > 0) {
        return {
          success: false,
          error: `Missing required variables: ${allMissing.join(', ')}`,
        };
      }

      // Create email data with filled content
      const finalEmailData: EmailData = {
        ...emailData,
        subject: filledSubject,
        body: filledBody,
      };

      // Format for Graph API
      const graphEmail = this.formatEmailForGraph(finalEmailData);

      // Log email attempt
      const { data: emailLog, error: logError } = await supabase
        .from('email_logs')
        .insert({
          manager_id: managerId,
          manager_email: managerEmail,
          recipient_email: emailData.recipientEmail,
          recipient_name: emailData.recipientName,
          template_id: emailData.templateId,
          subject: filledSubject,
          body: filledBody,
          status: 'pending',
        })
        .select()
        .single();

      if (logError) {
        console.error('Error creating email log:', logError);
        return {
          success: false,
          error: 'Failed to create email log',
        };
      }

      // Send email via Graph API
      try {
        console.log(`Attempting to send email via Graph API as user: ${managerEmail}`);
        console.log(`Recipient: ${emailData.recipientEmail}`);
        console.log(`Subject: ${filledSubject}`);

        await graphClient.sendMail(managerEmail, graphEmail.message, true);

        console.log('Email sent successfully via Graph API');

        // Update log to sent
        await supabase
          .from('email_logs')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', emailLog.id);

        return {
          success: true,
          emailLogId: emailLog.id,
        };
      } catch (graphError: any) {
        console.error('Graph API error when sending email:', graphError);
        console.error('Error details:', {
          message: graphError.message,
          code: graphError.code,
          statusCode: graphError.statusCode,
          body: graphError.body,
        });

        // Update log to failed
        const errorMessage = graphError.message || graphError.body?.error?.message || 'Unknown error';
        await supabase
          .from('email_logs')
          .update({
            status: 'failed',
            error_message: errorMessage,
          })
          .eq('id', emailLog.id);

        return {
          success: false,
          error: `Failed to send email: ${errorMessage}`,
        };
      }
    } catch (error: any) {
      console.error('Error in sendEmail:', error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred',
      };
    }
  }

  /**
   * Get email template by ID
   */
  async getEmailTemplate(templateId: string): Promise<EmailTemplate | null> {
    try {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('id', templateId)
        .eq('template_type', 'email')
        .single();

      if (error || !data) {
        return null;
      }

      return {
        id: data.id,
        subject: data.email_subject || data.title,
        body: data.content,
        variables: this.extractVariables(data.content + (data.email_subject || '')),
      };
    } catch (error) {
      console.error('Error fetching email template:', error);
      return null;
    }
  }

  /**
   * Get recent sent emails for a manager
   */
  async getSentEmails(managerId: string, limit: number = 10) {
    try {
      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .eq('manager_id', managerId)
        .order('sent_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching sent emails:', error);
      return [];
    }
  }
}

// Export singleton instance
export const emailComposer = new EmailComposerService();
