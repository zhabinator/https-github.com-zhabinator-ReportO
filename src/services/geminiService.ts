/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ExtractionResult {
  companyName: string;
  year: string;
}

export async function extractPdfMetadata(text: string, imageBase64?: string): Promise<ExtractionResult | null> {
  try {
    const response = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, imageBase64 })
    });

    if (!response.ok) throw new Error('Ошибка сервера');
    return await response.json();
  } catch (error) {
    console.error("Extraction Service Error:", error);
    return null;
  }
}
