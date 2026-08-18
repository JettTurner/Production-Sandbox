export interface ProductionModel {
  meta: {
    sessionId: string;
    generatedAt: string;
    coverage: number;
    confidence: number;
  };
  work: {
    primaryUnits: string[];
    types: string[];
    scale: string;
  };
  people: {
    roles: string[];
    responsibilities: string[];
    count: string;
  };
  relationships: {
    entities: string[];
    connections: { from: string; to: string; type: string }[];
  };
  flow: {
    pattern: string;
    handoffs: string[];
    boundaries: string[];
  };
  information: {
    persistence: string;
    versioning: string;
    access: string;
  };
  timeScale: {
    cadence: string;
    lifecycle: string;
    volume: string;
  };
  exceptions: string[];
  designImplications: string[];
}
