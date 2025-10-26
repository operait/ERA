# LLM Prompt Optimizer Script Specification

**Version:** 1.0
**Purpose:** Define the script that Meg runs in Claude Web Code to optimize MASTER_PROMPT.md based on testing feedback.

---

## Overview

This script analyzes Meg's testing session data (from CSV export) and automatically suggests improvements to the MASTER_PROMPT.md file. The workflow is:

1. **Meg exports testing session** using `!print` command in Teams
2. **Meg copies CSV** and pastes it into Claude Web Code
3. **Claude Web Code runs this script** to analyze the CSV
4. **Script generates updated MASTER_PROMPT.md** with improvements
5. **Meg reviews changes** and pushes to `prompt-tuning` branch

This script is designed to be **run entirely in Claude Web Code** without requiring Meg to use a terminal or code editor.

---

## User Story

**As Meg**, I want to paste my testing CSV into Claude Web Code and get an updated MASTER_PROMPT.md via a Pull Request, so that I can iteratively improve ERA's responses based on real testing feedback.

**Acceptance Criteria:**
- Paste CSV into Claude Web Code chat
- Run `/optimize` command
- Script analyzes feedback and generates updated MASTER_PROMPT.md
- **Claude Web Code creates a GitHub PR** with the changes (using its native integration)
- See a summary of what changed and why in the PR description
- Can review changes in GitHub's PR UI before merging
- Can merge PR with one click

---

## Script Location

**Path:** `scripts/optimize-prompt.ts`

**Execution:** Via Claude Web Code (not terminal)

**Dependencies:**
- Node.js (via Claude Web Code runtime)
- TypeScript
- OpenAI or Anthropic API (for LLM analysis)

---

## Script Interface

### Input: CSV Data

**Format:** CSV string (from `!print` command)

**Example:**
```csv
Turn,User Message,ERA Response,Improvement Notes,Category,Timestamp
1,"My employee didn't show up for 3 days","Got it — that's definitely something we need to address right away...","Should ask clarifying questions first","content","2025-10-24 10:00:00"
1,"My employee didn't show up for 3 days","Got it — that's definitely something we need to address right away...","Too formal, should be more conversational","tone","2025-10-24 10:00:15"
2,"I called once today","Thanks for the context. Since you've already made one attempt...","Good response, no changes needed","","2025-10-24 10:01:00"
```

### Output: Updated MASTER_PROMPT.md

**Format:** Full MASTER_PROMPT.md content with improvements

**Includes:**
- Updated prompt text
- Version bump (e.g., v3.1.3 → v3.1.4)
- Changelog entry explaining changes

---

## Analysis Process

### Step 1: Parse CSV Data

**Extract:**
- All improvement notes
- Categories (tone, content, citation, etc.)
- User messages and ERA responses

**Group by category:**
```
Content improvements: [
  "Should ask clarifying questions first",
  "Missing policy citation"
]

Tone improvements: [
  "Too formal, should be more conversational",
  "Not empathetic enough"
]
```

### Step 2: Identify Patterns

**Look for recurring themes:**
- Are multiple improvements about the same issue? (e.g., "too formal" appears 5 times)
- Are improvements contradicting each other? (e.g., "too casual" vs. "too formal")
- Are improvements scenario-specific? (e.g., only for attendance issues)

**Example pattern detection:**
```
Pattern found: "Should ask clarifying questions first" (3 occurrences)
→ Suggests: Strengthen the clarification protocol priority
```

### Step 3: Generate Prompt Improvements

**Use LLM (Claude) to:**
1. Read current MASTER_PROMPT.md
2. Analyze improvement patterns
3. Suggest specific changes to prompt sections
4. Explain the reasoning for each change

**Example LLM prompt:**
```
You are a prompt engineering expert analyzing feedback on an AI HR assistant's responses.

Current MASTER_PROMPT.md:
"""
[full current prompt]
"""

Testing feedback (grouped by category):

CONTENT improvements:
- "Should ask clarifying questions first" (3 times)
- "Missing policy citation" (2 times)

TONE improvements:
- "Too formal, should be more conversational" (5 times)
- "Not empathetic enough" (2 times)

Based on this feedback, suggest specific improvements to MASTER_PROMPT.md. For each suggestion:
1. Quote the section to be changed
2. Provide the updated text
3. Explain why this addresses the feedback

Focus on systemic improvements that fix recurring issues, not one-off tweaks.
```

### Step 4: Apply Changes to MASTER_PROMPT.md

**Modifications:**
1. Update the prompt text based on suggestions
2. Increment version number
3. Add changelog entry
4. Preserve all existing structure (YAML frontmatter, sections, etc.)

