// Gemini AI service for email analysis
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { ParsedEmail } from '../gmail/service';
import { formatEmailForPrompt, formatEmailsForBatchPrompt } from './prompts';

export type Priority = 'HIGH' | 'MEDIUM' | 'LOW';
export type ActionType = 'RESPONSE_NEEDED' | 'FOLLOW_UP' | 'WAITING' | 'FYI' | 'DEADLINE';
export type ResponseTime = 'ASAP' | 'This week' | 'When convenient' | 'No response needed';

export interface EmailAnalysis {
    id: string;
    priority: Priority;
    action: ActionType;
    summary: string;
    suggestedResponseTime: ResponseTime;
    keyPoints?: string[];
    deadline?: string | null;
    reasoning?: string;
}

export interface AnalyzedEmail extends ParsedEmail {
    analysis: EmailAnalysis;
}

export class GeminiService {
    private model: GenerativeModel;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('Missing GEMINI_API_KEY environment variable');
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        this.model = genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            generationConfig: {
                temperature: 0.3, // Lower temperature for more consistent analysis
                topP: 0.8,
                maxOutputTokens: 1024,
            },
        });
    }

    // Analyze a single email in detail
    async analyzeEmail(email: ParsedEmail): Promise<EmailAnalysis> {
        const prompt = formatEmailForPrompt(email);

        try {
            const result = await this.model.generateContent(prompt);
            const response = result.response.text();

            // Extract JSON from response (handle markdown code blocks)
            const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) ||
                response.match(/\{[\s\S]*\}/);

            if (!jsonMatch) {
                throw new Error('Could not parse Gemini response as JSON');
            }

            const jsonStr = jsonMatch[1] || jsonMatch[0];
            const analysis = JSON.parse(jsonStr) as EmailAnalysis;
            analysis.id = email.id;

            return analysis;
        } catch (error) {
            console.error('Error analyzing email:', error);
            // Return a default analysis on error
            return {
                id: email.id,
                priority: 'MEDIUM',
                action: 'FYI',
                summary: email.snippet || 'Unable to analyze email',
                suggestedResponseTime: 'When convenient',
                reasoning: 'Analysis failed, using defaults',
            };
        }
    }

    // Batch analyze multiple emails (more efficient)
    async batchAnalyze(emails: ParsedEmail[]): Promise<EmailAnalysis[]> {
        if (emails.length === 0) return [];

        // For small batches, analyze individually for better quality
        if (emails.length <= 3) {
            return Promise.all(emails.map(email => this.analyzeEmail(email)));
        }

        const prompt = formatEmailsForBatchPrompt(emails);

        try {
            const result = await this.model.generateContent(prompt);
            const response = result.response.text();

            // Extract JSON array from response
            const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) ||
                response.match(/\[[\s\S]*\]/);

            if (!jsonMatch) {
                throw new Error('Could not parse batch response as JSON');
            }

            const jsonStr = jsonMatch[1] || jsonMatch[0];
            const analyses = JSON.parse(jsonStr) as EmailAnalysis[];

            return analyses;
        } catch (error) {
            console.error('Error in batch analysis, falling back to individual:', error);
            // Fallback to individual analysis
            return Promise.all(emails.map(email => this.analyzeEmail(email)));
        }
    }

    // Combine emails with their analyses
    async analyzeAndEnrich(emails: ParsedEmail[]): Promise<AnalyzedEmail[]> {
        const analyses = await this.batchAnalyze(emails);

        // Create a map for quick lookup
        const analysisMap = new Map(analyses.map(a => [a.id, a]));

        return emails.map(email => ({
            ...email,
            analysis: analysisMap.get(email.id) || {
                id: email.id,
                priority: 'MEDIUM' as Priority,
                action: 'FYI' as ActionType,
                summary: email.snippet,
                suggestedResponseTime: 'When convenient' as ResponseTime,
            },
        }));
    }

    // Sort analyzed emails by priority
    sortByPriority(emails: AnalyzedEmail[]): AnalyzedEmail[] {
        const priorityOrder: Record<Priority, number> = {
            HIGH: 0,
            MEDIUM: 1,
            LOW: 2,
        };

        return [...emails].sort((a, b) => {
            const priorityDiff = priorityOrder[a.analysis.priority] - priorityOrder[b.analysis.priority];
            if (priorityDiff !== 0) return priorityDiff;

            // Secondary sort by date (older first for same priority)
            return a.date.getTime() - b.date.getTime();
        });
    }

    // Get actionable emails (filter out FYI)
    filterActionable(emails: AnalyzedEmail[]): AnalyzedEmail[] {
        return emails.filter(email => email.analysis.action !== 'FYI');
    }
}

// Singleton instance
let geminiService: GeminiService | null = null;

export function getGeminiService(): GeminiService {
    if (!geminiService) {
        geminiService = new GeminiService();
    }
    return geminiService;
}
