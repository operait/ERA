/**
 * Prompt Optimizer Service
 *
 * Uses GPT-4 to optimize MASTER_PROMPT.md based on testing session feedback.
 */

import OpenAI from 'openai';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface OptimizationResult {
  updatedPrompt: string;
  summary: string;
}

export class PromptOptimizer {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  /**
   * Optimize MASTER_PROMPT.md using GPT-4
   */
  async optimize(sessionCSV: string): Promise<OptimizationResult> {
    // Read current MASTER_PROMPT.md
    const currentPrompt = this.loadMasterPrompt();

    // Call GPT-4 to optimize
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: 'You are an expert prompt engineer optimizing an AI assistant\'s master prompt based on real user feedback from testing sessions.'
      },
      {
        role: 'user',
        content: this.buildOptimizationPrompt(currentPrompt, sessionCSV)
      }
    ];

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages,
      temperature: 0.3, // Low temperature for consistency
      max_tokens: 4096
    });

    const optimizedPrompt = completion.choices[0].message.content || '';

    // Extract summary from the optimization (ask GPT-4 for a summary)
    const summary = await this.generateSummary(currentPrompt, optimizedPrompt, sessionCSV);

    return {
      updatedPrompt: optimizedPrompt,
      summary
    };
  }

  /**
   * Build the optimization prompt for GPT-4
   */
  private buildOptimizationPrompt(currentPrompt: string, sessionCSV: string): string {
    return `CURRENT MASTER_PROMPT.md:
\`\`\`markdown
${currentPrompt}
\`\`\`

TESTING SESSION DATA (CSV):
\`\`\`csv
${sessionCSV}
\`\`\`

TASK:
Analyze the "Improvement Notes" column in the CSV data and update MASTER_PROMPT.md to address the feedback patterns. Focus on:

1. **Tone improvements**: If feedback mentions "more empathetic", "warmer", "less formal" → enhance empathy guidelines and add examples
2. **Content improvements**: If feedback mentions "missing info", "incomplete" → add relevant sections or expand existing ones
3. **Clarity improvements**: If feedback mentions "confusing", "too technical" → simplify language and add clarification
4. **Structure improvements**: If feedback mentions "disorganized", "hard to follow" → improve formatting and organization

REQUIREMENTS:
- Preserve all existing sections and overall structure
- Make targeted, specific changes based on the feedback
- Increment the version number in the frontmatter (e.g., v3.1.3 → v3.2.0)
- Add a changelog entry in the frontmatter summarizing the key changes
- DO NOT add explanations or commentary - return ONLY the complete updated MASTER_PROMPT.md
- The output must start with the YAML frontmatter (---)

OUTPUT FORMAT:
Return the complete updated MASTER_PROMPT.md file, starting with:
---
version: [new version]
...`;
  }

  /**
   * Generate a summary of changes made
   */
  private async generateSummary(
    originalPrompt: string,
    optimizedPrompt: string,
    sessionCSV: string
  ): Promise<string> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'user',
        content: `Compare these two versions of MASTER_PROMPT.md and provide a brief summary (2-3 bullet points) of the key changes made based on the testing feedback.

ORIGINAL:
${originalPrompt.substring(0, 500)}...

UPDATED:
${optimizedPrompt.substring(0, 500)}...

FEEDBACK CSV:
${sessionCSV}

Provide a concise summary in this format:
- Changed X to improve Y
- Added Z to address feedback about W
- Updated A to be more B`
      }
    ];

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages,
      temperature: 0.3,
      max_tokens: 200
    });

    return completion.choices[0].message.content || 'Updated MASTER_PROMPT.md based on testing feedback';
  }

  /**
   * Load current MASTER_PROMPT.md from file system
   */
  private loadMasterPrompt(): string {
    try {
      const promptPath = join(__dirname, '..', '..', 'MASTER_PROMPT.md');
      return readFileSync(promptPath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to load MASTER_PROMPT.md: ${error}`);
    }
  }

  /**
   * Extract version from MASTER_PROMPT.md frontmatter
   */
  extractVersion(prompt: string): string {
    const versionMatch = prompt.match(/^version:\s*(.+)$/m);
    return versionMatch ? versionMatch[1] : 'unknown';
  }

  /**
   * Count improvements by category
   */
  countImprovementsByCategory(sessionCSV: string): Record<string, number> {
    const lines = sessionCSV.split('\n');
    const categoryIndex = 4; // Category is the 5th column (0-indexed)
    const counts: Record<string, number> = {};

    for (let i = 1; i < lines.length; i++) { // Skip header
      const line = lines[i];
      if (!line.trim()) continue;

      // Parse CSV (simple approach - assumes no commas in quoted fields for category)
      const parts = line.split(',');
      if (parts.length > categoryIndex) {
        const category = parts[categoryIndex].replace(/"/g, '').trim();
        if (category) {
          counts[category] = (counts[category] || 0) + 1;
        }
      }
    }

    return counts;
  }
}
