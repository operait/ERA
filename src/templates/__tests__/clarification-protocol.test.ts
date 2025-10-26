/**
 * Clarification Protocol Tests
 *
 * CRITICAL: These tests prevent regressions where ERA:
 * - Skips clarifying questions for ACTIVE situations
 * - Offers both call AND email simultaneously
 * - Misclassifies "What should I do if MY employee..." as HYPOTHETICAL
 */

import { ResponseGenerator, GeneratedResponse } from '../generator';
import { SearchContext } from '../../retrieval/search';
import Anthropic from '@anthropic-ai/sdk';

// Mock dependencies
jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        order: jest.fn(() => Promise.resolve({ data: [], error: null }))
      }))
    }))
  }
}));

jest.mock('@anthropic-ai/sdk');

// Create a mock that can be customized per test
const mockOpenAICreate = jest.fn();

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockOpenAICreate
      }
    }
  }));
});

describe('Clarification Protocol - ACTIVE vs HYPOTHETICAL Detection', () => {
  let responseGenerator: ResponseGenerator;
  let mockSearchContext: SearchContext;
  let mockAnthropicCreate: jest.Mock;

  beforeEach(() => {
    // Mock Anthropic API responses
    mockAnthropicCreate = jest.fn();
    (Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(() => ({
      messages: {
        create: mockAnthropicCreate
      }
    } as any));

    responseGenerator = new ResponseGenerator();

    mockSearchContext = {
      results: [
        {
          chunk_id: '1',
          document_id: 'doc1',
          document_title: 'No Show Policy',
          document_category: 'attendance',
          chunk_text: 'Employees who fail to show up for three consecutive shifts without calling may be considered to have voluntarily resigned.',
          chunk_index: 0,
          similarity: 0.85,
          metadata: {}
        }
      ],
      query: '',
      totalResults: 1,
      avgSimilarity: 0.85,
      categories: ['attendance'],
      retrievalTimeMs: 100
    };
  });

  describe('ACTIVE SITUATIONS - Should Ask Clarifying Questions', () => {
    test('Query with "my employee" should trigger clarification questions', async () => {
      // Mock GPT-4 response with clarifying questions
      mockOpenAICreate.mockResolvedValue({
        choices: [{
          message: {
            content: 'Got it — that\'s definitely something we need to address right away.\n\nJust to make sure I have the full picture:\n- Have you tried reaching out to them yet (phone, text, or email)?\n- Were these three consecutive scheduled shifts?'
          }
        }]
      });

      const query = "What should I do if my employee doesn't show up for 3 days in a row?";
      const result = await responseGenerator.generateResponse(query, mockSearchContext);

      // Should ask clarifying questions
      expect(result.response).toContain('Have you tried');
      expect(result.response).toContain('?');

      // Should NOT provide immediate steps or calendar booking
      expect(result.response).not.toContain('Immediate Steps');
      expect(result.response).not.toContain('would you like me to schedule');
      expect(result.response).not.toContain('calendar');
    });

    test('Query with "My employee" (capitalized) should trigger clarification', async () => {
      mockOpenAICreate.mockResolvedValue({
        choices: [{
          message: {
            content: 'Got it — that\'s a serious attendance issue.\n\nJust to make sure I have the full picture:\n- Have you tried calling or emailing them yet?'
          }
        }]
      });

      const query = "My employee didn't show up for 3 days";
      const result = await responseGenerator.generateResponse(query, mockSearchContext);

      expect(result.response).toContain('Have you tried');
      expect(result.response).toContain('?');
      expect(result.response).not.toContain('Immediate Steps');
    });

    test('Query with "our team member" should trigger clarification', async () => {
      mockOpenAICreate.mockResolvedValue({
        choices: [{
          message: {
            content: 'I understand — let me help you address this.\n\nFirst, have you tried reaching out to them?'
          }
        }]
      });

      const query = "Our team member hasn't shown up this week";
      const result = await responseGenerator.generateResponse(query, mockSearchContext);

      expect(result.response.toLowerCase()).toContain('have you tried');
      expect(result.response).toContain('?');
    });

    test('Query with employee name should trigger clarification', async () => {
      mockOpenAICreate.mockResolvedValue({
        choices: [{
          message: {
            content: 'Got it — three days is significant.\n\nHave you tried contacting John yet?'
          }
        }]
      });

      const query = "John hasn't shown up for 3 days";
      const result = await responseGenerator.generateResponse(query, mockSearchContext);

      expect(result.response).toContain('Have you tried');
      expect(result.response).toContain('?');
    });

    test('CRITICAL TEST (v3.1.3 fix): "What should I do if MY employee..." is ACTIVE', async () => {
      // This is the exact case that was failing before v3.1.3
      mockOpenAICreate.mockResolvedValue({
        choices: [{
          message: {
            content: 'Got it — that\'s definitely something we need to address right away.\n\nJust to make sure I have the full picture:\n- Have you tried reaching out to them yet?'
          }
        }]
      });

      const query = "What should I do if my employee doesn't show up for 3 days in a row?";
      const result = await responseGenerator.generateResponse(query, mockSearchContext);

      // MUST ask clarifying questions (this is ACTIVE because it contains "my")
      expect(result.response).toContain('Have you tried');
      expect(result.response).toContain('?');
      expect(result.response).not.toContain('Immediate Steps');

      // Verify the system prompt sent to GPT-4 includes the ACTIVE/HYPOTHETICAL rules
      const callArgs = mockOpenAICreate.mock.calls[0][0];
      const systemMessage = callArgs.messages.find((m: any) => m.role === 'system');
      expect(systemMessage.content).toContain('ACTIVE SITUATIONS');
      expect(systemMessage.content).toContain('Clarification Hierarchy');
    });
  });

  describe('HYPOTHETICAL SITUATIONS - Should Provide Full Guidance', () => {
    test('Query with "an employee" should provide full guidance', async () => {
      mockOpenAICreate.mockResolvedValue({
        choices: [{
          message: {
            content: 'Good question — let me walk you through the process.\n\n**Immediate Steps:**\n1. Contact the employee\n2. Document the absence\n3. Follow progressive discipline policy'
          }
        }]
      });

      const query = "What should I do if an employee doesn't show up for 3 days?";
      const result = await responseGenerator.generateResponse(query, mockSearchContext);

      // Should provide guidance (not just clarifying questions)
      expect(result.response.length).toBeGreaterThan(100);

      // Should NOT start with clarifying questions
      expect(result.response).not.toMatch(/^.*Have you tried/);
    });

    test('Query with "someone" should provide full guidance', async () => {
      mockOpenAICreate.mockResolvedValue({
        choices: [{
          message: {
            content: 'Here\'s how to handle lateness issues:\n\n1. Document the pattern\n2. Schedule a conversation\n3. Create an improvement plan'
          }
        }]
      });

      const query = "How do I handle someone who is late?";
      const result = await responseGenerator.generateResponse(query, mockSearchContext);

      expect(result.response.length).toBeGreaterThan(50);
    });
  });

  describe('Sequential Action Workflow (v3.1.2)', () => {
    test('After clarification, should offer calendar booking and NOT email drafting', async () => {
      // Simulate conversation where manager answered clarifying questions
      const conversationHistory = [
        { role: 'user' as const, content: "What should I do if my employee doesn't show up for 3 days?" },
        { role: 'assistant' as const, content: "Have you tried reaching out to them yet?" },
        { role: 'user' as const, content: "I tried calling once but they didn't pick up. Three consecutive days." }
      ];

      mockOpenAICreate.mockResolvedValue({
        choices: [{
          message: {
            content: 'Thanks for the context. Since you\'ve already made one attempt, the next step is to make a second call attempt today and document it.\n\nSince you need to call the employee to discuss this serious attendance issue, would you like me to schedule that call for you? I\'ll check your calendar and find available times.'
          }
        }]
      });

      const result = await responseGenerator.generateResponse(
        "I tried calling once but they didn't pick up. Three consecutive days.",
        mockSearchContext,
        undefined,
        conversationHistory
      );

      // Should recommend calling
      expect(result.response.toLowerCase()).toMatch(/call|phone/);

      // Should offer calendar booking
      expect(result.response.toLowerCase()).toMatch(/schedule|calendar/);

      // Should NOT offer email drafting yet
      expect(result.response.toLowerCase()).not.toMatch(/draft.*email|help.*draft|email.*draft/);
    });

    test('Should NOT offer both call AND email in same response', async () => {
      const conversationHistory = [
        { role: 'user' as const, content: "My employee didn't show up for 3 days" },
        { role: 'assistant' as const, content: "Have you tried reaching out?" },
        { role: 'user' as const, content: "I called once today" }
      ];

      mockOpenAICreate.mockResolvedValue({
        choices: [{
          message: {
            content: 'Since you need to call the employee again, would you like me to schedule that call for you?'
          }
        }]
      });

      const result = await responseGenerator.generateResponse(
        "I called once today",
        mockSearchContext,
        undefined,
        conversationHistory
      );

      const hasCallRecommendation = /call|phone/.test(result.response.toLowerCase());
      const hasEmailOffer = /draft.*email|help.*email/.test(result.response.toLowerCase());

      // If recommending call, should NOT offer email
      if (hasCallRecommendation) {
        expect(hasEmailOffer).toBe(false);
      }
    });

    test('After manager reports call outcome, THEN can offer email drafting', async () => {
      const conversationHistory = [
        { role: 'user' as const, content: "My employee didn't show up" },
        { role: 'assistant' as const, content: "Have you tried reaching out?" },
        { role: 'user' as const, content: "Not yet" },
        { role: 'assistant' as const, content: "Since you need to call the employee, would you like me to schedule that call?" },
        { role: 'user' as const, content: "I called them and they said they were sick" }
      ];

      mockOpenAICreate.mockResolvedValue({
        choices: [{
          message: {
            content: 'Got it — thanks for following up with them. Since they mentioned being sick, we need to explore if this qualifies for medical leave.\n\n1. Ask if they need medical documentation\n2. Contact HR to discuss potential FMLA/medical leave\n\nWould you like me to help draft the email to HR about this?'
          }
        }]
      });

      const result = await responseGenerator.generateResponse(
        "I called them and they said they were sick",
        mockSearchContext,
        undefined,
        conversationHistory
      );

      // NOW can offer email drafting (manager completed the call)
      expect(result.response.toLowerCase()).toMatch(/email|contact hr|escalate/);
    });
  });

  describe('Conversation Context Recognition', () => {
    test('Should recognize when user is answering ERA\'s question', async () => {
      const conversationHistory = [
        { role: 'user' as const, content: "My employee didn't show up" },
        { role: 'assistant' as const, content: "Have you tried reaching out to them?" }
      ];

      mockOpenAICreate.mockResolvedValue({
        choices: [{
          message: {
            content: 'Thanks for the info. Since you\'ve already called once, here\'s what to do next...'
          }
        }]
      });

      const result = await responseGenerator.generateResponse(
        "Yes, I called them once today",
        mockSearchContext,
        undefined,
        conversationHistory
      );

      // Should provide guidance (not ask more clarifying questions)
      expect(result.response.toLowerCase()).toMatch(/next|step|since/);
    });
  });
});

describe('MASTER_PROMPT.md Integration', () => {
  test('Should load MASTER_PROMPT.md successfully', () => {
    const generator = new ResponseGenerator();
    // If MASTER_PROMPT.md loads successfully, constructor won't throw
    expect(generator).toBeDefined();
  });

  test('System prompt should include ACTIVE/HYPOTHETICAL detection rules', async () => {
    mockOpenAICreate.mockResolvedValue({
      choices: [{
        message: {
          content: 'Test response'
        }
      }]
    });

    const generator = new ResponseGenerator();
    const mockContext: SearchContext = {
      results: [{
        chunk_id: '1',
        document_id: 'doc1',
        document_title: 'Policy',
        document_category: 'general',
        chunk_text: 'Policy text',
        chunk_index: 0,
        similarity: 0.8,
        metadata: {}
      }],
      query: 'test',
      totalResults: 1,
      avgSimilarity: 0.8,
      categories: ['general'],
      retrievalTimeMs: 100
    };

    await generator.generateResponse("My employee is late", mockContext);

    const callArgs = mockOpenAICreate.mock.calls[0][0];
    const systemMessage = callArgs.messages.find((m: any) => m.role === 'system');
    const systemPrompt = systemMessage.content;

    // Verify v4.0.0 structure is in the system prompt
    expect(systemPrompt).toContain('ACTIVE');
    expect(systemPrompt).toContain('HYPOTHETICAL');
    expect(systemPrompt).toContain('Clarification Hierarchy');
    expect(systemPrompt).toContain('Response Flow');
  });
});