**Example changelog entry:**
```yaml
changelog: >
  v3.1.4: Strengthened clarification protocol priority and added more conversational
  tone guidelines. Based on 12 testing turns with 18 improvements (5 about tone, 3 about
  clarification). Key changes: Added "ALWAYS" emphasis to clarification priority, added
  examples of conversational vs formal phrasing.
```

---

## Script Implementation

### Structure

```typescript
// scripts/optimize-prompt.ts

import * as fs from 'fs';
import * as path from 'path';
import Anthropic from '@anthropic-ai/sdk';

interface CSVRow {
  turn: number;
  userMessage: string;
  eraResponse: string;
  improvementNote: string;
  category: string;
  timestamp: string;
}

interface ImprovementPattern {
  category: string;
  notes: string[];
  count: number;
  relatedTurns: number[];
}

interface PromptChange {
  section: string;
  oldText: string;
  newText: string;
  reason: string;
}

class PromptOptimizer {
  private anthropic: Anthropic;
  private masterPromptPath: string;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    this.masterPromptPath = path.join(__dirname, '..', 'MASTER_PROMPT.md');
  }

  // Parse CSV string into structured data
  parseCSV(csvText: string): CSVRow[] {
    // Parse CSV into rows
    // Handle quoted fields, newlines, etc.
  }

  // Identify improvement patterns
  identifyPatterns(rows: CSVRow[]): ImprovementPattern[] {
    // Group improvements by category
    // Count occurrences
    // Detect recurring themes
  }

  // Use Claude to analyze patterns and suggest changes
  async analyzeAndSuggest(
    currentPrompt: string,
    patterns: ImprovementPattern[]
  ): Promise<PromptChange[]> {
    // Call Claude API with current prompt + patterns
    // Get suggested changes
  }

  // Apply changes to MASTER_PROMPT.md
  applyChanges(
    currentPrompt: string,
    changes: PromptChange[],
    metadata: { version: string; changelogEntry: string }
  ): string {
    // Update prompt text
    // Increment version
    // Add changelog
    // Return new prompt
  }

  // Main optimization workflow
  async optimize(csvText: string): Promise<{
    updatedPrompt: string;
    changes: PromptChange[];
    summary: string;
  }> {
    // 1. Parse CSV
    const rows = this.parseCSV(csvText);

    // 2. Identify patterns
    const patterns = this.identifyPatterns(rows);

    // 3. Load current prompt
    const currentPrompt = fs.readFileSync(this.masterPromptPath, 'utf-8');

    // 4. Analyze and suggest changes
    const changes = await this.analyzeAndSuggest(currentPrompt, patterns);

    // 5. Apply changes
    const updatedPrompt = this.applyChanges(currentPrompt, changes, {
      version: this.incrementVersion(currentPrompt),
      changelogEntry: this.generateChangelog(patterns, changes)
    });

    // 6. Generate summary
    const summary = this.generateSummary(rows, patterns, changes);

    return { updatedPrompt, changes, summary };
  }

  // Helper: Increment version (e.g., v3.1.3 → v3.1.4)
  private incrementVersion(prompt: string): string {
    const match = prompt.match(/version:\s*v?(\d+)\.(\d+)\.(\d+)/i);
    if (!match) return 'v1.0.1';

    const [_, major, minor, patch] = match;
    return `v${major}.${minor}.${parseInt(patch) + 1}`;
  }

  // Helper: Generate changelog entry
  private generateChangelog(
    patterns: ImprovementPattern[],
    changes: PromptChange[]
  ): string {
    // Summarize what changed and why
  }

  // Helper: Generate human-readable summary
  private generateSummary(
    rows: CSVRow[],
    patterns: ImprovementPattern[],
    changes: PromptChange[]
  ): string {
    // Create markdown summary for Meg
  }
}

// CLI interface (for Claude Web Code)
async function main() {
  const csvText = process.argv[2] || '';

  if (!csvText) {
    console.error('Usage: tsx optimize-prompt.ts <csv-text>');
    console.error('Or paste CSV when prompted.');
    process.exit(1);
  }

  const optimizer = new PromptOptimizer();
  const result = await optimizer.optimize(csvText);

  // Write updated prompt to file
  fs.writeFileSync(
    path.join(__dirname, '..', 'MASTER_PROMPT.md'),
    result.updatedPrompt
  );

  // Show summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎯 PROMPT OPTIMIZATION COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(result.summary);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n✅ MASTER_PROMPT.md has been updated');
  console.log('\nClaude Web Code will now create a Pull Request with these changes.');
}

if (require.main === module) {
  main().catch(console.error);
}

export { PromptOptimizer };
```

