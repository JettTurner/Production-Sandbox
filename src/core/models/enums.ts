export enum KnowledgeDomain {
  Work = "work",
  People = "people",
  Relationships = "relationships",
  Flow = "flow",
  Information = "information",
  TimeScale = "time_scale",
  Exceptions = "exceptions",
}

export enum QuestionType {
  Open = "open",
  SingleChoice = "single",
  MultiChoice = "multi",
  Scale = "scale",
  Boolean = "boolean",
}

export enum RelationshipType {
  Hierarchical = "hierarchical",
  Peer = "peer",
  CrossFunctional = "cross_functional",
  External = "external",
}

export enum FlowType {
  Sequential = "sequential",
  Parallel = "parallel",
  Iterative = "iterative",
  Hybrid = "hybrid",
}

export enum SessionStatus {
  Pending = "pending",
  Active = "active",
  Paused = "paused",
  Complete = "complete",
  Abandoned = "abandoned",
}
