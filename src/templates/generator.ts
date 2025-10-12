import { supabase } from '../lib/supabase';
import { SearchContext } from '../retrieval/search';
import { Template } from '../types/index';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface ResponseTemplate {
  id: string;
  scenario: string;
  template: string;
  placeholders: string[];
  category: string;
}

export interface GeneratedResponse {
  response: string;
  template_used?: ResponseTemplate;
  context_chunks: number;
  placeholders: Record<string, string>;
  confidence_score: number;
}

/**
 * Template-based response generator for HR scenarios
 */
export class ResponseGenerator {
  private templateCache: Map<string, ResponseTemplate[]> = new Map();
  private anthropic: Anthropic;
  private masterPrompt: string;

  constructor() {
    this.loadTemplates();
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    this.masterPrompt = this.loadMasterPrompt();
  }

  /**
   * Load master prompt from MASTER_PROMPT.md file
   */
  private loadMasterPrompt(): string {
    try {
      const promptPath = join(__dirname, '..', '..', 'MASTER_PROMPT.md');
      const fileContent = readFileSync(promptPath, 'utf-8');

      // Strip YAML frontmatter (lines between --- markers)
      const lines = fileContent.split('\n');
      let startIndex = 0;
      let inFrontmatter = false;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '---') {
          if (!inFrontmatter) {
            inFrontmatter = true;
            startIndex = i + 1;
          } else {
            // Found closing ---, content starts after this
            startIndex = i + 1;
            break;
          }
        }
      }