---

## Usage in Claude Web Code

### Workflow for Meg

**Step 1: Export CSV from Teams**
```
Meg (in Teams): !print

ERA: 📊 Session Export (Session ID: abc123)

```csv
Turn,User Message,ERA Response,Improvement Notes,Category,Timestamp
...
```
```

**Step 2: Copy CSV**

Meg selects and copies the CSV text from Teams chat.

**Step 3: Use /optimize command in Claude Web Code**

```
Meg (in Claude Web Code): /optimize

[pastes CSV]

Claude: ✅ Running prompt optimizer on your testing data...

[runs optimize-prompt.ts]

Claude: ✅ Analysis complete! Here's what I found:

📊 Testing Summary:
- Total turns: 12
- Total improvements: 18
- Categories: tone (5), content (3), clarity (2)

🔍 Key Patterns Identified:
1. "Too formal" - appears 5 times across different scenarios
   → Suggests: Add more conversational tone examples

2. "Should ask clarifying questions first" - appears 3 times
   → Suggests: Strengthen clarification priority rules

3. "Missing policy citation" - appears 2 times
   → Suggests: Emphasize citation requirements

📝 Proposed Changes:

Change 1: Tone & Personality Section
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OLD:
- Use natural connectors: "Got it," "Thanks for the update"

NEW:
- Use natural connectors: "Got it," "Thanks for the update," "I hear you"
- Prefer conversational over formal phrasing:
  ✅ "Let's figure this out together"
  ❌ "We shall proceed to analyze the situation"

REASON: 5 improvements noted responses were "too formal". Adding explicit conversational vs. formal examples.

[... more changes ...]

Here's the updated MASTER_PROMPT.md:
[shows the changes]

✅ MASTER_PROMPT.md has been updated

Claude: Now I'll create a Pull Request with these changes...

[Claude Web Code uses its native GitHub integration to create PR]

✅ Pull Request created!
   PR #42: Optimize MASTER_PROMPT.md based on testing session abc123
   URL: https://github.com/your-org/ERA/pull/42

Review the changes in GitHub and merge when ready!
```

**Step 4: Review PR in GitHub**

Meg clicks the PR link (or uses the GitHub icon in Claude Web Code) and sees:
- **Files changed** tab showing the diff
- **Description** with the optimization summary
- **Merge** button

**Step 5: Merge PR**

Meg clicks "Merge pull request" in GitHub UI.

✅ PR merged to `prompt-tuning` branch
✅ Render automatically redeploys with the updated prompt
✅ Meg can start testing the improved prompt immediately

---

## Analysis Algorithms

### Pattern Detection Algorithm

**Frequency-based patterns:**
```typescript
function detectFrequencyPatterns(improvements: string[]): Pattern[] {
  const patterns = [];

  // Count exact matches
  const counts = new Map<string, number>();
  improvements.forEach(note => {
    counts.set(note, (counts.get(note) || 0) + 1);
  });

  // Patterns that appear 3+ times are significant
  for (const [note, count] of counts.entries()) {
    if (count >= 3) {
      patterns.push({ note, count, type: 'frequent' });
    }
  }

  return patterns;
}
```

**Semantic similarity patterns:**
```typescript
function detectSemanticPatterns(improvements: string[]): Pattern[] {
  const patterns = [];

  // Group similar improvements using embeddings
  // E.g., "too formal" and "not conversational enough" are similar

  // Use OpenAI embeddings to find semantic clusters
  const embeddings = await getEmbeddings(improvements);
  const clusters = clusterBySimilarity(embeddings, threshold=0.8);

  clusters.forEach(cluster => {
    if (cluster.size >= 2) {
      patterns.push({
        notes: cluster.items,
        count: cluster.size,
        type: 'semantic'
      });
    }
  });

  return patterns;
}
```

### Change Generation Algorithm

**Use Claude to generate specific changes:**

```typescript
async function generateChanges(
  currentPrompt: string,
  patterns: Pattern[]
): Promise<Change[]> {
  const systemPrompt = `You are a prompt engineering expert. You will analyze improvement feedback and suggest specific changes to the master prompt.

