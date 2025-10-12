import { supabase } from '../lib/supabase';
import { EmbeddingsGenerator } from '../embeddings/generate';
import { SearchResult } from '../types/index';

export interface SearchOptions {
  maxResults: number;
  similarityThreshold: number;
  categoryFilter?: string;
  includeMetadata: boolean;
}

export interface SearchContext {
  query: string;
  results: SearchResult[];
  totalResults: number;
  avgSimilarity: number;
  categories: string[];
  retrievalTimeMs: number;
}

/**
 * RAG-based document retrieval system
 */
export class DocumentRetriever {
  private embeddings: EmbeddingsGenerator;

  constructor() {
    this.embeddings = new EmbeddingsGenerator();
  }

  /**
   * Semantic search for documents
   */
  async search(
    query: string,
    options: SearchOptions = {
      maxResults: 5,
      similarityThreshold: 0.75,
      includeMetadata: true
    }
  ): Promise<SearchContext> {
    const startTime = Date.now();

    try {
      // Generate embedding for the query
      const queryEmbedding = await this.embeddings.generateEmbedding(query);

      // Perform similarity search
      const { data: results, error } = await supabase.rpc(
        options.categoryFilter ? 'similarity_search_by_category' : 'similarity_search',
        {
          query_embedding: queryEmbedding,
          similarity_threshold: options.similarityThreshold,
          match_count: options.maxResults,
          ...(options.categoryFilter && { category_filter: options.categoryFilter })
        }
      );

      if (error) {
        throw new Error(`Search error: ${error.message}`);
      }

      const searchResults: SearchResult[] = results || [];
      const retrievalTimeMs = Date.now() - startTime;

      // Calculate statistics
      const avgSimilarity = searchResults.length > 0
        ? searchResults.reduce((sum, r) => sum + r.similarity, 0) / searchResults.length
        : 0;

      const categories = [...new Set(searchResults.map(r => r.document_category))];

      const context: SearchContext = {
        query,
        results: searchResults,
        totalResults: searchResults.length,
        avgSimilarity,
        categories,
        retrievalTimeMs
      };

      // Log the search for analytics
      await this.logSearch(context);

      return context;
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }

  /**
   * Multi-query search with result fusion
   */
  async multiSearch(
    queries: string[],
    options: SearchOptions = {
      maxResults: 5,
      similarityThreshold: 0.75,
      includeMetadata: true
    }
  ): Promise<SearchContext> {
    try {
      // Perform searches for all queries
      const searchPromises = queries.map(query => this.search(query, {
        ...options,
        maxResults: Math.ceil(options.maxResults * 1.5) // Get more results for fusion
      }));

      const contexts = await Promise.all(searchPromises);

      // Fuse results using reciprocal rank fusion
      const fusedResults = this.fuseSearchResults(contexts);

      // Take top results
      const finalResults = fusedResults.slice(0, options.maxResults);

      const avgSimilarity = finalResults.length > 0
        ? finalResults.reduce((sum, r) => sum + r.similarity, 0) / finalResults.length
        : 0;

      const categories = [...new Set(finalResults.map(r => r.document_category))];
      const totalRetrievalTime = contexts.reduce((sum, c) => sum + c.retrievalTimeMs, 0);

      return {
        query: queries.join(' | '),
        results: finalResults,
        totalResults: finalResults.length,
        avgSimilarity,
        categories,
        retrievalTimeMs: totalRetrievalTime
      };
    } catch (error) {
      console.error('Multi-search error:', error);
      throw error;
    }
  }

  /**
   * Search with query expansion
   */
  async expandedSearch(
    query: string,
    options: SearchOptions = {
      maxResults: 5,
      similarityThreshold: 0.75,
      includeMetadata: true
    }
  ): Promise<SearchContext> {
    // Generate related queries for better coverage
    const expandedQueries = this.expandQuery(query);

    return await this.multiSearch(expandedQueries, options);
  }

  /**
   * Get relevant context for a specific HR scenario
   */
  async getHRContext(scenario: string, category?: string): Promise<SearchContext> {
    const searchOptions: SearchOptions = {
      maxResults: 5,
      similarityThreshold: 0.50, // Balanced threshold for real-world queries
      categoryFilter: category,
      includeMetadata: true
    };

    // Use expanded search for better coverage
    return await this.expandedSearch(scenario, searchOptions);
  }

  /**
   * Simple reciprocal rank fusion for combining search results
   */
  private fuseSearchResults(contexts: SearchContext[]): SearchResult[] {
    const resultMap = new Map<string, { result: SearchResult; score: number }>();

    contexts.forEach((context, contextIndex) => {
      context.results.forEach((result, rank) => {
        const key = `${result.document_id}-${result.chunk_id}`;
        const rrf_score = 1 / (rank + 1); // Reciprocal rank fusion score

        if (resultMap.has(key)) {
          const existing = resultMap.get(key)!;
          existing.score += rrf_score;
        } else {
          resultMap.set(key, {
            result,
            score: rrf_score
          });
        }
      });
    });

    // Sort by fused score and return results
    return Array.from(resultMap.values())
      .sort((a, b) => b.score - a.score)
      .map(item => item.result);
  }

  /**
   * Expand query with related terms for better search coverage
   */
  private expandQuery(query: string): string[] {
    const baseQuery = query.toLowerCase();
    const expansions = [query]; // Start with original query

    // HR-specific query expansions
    const hrTermMappings: Record<string, string[]> = {
      'attendance': ['tardiness', 'punctuality', 'missed shifts', 'no-call no-show'],
      'termination': ['firing', 'dismissal', 'separation', 'end employment'],
      'disciplinary': ['corrective action', 'warning', 'performance issues'],
      'harassment': ['discrimination', 'workplace behavior', 'inappropriate conduct'],
      'leave': ['time off', 'vacation', 'sick leave', 'FMLA'],
      'performance': ['evaluation', 'review', 'improvement plan', 'goals'],
      'missed': ['absent', 'no-show', 'no call no show', 'skipped'],
      'show up': ['attend', 'appear', 'report to work', 'come in'],
      'doesn\'t': ['does not', 'didn\'t', 'did not', 'won\'t', 'will not']
    };

    // Add relevant expansions
    Object.entries(hrTermMappings).forEach(([key, terms]) => {
      if (baseQuery.includes(key)) {
        terms.forEach(term => {
          if (!expansions.some(exp => exp.toLowerCase().includes(term))) {
            expansions.push(query.replace(new RegExp(key, 'gi'), term));
          }
        });
      }
    });

    console.log(`🔍 Query expansion: ${expansions.length} variations from "${query}"`);
    return expansions;
  }

  /**
   * Log search for analytics
   */
  private async logSearch(context: SearchContext): Promise<void> {
    try {
      await supabase.from('query_logs').insert({
        query: context.query,
        context_used: {
          total_results: context.totalResults,
          avg_similarity: context.avgSimilarity,
          categories: context.categories,
          top_similarities: context.results.slice(0, 3).map(r => r.similarity)
        },
        similarity_scores: context.results.map(r => r.similarity),
        response_time_ms: context.retrievalTimeMs
      });
    } catch (error) {
      console.error('Error logging search:', error);
      // Don't throw - logging shouldn't break the search
    }
  }

  /**
   * Get search analytics
   */
  async getSearchAnalytics(days: number = 7): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('query_logs')
        .select('query, context_used, response_time_ms, created_at')
        .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Analytics error: ${error.message}`);
      }

      return {
        totalQueries: data?.length || 0,
        avgResponseTime: data?.length
          ? data.reduce((sum, log) => sum + (log.response_time_ms || 0), 0) / data.length
          : 0,
        commonQueries: this.getTopQueries(data || []),
        categories: this.getCategoryStats(data || [])
      };
    } catch (error) {
      console.error('Error getting analytics:', error);
      return null;
    }
  }

  private getTopQueries(logs: any[], limit: number = 5): Array<{ query: string; count: number }> {
    const queryCount = logs.reduce((acc, log) => {
      acc[log.query] = (acc[log.query] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(queryCount)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, limit)
      .map(([query, count]) => ({ query, count: count as number }));
  }

  private getCategoryStats(logs: any[]): Record<string, number> {
    const categories: Record<string, number> = {};

    logs.forEach(log => {
      if (log.context_used?.categories) {
        log.context_used.categories.forEach((cat: string) => {
          categories[cat] = (categories[cat] || 0) + 1;
        });
      }
    });

    return categories;
  }
}

// Export for testing
export { DocumentRetriever as RAGRetriever };