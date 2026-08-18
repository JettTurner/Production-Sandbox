import { KnowledgeDomain } from "../models/enums.js";
import { DomainFact } from "../models/knowledge.js";

export interface CompletenessReport {
  overall: number;
  coverage: Record<KnowledgeDomain, number>;
  confidence: number;
  gaps: string[];
  uncertainties: DomainFact[];
  contradictions: { description: string; resolved: boolean }[];
  isReadyForDesign: boolean;
  recommendation: string;
}

export class CompletenessAnalyzer {
  static analyze(
    facts: DomainFact[],
    contradictions: { description: string; resolved: boolean }[],
    coverage: Record<KnowledgeDomain, number>,
    averageConfidence: number
  ): CompletenessReport {
    const totalCoverage = Object.values(coverage).reduce((a, b) => a + b, 0) / 7;
    const gaps = CompletenessAnalyzer.findGaps(coverage);
    const uncertainties = facts.filter(f => f.confidence < 0.7);
    const unresolvedContradictions = contradictions.filter(c => !c.resolved);
    const isReadyForDesign = averageConfidence > 0.75 && unresolvedContradictions.length === 0 && totalCoverage > 0.6;

    return {
      overall: totalCoverage,
      coverage,
      confidence: averageConfidence,
      gaps,
      uncertainties,
      contradictions,
      isReadyForDesign,
      recommendation: CompletenessAnalyzer.generateRecommendation(
        coverage,
        averageConfidence,
        unresolvedContradictions.length,
        gaps
      ),
    };
  }

  private static findGaps(coverage: Record<KnowledgeDomain, number>): string[] {
    const gaps: string[] = [];
    const domainNames: Record<KnowledgeDomain, string> = {
      [KnowledgeDomain.Work]: "Work",
      [KnowledgeDomain.People]: "People",
      [KnowledgeDomain.Relationships]: "Relationships",
      [KnowledgeDomain.Flow]: "Flow",
      [KnowledgeDomain.Information]: "Information",
      [KnowledgeDomain.TimeScale]: "Time & Scale",
      [KnowledgeDomain.Exceptions]: "Exceptions",
    };

    for (const [domain, cov] of Object.entries(coverage)) {
      if (cov < 0.3) {
        gaps.push(`${domainNames[domain as KnowledgeDomain]} domain is largely unexplored (${Math.round(cov * 100)}%)`);
      } else if (cov < 0.6) {
        gaps.push(`${domainNames[domain as KnowledgeDomain]} domain has partial coverage (${Math.round(cov * 100)}%)`);
      }
    }

    return gaps;
  }

  private static generateRecommendation(
    coverage: Record<KnowledgeDomain, number>,
    confidence: number,
    unresolvedContradictions: number,
    gaps: string[]
  ): string {
    if (unresolvedContradictions > 0) {
      return `Resolve ${unresolvedContradictions} contradiction(s) before proceeding. The model contains conflicting information that needs clarification.`;
    }

    if (confidence < 0.5) {
      return "Overall confidence is low. Consider revisiting key questions to increase certainty before designing.";
    }

    if (gaps.length > 3) {
      return `Many domains are unexplored: ${gaps.slice(0, 3).join("; ")}. Continue the interview to build a more complete picture.`;
    }

    if (confidence > 0.75 && gaps.length <= 2) {
      return "The model has sufficient coverage and confidence for initial design. You may proceed or continue exploring gaps for a more complete picture.";
    }

    return "Continue the interview. Focus on unexplored areas to build a more complete organizational model.";
  }
}
