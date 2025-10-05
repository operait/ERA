import { supabase } from '../lib/supabase.js';
import { SearchContext } from '../retrieval/search.js';
import { Template } from '../types/index.js';

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

  constructor() {
    this.loadTemplates();
  }

  /**
   * Generate a response using templates and search context
   */
  async generateResponse(
    query: string,
    searchContext: SearchContext,
    scenario?: string
  ): Promise<GeneratedResponse> {
    try {
      // Find matching template
      const template = await this.findBestTemplate(query, scenario, searchContext.categories);

      // Extract key information from search results
      const contextSummary = this.summarizeContext(searchContext);

      // Generate placeholders
      const placeholders = this.extractPlaceholders(query, contextSummary);

      // Fill template or generate basic response
      let response: string;
      let confidence_score: number;

      if (template) {
        response = this.fillTemplate(template, placeholders, contextSummary);
        confidence_score = 0.9; // High confidence with template
      } else {
        response = this.generateBasicResponse(query, contextSummary);
        confidence_score = 0.6; // Lower confidence without template
      }

      return {
        response,
        template_used: template || undefined,
        context_chunks: searchContext.results.length,
        placeholders,
        confidence_score
      };
    } catch (error) {
      console.error('Error generating response:', error);
      throw error;
    }
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