Rules:
1. Only suggest changes that address recurring patterns (3+ occurrences)
2. Be specific - quote the exact text to change
3. Explain why each change addresses the feedback
4. Preserve the overall structure and tone of the prompt
5. Don't make contradictory changes`;

  const userPrompt = `
Current MASTER_PROMPT.md:
"""
${currentPrompt}
"""

Improvement patterns from testing:
${patterns.map(p => `- "${p.notes[0]}" (${p.count} occurrences)`).join('\n')}

Suggest specific changes to address these patterns. Format as JSON:
[
  {
    "section": "Tone & Personality",
    "oldText": "...",
    "newText": "...",
    "reason": "..."
  }
]
`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  });

  // Parse JSON response
  const changes = JSON.parse(response.content[0].text);
  return changes;
}
```

---

## Output Examples

### Example Summary Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 PROMPT OPTIMIZATION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Testing Summary:
- Session ID: abc123
- Total turns: 12
- Total improvements: 18
- Testing duration: 30 minutes
- Tester: meg@fitnessconnection.com

🔍 Patterns Identified:

1. TONE improvements (5 occurrences)
   - "Too formal" × 3
   - "Not conversational enough" × 2
   → Impact: HIGH - affects user experience

2. CONTENT improvements (3 occurrences)
   - "Should ask clarifying questions first" × 3
   → Impact: HIGH - affects correctness

3. CLARITY improvements (2 occurrences)
   - "Response too long" × 2
   → Impact: MEDIUM - affects readability

📝 Changes Applied:

✅ Change 1: Strengthened Clarification Priority
   Section: Context & Clarification Protocol
   Added: "🚨 CRITICAL PRIORITY ORDER: ALWAYS ASK CLARIFYING QUESTIONS FIRST"
   Reason: 3 improvements noted ERA provided guidance before clarifying

✅ Change 2: Added Conversational Tone Examples
   Section: Tone & Personality
   Added: Explicit "conversational vs. formal" examples
   Reason: 5 improvements noted responses were "too formal"

✅ Change 3: Added Response Length Guidelines
   Section: Response Flow Rules
   Added: "Keep responses concise - aim for 150-300 words"
   Reason: 2 improvements noted responses were "too long"

📈 Version:
   Old: v3.1.3
   New: v3.1.4

📝 Changelog:
   "v3.1.4: Strengthened clarification protocol priority and added
   conversational tone guidelines. Based on 12 testing turns with 18
   improvements. Key changes: Added ALWAYS emphasis to clarification
   priority, added conversational vs formal examples, added response
   length guidelines."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Next steps:
1. Review MASTER_PROMPT_NEW.md
2. If satisfied, rename to MASTER_PROMPT.md
3. Commit and push to prompt-tuning branch
4. Test the improved prompt in Teams
```

---

## Safety and Validation

### Pre-optimization Checks

Before running optimization:
1. ✅ Validate CSV format (correct columns, parseable)
2. ✅ Check minimum data requirement (at least 5 turns)
3. ✅ Verify MASTER_PROMPT.md exists and is readable
4. ✅ Check for contradictory feedback (warn if detected)

### Post-optimization Checks

After generating updated prompt:
1. ✅ Validate YAML frontmatter is preserved
2. ✅ Verify version was incremented correctly
3. ✅ Check changelog entry was added
4. ✅ Ensure all original sections are still present
5. ✅ Preview diff before saving

### Rollback

If optimization produces bad results:

```bash
# Meg can easily rollback
git checkout MASTER_PROMPT.md
```

Or keep backup:

```bash
# Optimizer automatically creates backup
cp MASTER_PROMPT.md MASTER_PROMPT.md.backup.20251024
```

---

## Success Criteria

**For the optimizer script to be successful:**
- ✅ Meg can run it in Claude Web Code without terminal access
- ✅ Accurately parses CSV from `!print` command
- ✅ Identifies meaningful patterns (not noise)
- ✅ Generates specific, actionable prompt changes
- ✅ Preserves prompt structure and formatting
- ✅ Provides clear summary of what changed and why
- ✅ Takes < 2 minutes to run (including LLM API call)
- ✅ Produces quality improvements (verified by next testing session)

---

## Future Enhancements

- **A/B testing mode** - Generate two prompt variants for comparison
- **Interactive mode** - Meg can accept/reject individual changes
- **Automated testing** - Run test scenarios against new prompt before committing
- **Version diffing** - Show side-by-side comparison with previous version
- **Prompt library** - Save successful prompt patterns for reuse
- **Integration with DSPy** - Use optimizer output as training data for DSPy

---

## Open Questions

1. **Minimum data threshold:** How many turns/improvements are needed for reliable optimization?
2. **Change approval workflow:** Should Meg approve each change individually or in batch?
3. **Conflicting feedback:** How to handle contradictory improvements (e.g., "too casual" vs. "too formal")?
4. **Testing validation:** Should we automatically run test scenarios after optimization?
5. **Change limits:** Should we limit to N changes per optimization to avoid over-tuning?
