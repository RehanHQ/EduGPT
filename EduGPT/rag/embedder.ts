import { generateEmbeddings } from "@/lib/ai";

/**
 * Embeds one or more text chunks through the configured provider.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  return generateEmbeddings(texts);
}
