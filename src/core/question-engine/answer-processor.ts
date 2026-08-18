import { Question, Answer } from "../models/questions.js";
import { DomainFact } from "../models/knowledge.js";
import { QuestionType, KnowledgeDomain } from "../models/enums.js";

function generateId(): string {
  return crypto.randomUUID();
}

export class AnswerProcessor {
  static toFacts(question: Question, answer: Answer): DomainFact[] {
    switch (question.type) {
      case QuestionType.Boolean:
        return AnswerProcessor.processBoolean(question, answer);
      case QuestionType.SingleChoice:
        return AnswerProcessor.processSingleChoice(question, answer);
      case QuestionType.MultiChoice:
        return AnswerProcessor.processMultiChoice(question, answer);
      case QuestionType.Scale:
        return AnswerProcessor.processScale(question, answer);
      case QuestionType.Open:
        return AnswerProcessor.processOpen(question, answer);
      default:
        return [];
    }
  }

  private static processBoolean(question: Question, answer: Answer): DomainFact[] {
    const isYes = answer.value === "yes";
    const facts: DomainFact[] = [
      {
        id: generateId(),
        domain: question.domain,
        key: question.tags[0] || question.id,
        value: isYes,
        confidence: 0.9,
        importance: question.importance,
        source: question.id,
        timestamp: Date.now(),
      },
    ];

    if (isYes && question.options) {
      const yesOption = question.options.find(o => o.value === "yes");
      if (yesOption) {
        for (const domain of yesOption.domains) {
          facts.push({
            id: generateId(),
            domain,
            key: `${question.tags[0]}_affirmed`,
            value: true,
            confidence: 0.85,
            importance: question.importance,
            source: question.id,
            timestamp: Date.now(),
          });
        }
      }
    }

    return facts;
  }

  private static processSingleChoice(question: Question, answer: Answer): DomainFact[] {
    if (!question.options) return [];

    const selected = question.options.find(o => o.id === answer.value || o.value === answer.value);
    if (!selected) return [];

    const facts: DomainFact[] = [
      {
        id: generateId(),
        domain: question.domain,
        key: question.tags[0] || question.id,
        value: selected.value,
        confidence: 0.85,
        importance: question.importance,
        source: question.id,
        timestamp: Date.now(),
      },
    ];

    for (const domain of selected.domains) {
      facts.push({
        id: generateId(),
        domain,
        key: `${question.tags[0]}_selected`,
        value: selected.value,
        confidence: 0.8,
        importance: question.importance * 0.8,
        source: question.id,
        timestamp: Date.now(),
      });
    }

    return facts;
  }

  private static processMultiChoice(question: Question, answer: Answer): DomainFact[] {
    if (!question.options || !answer.selectedOptions) return [];

    const facts: DomainFact[] = [];
    for (const optionId of answer.selectedOptions) {
      const option = question.options.find(o => o.id === optionId);
      if (!option) continue;

      facts.push({
        id: generateId(),
        domain: question.domain,
        key: `${question.tags[0]}_${option.value}`,
        value: true,
        confidence: 0.8,
        importance: question.importance,
        source: question.id,
        timestamp: Date.now(),
      });
    }

    facts.push({
      id: generateId(),
      domain: question.domain,
      key: `${question.tags[0]}_selections`,
      value: answer.selectedOptions,
      confidence: 0.85,
      importance: question.importance,
      source: question.id,
      timestamp: Date.now(),
    });

    return facts;
  }

  private static processScale(question: Question, answer: Answer): DomainFact[] {
    const numericValue = Number(answer.value);
    if (isNaN(numericValue)) return [];

    const min = question.scaleMin ?? 1;
    const max = question.scaleMax ?? 5;
    const normalized = (numericValue - min) / (max - min);

    return [
      {
        id: generateId(),
        domain: question.domain,
        key: question.tags[0] || question.id,
        value: numericValue,
        confidence: 0.7,
        importance: question.importance,
        source: question.id,
        timestamp: Date.now(),
      },
      {
        id: generateId(),
        domain: question.domain,
        key: `${question.tags[0]}_level`,
        value: normalized < 0.33 ? "low" : normalized < 0.66 ? "medium" : "high",
        confidence: 0.75,
        importance: question.importance * 0.7,
        source: question.id,
        timestamp: Date.now(),
      },
    ];
  }

  private static processOpen(question: Question, answer: Answer): DomainFact[] {
    return [
      {
        id: generateId(),
        domain: question.domain,
        key: question.tags[0] || question.id,
        value: answer.text || answer.value,
        confidence: 0.6,
        importance: question.importance,
        source: question.id,
        timestamp: Date.now(),
      },
    ];
  }
}