      const promptContent = lines.slice(startIndex).join('\n').trim();
      console.log('✅ Loaded master prompt from MASTER_PROMPT.md');
      return promptContent;
    } catch (error) {
      console.warn('⚠️ Failed to load MASTER_PROMPT.md, using fallback prompt:', error);
      // Fallback to basic prompt if file can't be read
      return `You are ERA, an AI HR assistant for Fitness Connection managers. Your role is to help managers navigate HR policies and procedures with clear, conversational, and actionable guidance.

TONE AND STYLE:
- Be warm, professional, and supportive
- Use conversational language (e.g., "Hi! Based on your question...")
- Break down complex policies into clear steps
- Be specific and actionable
- Remember context from previous messages in the conversation

RESPONSE FORMAT:
1. Start with a friendly acknowledgment of their question
2. Provide clear, step-by-step guidance based on the policy documents
3. Use bullet points or numbered lists for clarity
4. Include relevant policy excerpts when helpful
5. End with next steps or offer to help further

IMPORTANT:
- Only provide information based on the policy documents provided
- If the policy requires HR consultation, explicitly state that
- For disciplinary actions, always emphasize documentation
- Be empathetic to both manager and employee perspectives
- If this is a follow-up question, reference the previous conversation naturally`;
    }
  }

  /**
   * Generate a response using Claude AI and search context
   */
  async generateResponse(
    query: string,
    searchContext: SearchContext,
    scenario?: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    managerFirstName?: string
  ): Promise<GeneratedResponse> {
    try {
      // Use Claude to generate a conversational response
      const response = await this.generateClaudeResponse(query, searchContext, conversationHistory, managerFirstName);

      return {
        response,
        template_used: undefined,
        context_chunks: searchContext.results.length,
        placeholders: {},
        confidence_score: searchContext.avgSimilarity
      };
    } catch (error) {
      console.error('Error generating response:', error);
      // Fallback to basic response if Claude fails
      const contextSummary = this.summarizeContext(searchContext);
      return {
        response: this.generateBasicResponse(query, contextSummary),
        template_used: undefined,
        context_chunks: searchContext.results.length,
        placeholders: {},
        confidence_score: 0.5
      };
    }
  }

  /**
   * Check if clarification is needed using keyword detection
   */
  private needsClarification(
    query: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  ): boolean {
    // Skip clarification check if this is a follow-up (ERA already asked a question)
    if (conversationHistory && conversationHistory.length > 1) {
      const lastAssistantMessage = conversationHistory.slice(-2, -1)[0]?.content || '';
      if (lastAssistantMessage.includes('?')) {
        return false; // This is a follow-up answer, don't ask another question
      }
    }

    // DISABLE keyword-based clarification entirely - let Claude's master prompt handle this
    // The master prompt already has sophisticated clarification logic built in
    // Having two layers of clarification causes ERA to ask questions when it shouldn't
    console.log('⏭️ Skipping keyword-based clarification check - deferring to Claude master prompt');
    return false;

    /* REMOVED: Keyword-based clarification that conflicted with master prompt
    // Check if query mentions contact attempts
    const contactKeywords = ['called', 'contacted', 'reached out', 'spoke to', 'talked to', 'emailed', 'texted', 'tried to reach', 'left a message', 'sent'];
    const hasContactInfo = contactKeywords.some(keyword => query.toLowerCase().includes(keyword));

    // Check if query is about attendance/no-show issues
    const attendanceKeywords = ['missed', 'no show', 'no-show', 'didn\'t show', 'hasn\'t shown', 'absent', 'didn\'t come', 'not showing'];
    const isAttendanceIssue = attendanceKeywords.some(keyword => query.toLowerCase().includes(keyword));

    // If it's an attendance issue without contact info, clarification is needed
    return isAttendanceIssue && !hasContactInfo;
    */
  }

  /**
   * Generate conversational response using Claude
   */
  private async generateClaudeResponse(
    query: string,
    searchContext: SearchContext,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    managerFirstName?: string
  ): Promise<string> {
    // CRITICAL: Check if we need clarification BEFORE generating response
    if (this.needsClarification(query, conversationHistory)) {
      // Force a clarifying question without consulting Claude
      const name = managerFirstName ? `, ${managerFirstName}` : '';
      return `Got it${name} — three consecutive no-shows is definitely something we need to address right away.\n\nJust to confirm — have you already tried reaching out to the employee at all, or is this the first time you're taking action on the missed shifts?`;
    }

    // Prepare context from search results
    const contextText = searchContext.results
      .map((result, index) => {
        return `Source ${index + 1}: ${result.document_title}\n${result.chunk_text}\n`;
      })
      .join('\n---\n\n');

    // Use the loaded master prompt from MASTER_PROMPT.md
    const systemPrompt = this.masterPrompt;

    // Build messages array with conversation history
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    // Add conversation history (excluding the current query which is already in history)
    if (conversationHistory && conversationHistory.length > 1) {
      // Get history excluding the last user message (which is the current query)
      const previousMessages = conversationHistory.slice(0, -1);
      messages.push(...previousMessages);
    }

    // Build manager name context
    const nameContext = managerFirstName ? `The manager's name is ${managerFirstName}. Address them by their first name naturally in your response (e.g., "Thanks for reaching out, ${managerFirstName}").` : '';

    // Check if the last assistant message was asking a question
    const lastAssistantMessage = conversationHistory && conversationHistory.length > 1
      ? conversationHistory.slice(-2, -1)[0]?.content || ''
      : '';
    const askedQuestion = lastAssistantMessage.includes('?') && conversationHistory && conversationHistory.length > 1;

    // Add current query with policy context
    const currentPrompt = askedQuestion
      ? `${nameContext}\n\n🚨🚨🚨 THIS IS A FOLLOW-UP - THE MANAGER IS ANSWERING YOUR QUESTION 🚨🚨🚨

DO NOT TREAT "${query}" AS A NEW POLICY QUERY. IT IS AN ANSWER TO YOUR QUESTION.

**ORIGINAL MANAGER QUESTION:** "${conversationHistory.find(m => m.role === 'user')?.content}"

**YOUR LAST MESSAGE (you asked a clarifying question):**
${conversationHistory.slice(-2, -1)[0]?.content}

**MANAGER'S RESPONSE (answering YOUR question):** "${query}"

Relevant policy documents for the ORIGINAL question:\n\n${contextText}

🚨 MANDATORY INSTRUCTIONS - THIS IS NOT A NEW QUERY:

1. The manager's response "${query}" is their ANSWER to the clarifying question YOU asked
2. They are NOT asking a new question about "${query}"
3. You now have the context you needed for their ORIGINAL question: "${conversationHistory.find(m => m.role === 'user')?.content}"

**YOU MUST NOW:**
   - Acknowledge their answer: "Got it${managerFirstName ? ', ' + managerFirstName : ''} — since this is the first time..."
   - Immediately provide the COMPLETE step-by-step guidance for handling their ORIGINAL situation (the employee who missed 3 shifts)
   - Use the policy documents above
   - Include "Immediate Steps:" section with numbered action items
   - Include voicemail template, email guidance, and documentation notes

**DO NOT:**
   - Say "I couldn't find policy information about '${query}'"
   - Treat "${query}" as a new policy question
   - Ask them to rephrase

This is a continuation of your conversation - answer their ORIGINAL question now that you have the context.`
      : `${nameContext}\n\n🚨 INTERNAL ASSESSMENT (DO NOT SHOW THIS SECTION TO THE MANAGER) 🚨

Manager's question: "${query}"

**EVALUATE SILENTLY - DO NOT INCLUDE THIS CHECKLIST IN YOUR RESPONSE:**

1. Does their question explicitly state whether they've already contacted the employee? (YES/NO)
2. Do they mention what the employee said in response? (YES/NO)
3. Do they provide timeline details (consecutive? specific dates?)? (YES/NO)

**YOUR ACTUAL RESPONSE TO THE MANAGER:**

⚠️ IF YOU ANSWERED "NO" TO ANY QUESTION:
   - Do NOT show the checklist or your reasoning
   - Do NOT explain which questions you answered NO to
   - Simply provide: Brief acknowledgment + ONE clarifying question + STOP
   - Example: "Got it${managerFirstName ? ', ' + managerFirstName : ''} — three no-call/no-shows is definitely something we need to address right away. Just to confirm — have you already tried reaching out to [employee] at all, or is this the first time you're taking action?"

✅ IF YOU ANSWERED "YES" TO ALL THREE:
   - Provide complete step-by-step guidance using the policy documents below

---

Relevant policy documents:\n\n${contextText}

---

**FORMATTING RULES:**

❌ IF MISSING ANY DETAIL ABOVE → YOU MUST:

   Your response structure MUST be:
   1. Brief acknowledgment${managerFirstName ? ' using their name (' + managerFirstName + ')' : ''}: "Got it${managerFirstName ? ', ' + managerFirstName : ''} — [acknowledge situation]."
   2. ONE clarifying question: "Just to confirm — have you already tried reaching out to [employee] at all, or is this the first time you're taking action?"
   3. STOP. Do not write ANYTHING else.

   ⛔ FORBIDDEN when context is unclear:
   - Do NOT write "Immediate Steps:"
   - Do NOT write "Here's what you need to do:"
   - Do NOT write "Based on our policy:"
   - Do NOT give numbered action steps
   - Do NOT provide voicemail templates or guidance yet

✅ IF ALL DETAILS ARE CLEAR → Provide complete step-by-step guidance

**EXAMPLE RESPONSES:**

❌ WRONG (context unclear):
"Got it, Operit — three no-call/no-shows is definitely something we need to address right away.

**Immediate Steps:**
1. Call John first — check in and ask what caused him to miss those shifts..."

✅ CORRECT (context unclear):
"Got it, Operit — three no-call/no-shows is definitely something we need to address right away.

Just to confirm — have you already tried reaching out to John at all, or is this the first time you're taking action on the missed shifts?"

Remember: Think WITH managers, not FOR them. When in doubt, ASK FIRST.`;

    messages.push({
      role: 'user',
      content: currentPrompt
    });

    // Add critical clarification instruction at the TOP of system prompt for initial queries
    const enhancedSystemPrompt = !askedQuestion
      ? `🚨 CRITICAL RULES - READ FIRST BEFORE ANYTHING ELSE:

1. **CHECK FOR LOGICAL INCONSISTENCIES:** If the manager's question doesn't make sense (e.g., "my employee show up for 3 days" when asking for help - showing up is good!), assume they made a typo or phrasing error. Ask for clarification: "Just to clarify — did you mean your employee **didn't** show up, or did they show up and there's something else you need help with?"

2. **CHECK FOR MISSING CONTEXT:** If the question does NOT explicitly state whether they've already contacted the employee, you MUST ask a clarifying question ONLY and provide NO steps or guidance yet.

Examples:
- MISSING contact info: "My employee missed 3 shifts and I'm not sure what to do" (unclear if they contacted employee)
- CLEAR contact info: "I called my employee about missed shifts but they haven't responded" (clear they contacted)
- LOGICAL ISSUE: "My employee show up for 3 days in a row" (doesn't make sense - why ask for help if employee showed up?)

When context is missing OR question doesn't make logical sense: Acknowledge + Ask clarifying question + STOP (no steps, no templates, no guidance)

---

${systemPrompt}`
      : systemPrompt;

    const message = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: enhancedSystemPrompt,
      messages
    });

    const responseText = message.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as { text: string }).text)
      .join('\n');

    return responseText;
  }

  /**
   * Load templates from database
   */
  private async loadTemplates(): Promise<void> {
    try {
      const { data: templates, error } = await supabase
        .from('templates')
        .select('*')
        .order('category');

      if (error) {
        console.error('Error loading templates:', error);
        return;
      }

      // Group templates by category
      const grouped = (templates || []).reduce((acc, template) => {
        const category = template.category;
        if (!acc.has(category)) {
          acc.set(category, []);
        }
        acc.get(category)!.push({
          id: template.id,
          scenario: template.scenario,
          template: template.template_text,
          placeholders: template.placeholders || [],
          category: template.category
        });
        return acc;
      }, new Map<string, ResponseTemplate[]>());

      this.templateCache = grouped;
      console.log(`Loaded ${templates?.length || 0} templates across ${grouped.size} categories`);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  }

  /**
   * Find the best matching template for a query
   */
  private async findBestTemplate(
    query: string,
    scenario?: string,
    categories: string[] = []
  ): Promise<ResponseTemplate | null> {
    // Refresh templates if cache is empty
    if (this.templateCache.size === 0) {
      await this.loadTemplates();
    }

    const queryLower = query.toLowerCase();
    let bestTemplate: ResponseTemplate | null = null;
    let bestScore = 0;

    // Check templates in relevant categories first
    const categoriesToCheck = categories.length > 0 ? categories : Array.from(this.templateCache.keys());

    for (const category of categoriesToCheck) {
      const templates = this.templateCache.get(category) || [];

      for (const template of templates) {
        const score = this.calculateTemplateMatch(queryLower, template, scenario);
        if (score > bestScore) {
          bestScore = score;
          bestTemplate = template;
        }
      }
    }

    // Only return template if score meets threshold
    return bestScore > 0.3 ? bestTemplate : null;
  }

  /**
   * Calculate how well a template matches the query
   */
  private calculateTemplateMatch(
    query: string,
    template: ResponseTemplate,
    scenario?: string
  ): number {
    let score = 0;

    // Check scenario match
    if (scenario && template.scenario.toLowerCase().includes(scenario.toLowerCase())) {
      score += 0.5;
    }

    // Check keyword matches
    const templateKeywords = template.scenario.toLowerCase().split(' ');
    const queryWords = query.split(' ');

    const matchingWords = queryWords.filter(word =>
      templateKeywords.some(keyword => keyword.includes(word) || word.includes(keyword))
    );

    score += (matchingWords.length / queryWords.length) * 0.5;

    return score;
  }

  /**
   * Summarize search context into key points
   */
  private summarizeContext(context: SearchContext): string {
    if (context.results.length === 0) {
      return 'No relevant policy information found.';
    }

    const chunks = context.results.slice(0, 3); // Use top 3 chunks
    const summary = chunks.map((chunk, index) => {
      return `${index + 1}. From "${chunk.document_title}": ${chunk.chunk_text.slice(0, 200)}...`;
    }).join('\n\n');

    return summary;
  }

  /**
   * Extract placeholders from query and context
   */
  private extractPlaceholders(query: string, context: string): Record<string, string> {
    const placeholders: Record<string, string> = {};

    // Common HR placeholders
    placeholders['EMPLOYEE_NAME'] = '[Employee Name]';
    placeholders['MANAGER_NAME'] = '[Manager Name]';
    placeholders['DATE'] = new Date().toLocaleDateString();
    placeholders['DEPARTMENT'] = '[Department]';
    placeholders['INCIDENT_DATE'] = '[Incident Date]';
    placeholders['POLICY_REFERENCE'] = '[Policy Section]';

    // Extract potential values from query
    const queryLower = query.toLowerCase();

    // Try to extract names (simple heuristic)
    const nameMatch = query.match(/employee\s+(\w+)/i);
    if (nameMatch) {
      placeholders['EMPLOYEE_NAME'] = nameMatch[1];
    }

    // Extract numbers (could be shift counts, days, etc.)
    const numberMatches = query.match(/(\d+)/g);
    if (numberMatches) {
      placeholders['NUMBER_OF_INCIDENTS'] = numberMatches[0];
      if (numberMatches.length > 1) {
        placeholders['TIME_PERIOD'] = numberMatches[1];
      }
    }

    return placeholders;
  }

  /**
   * Fill a template with placeholders and context
   */
  private fillTemplate(
    template: ResponseTemplate,
    placeholders: Record<string, string>,
    context: string
  ): string {
    let filledTemplate = template.template;

    // Replace placeholders
    Object.entries(placeholders).forEach(([key, value]) => {
      const placeholder = `[${key}]`;
      filledTemplate = filledTemplate.replace(new RegExp(placeholder, 'g'), value);
    });

    // Add context if template has a context placeholder
    if (filledTemplate.includes('[POLICY_CONTEXT]')) {
      filledTemplate = filledTemplate.replace('[POLICY_CONTEXT]', context);
    } else {
      // Append context at the end
      filledTemplate += '\n\n**Relevant Policy Information:**\n' + context;
    }

    return filledTemplate;
  }

  /**
   * Generate a basic response without a template
   */
  private generateBasicResponse(query: string, context: string): string {
    const intro = `Based on your question about "${query}", here's what I found in our policies:`;

    const response = `${intro}

${context}

**Next Steps:**
Please review the relevant policy sections above and consult with your HR representative if you need clarification or additional guidance.

**Need Help?**
If this doesn't fully address your question, please provide more specific details about the situation.`;

    return response;
  }

  /**
   * Add a new template to the database
   */
  async addTemplate(template: Omit<Template, 'id'>): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('templates')
        .insert({
          scenario: template.scenario,
          template_text: template.template_text,
          placeholders: template.placeholders,
          category: template.category
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Error adding template: ${error.message}`);
      }

      // Refresh cache
      await this.loadTemplates();

      return data.id;
    } catch (error) {
      console.error('Error adding template:', error);
      throw error;
    }
  }

  /**
   * Load default templates for common HR scenarios
   */
  async loadDefaultTemplates(): Promise<void> {
    const defaultTemplates = [
      {
        scenario: 'attendance issues multiple missed shifts',
        template_text: `**Attendance Policy Violation - Multiple Missed Shifts**

Dear [MANAGER_NAME],

Regarding [EMPLOYEE_NAME]'s attendance issue with [NUMBER_OF_INCIDENTS] missed shifts:

[POLICY_CONTEXT]

**Recommended Actions:**
1. Document the attendance pattern
2. Schedule a formal meeting with the employee
3. Issue appropriate disciplinary action per policy
4. Consider escalation if pattern continues

**Email Template:**
Subject: Attendance Concern - [EMPLOYEE_NAME]

[EMPLOYEE_NAME],

We need to discuss your recent attendance pattern showing [NUMBER_OF_INCIDENTS] missed shifts. Please schedule a meeting with me by [DATE] to address this matter.

Best regards,
[MANAGER_NAME]`,
        placeholders: ['MANAGER_NAME', 'EMPLOYEE_NAME', 'NUMBER_OF_INCIDENTS', 'DATE'],
        category: 'attendance'
      },
      {
        scenario: 'no call no show policy',
        template_text: `**No Call/No Show Policy Response**

[POLICY_CONTEXT]

**Immediate Actions Required:**
1. Document the incident with date and time
2. Attempt to contact the employee
3. Follow progressive disciplinary procedures
4. Complete incident report

**Template Email for Employee Contact:**
Subject: Urgent - Missed Shift on [INCIDENT_DATE]

[EMPLOYEE_NAME],

You were scheduled to work on [INCIDENT_DATE] but did not report to work or call in. This constitutes a no-call/no-show violation.

Please contact me immediately at [PHONE] to discuss this matter.

[MANAGER_NAME]`,
        placeholders: ['EMPLOYEE_NAME', 'INCIDENT_DATE', 'MANAGER_NAME', 'PHONE'],
        category: 'attendance'
      }
    ];

    for (const template of defaultTemplates) {
      try {
        await this.addTemplate(template);
        console.log(`Added template: ${template.scenario}`);
      } catch (error) {
        console.error(`Error adding template "${template.scenario}":`, error);
      }
    }
  }
}

// CLI for template management
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'load-defaults';

  const generator = new ResponseGenerator();

  switch (command) {
    case 'load-defaults':
      await generator.loadDefaultTemplates();
      console.log('Default templates loaded');
      break;

    default:
      console.log('Usage: tsx generator.ts [load-defaults]');
      console.log('Commands:');
      console.log('  load-defaults - Load default HR templates');
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}