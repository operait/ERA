/**
 * Text chunking utilities for document processing
 */

export interface ChunkOptions {
  maxChunkSize: number;
  overlap: number;
  preserveParagraphs: boolean;
}

export interface TextChunk {
  text: string;
  index: number;
  metadata?: Record<string, any>;
}

/**
 * Split text into overlapping chunks for better context preservation
 */
export function chunkText(
  text: string,
  options: ChunkOptions = {
    maxChunkSize: 1000,
    overlap: 200,
    preserveParagraphs: true
  }
): TextChunk[] {
  const chunks: TextChunk[] = [];

  // Clean and normalize text
  const cleanText = text.replace(/\s+/g, ' ').trim();

  if (cleanText.length <= options.maxChunkSize) {
    return [{
      text: cleanText,
      index: 0,
      metadata: { originalLength: cleanText.length }
    }];
  }

  let startIndex = 0;
  let chunkIndex = 0;

  while (startIndex < cleanText.length) {
    let endIndex = Math.min(startIndex + options.maxChunkSize, cleanText.length);

    // Try to break at sentence boundaries
    if (endIndex < cleanText.length && options.preserveParagraphs) {
      const sentenceBreak = findSentenceBreak(cleanText, startIndex, endIndex);
      if (sentenceBreak > startIndex + options.maxChunkSize * 0.5) {
        endIndex = sentenceBreak;
      }
    }

    const chunkText = cleanText.slice(startIndex, endIndex).trim();

    if (chunkText.length > 0) {
      chunks.push({
        text: chunkText,
        index: chunkIndex,
        metadata: {
          startIndex,
          endIndex,
          originalLength: chunkText.length
        }
      });
      chunkIndex++;
    }

    // Move start index with overlap
    startIndex = Math.max(startIndex + options.maxChunkSize - options.overlap, endIndex);

    // Prevent infinite loop
    if (startIndex >= endIndex && endIndex === cleanText.length) {
      break;
    }
  }

  return chunks;
}

/**
 * Find the best sentence break point within a range
 */
function findSentenceBreak(text: string, start: number, maxEnd: number): number {
  const sentenceEnders = ['. ', '! ', '? ', '.\n', '!\n', '?\n'];
  let bestBreak = maxEnd;

  for (let i = maxEnd - 1; i > start + 100; i--) {
    for (const ender of sentenceEnders) {
      if (text.slice(i, i + ender.length) === ender) {
        return i + ender.length;
      }
    }
  }

  // Fallback to word boundary
  for (let i = maxEnd - 1; i > start + 100; i--) {
    if (text[i] === ' ') {
      return i + 1;
    }
  }

  return bestBreak;
}

/**
 * Chunk document by sections (headers, bullet points, etc.)
 */
export function chunkByStructure(text: string): TextChunk[] {
  const chunks: TextChunk[] = [];

  // Split by common HR document structures
  const sections = text.split(/(?=^##?\s)|(?=^\d+\.\s)|(?=^[A-Z][A-Z\s]+:)/gm);

  sections.forEach((section, index) => {
    const trimmedSection = section.trim();
    if (trimmedSection.length > 0) {
      // Further chunk if section is too large
      if (trimmedSection.length > 1500) {
        const subChunks = chunkText(trimmedSection, {
          maxChunkSize: 1000,
          overlap: 150,
          preserveParagraphs: true
        });

        subChunks.forEach((subChunk, subIndex) => {
          chunks.push({
            text: subChunk.text,
            index: chunks.length,
            metadata: {
              section: index,
              subChunk: subIndex,
              isStructural: true
            }
          });
        });
      } else {
        chunks.push({
          text: trimmedSection,
          index: chunks.length,
          metadata: {
            section: index,
            isStructural: true
          }
        });
      }
    }
  });

  return chunks.length > 0 ? chunks : chunkText(text);
}