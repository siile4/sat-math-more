import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface KeyTerm {
  english: string;
  mongolian: string;
  definition: string;
  example: string;
}

export interface Question {
  id: string;
  topic: string;
  difficulty: string;
  questionEnglish: string;
  questionMongolian: string;
  options: string[];
  correctAnswerIndex: number;
  explanationEnglish: string;
  explanationMongolian: string;
  keyTerms: KeyTerm[];
}

export async function generateQuestion(topic: string, difficulty: string = 'medium'): Promise<Question> {
  const prompt = `Generate an SAT Math question for a 10th-grade student from Mongolia who has an A1 English level. The student is aiming for a score of 600.

Topic: ${topic}
Difficulty: ${difficulty} (easy = foundational/remedial, medium = standard SAT, hard = challenging)

Requirements:
1. The question must be in English (as it appears on the SAT) but use simple vocabulary where possible.
2. Provide a clear, accurate Mongolian translation of the question.
3. Provide 4 multiple-choice options.
4. Provide a step-by-step explanation in both simple English and Mongolian.
5. Identify 2-3 key math terms used in the question. For each term, provide:
   - English word
   - Mongolian translation
   - A simple English definition suitable for an ESL learner
   - An example of how it's used in SAT Math
6. Format math expressions using LaTeX enclosed in $ for inline and $$ for block (e.g., $x^2 + y^2 = r^2$).

Return the result as a JSON object matching the requested schema.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          questionEnglish: { type: Type.STRING, description: "The SAT math question in English" },
          questionMongolian: { type: Type.STRING, description: "The Mongolian translation of the question" },
          options: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "4 multiple choice options. Include LaTeX if needed."
          },
          correctAnswerIndex: { type: Type.INTEGER, description: "Index of the correct option (0-3)" },
          explanationEnglish: { type: Type.STRING, description: "Step-by-step explanation in simple English" },
          explanationMongolian: { type: Type.STRING, description: "Step-by-step explanation in Mongolian" },
          keyTerms: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                english: { type: Type.STRING },
                mongolian: { type: Type.STRING },
                definition: { type: Type.STRING, description: "Simple English definition" },
                example: { type: Type.STRING, description: "Example usage in SAT Math" }
              },
              required: ["english", "mongolian", "definition", "example"]
            }
          }
        },
        required: [
          "questionEnglish", 
          "questionMongolian", 
          "options", 
          "correctAnswerIndex", 
          "explanationEnglish", 
          "explanationMongolian",
          "keyTerms"
        ]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("Failed to generate question");
  
  const data = JSON.parse(text);
  return {
    id: Math.random().toString(36).substring(7),
    topic,
    difficulty,
    ...data
  };
}
