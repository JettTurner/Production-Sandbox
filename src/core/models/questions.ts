import { KnowledgeDomain, QuestionType } from "./enums.js";
export { QuestionType } from "./enums.js";

export interface QuestionOption {
  id: string;
  label: string;
  value: string;
  unlocks: string[];
  domains: KnowledgeDomain[];
}

export interface Question {
  id: string;
  domain: KnowledgeDomain;
  type: QuestionType;
  text: string;
  options?: QuestionOption[];
  scaleMin?: number;
  scaleMax?: number;
  scaleLabels?: { min: string; max: string };
  prerequisites: string[];
  importance: number;
  knowledgeYield: number;
  tags: string[];
}

export interface Answer {
  questionId: string;
  value: string;
  text?: string;
  selectedOptions?: string[];
}
