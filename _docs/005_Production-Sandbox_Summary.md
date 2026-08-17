> **Organizational systems should be derived from an understanding of how work actually occurs, rather than designed directly from assumptions about folders, software, departments, or hierarchy.**

A good research-paper structure would be:

# Production Sandbox

### A Framework for Discovering Organizational Structure Through Adaptive Inquiry

## Abstract

A concise explanation of the problem, the proposed system, and the central idea that organizational design can be **derived from systematically collected knowledge about how work occurs**.

---

# 1. Introduction

### 1.1 The Problem

Organizations routinely attempt to solve organizational problems by immediately designing:

* folder structures
* naming conventions
* databases
* project management systems
* org charts
* permissions
* software workflows

These solutions often encode assumptions about the organization before the organization itself has been adequately understood.

### 1.2 The Missing Layer

Introduce the missing layer between **reality** and **implementation**:

```text
How work actually happens
          ↓
Understanding
          ↓
Organizational model
          ↓
Design
          ↓
Implementation
```

Most organizational tools begin at **Design**.

The Production Sandbox begins at **Understanding**.

### 1.3 Research Question

Something along the lines of:

> **Can an adaptive questioning system systematically discover the organizational characteristics necessary to derive appropriate organizational and information structures?**

---

# 2. Organizational Reality as the Subject of Inquiry

Establish that the subject being modeled isn't files, folders, or software.

The subject is **production**.

Define the things that need to be understood:

* work
* people
* relationships
* workflows
* responsibility
* information
* time
* scale
* access
* history
* exceptions

The important principle:

> **The system describes what happens before deciding how it should be represented.**

---

# 3. From Implementation-First to Reality-First Design

This could be one of the central theoretical sections.

Compare:

### Traditional approach

```text
Problem
 ↓
Choose tool
 ↓
Design structure
 ↓
Fit organization into structure
```

versus:

### Production Sandbox

```text
Reality
 ↓
Question
 ↓
Observation
 ↓
Model
 ↓
Design alternatives
 ↓
Implementation
```

Discuss why implementation-first approaches can produce:

* arbitrary hierarchy
* duplicated information
* misplaced responsibility
* poor handoffs
* excessive complexity
* systems that work only under ideal conditions

---

# 4. The Organizational Knowledge Model

This defines the **master set of information the Sandbox attempts to discover**.

I'd organize it into the intuitive six categories we just developed:

## 4.1 Work

What does the organization do?

## 4.2 People

Who participates and who is responsible?

## 4.3 Relationships

How are people, work, and things connected?

## 4.4 Flow

How does work move and change?

## 4.5 Information

What needs to be remembered, shared, or protected?

## 4.6 Time and Scale

How often, how much, and how long?

Then introduce **Exceptions** as a cross-cutting dimension.

This becomes the paper's **master knowledge schema**.

---

# 5. Adaptive Inquiry

This is probably the most technically interesting section.

The Sandbox is not a static questionnaire.

It is an **adaptive interview system**.

### 5.1 Question Space

The system maintains a large collection of possible questions.

### 5.2 Knowledge State

Each answer updates an internal model of the organization.

### 5.3 Question Selection

The system selects the next question based on:

* what is already known
* what is unknown
* what is ambiguous
* what has high structural importance
* what information would unlock additional questions
* contradictions in previous answers

### 5.4 Dependency Chains

Example:

```text
Projects
   ↓
Multiple departments?
   ↓
Yes
   ↓
Independent workflows?
   ↓
Yes
   ↓
Do workflows exchange work?
   ↓
Yes
   ↓
What crosses the boundary?
   ↓
Assets + information
   ↓
Are versions important?
```

The interview therefore **branches and recursively explores the organizational model**.

---

# 6. Coverage, Confidence, and Completeness

The system needs to determine when it knows enough.

Introduce concepts such as:

### Coverage

How much of the knowledge model has been explored?

### Confidence

How certain is the system about a particular fact?

### Importance

How consequential is that fact to eventual design?

### Uncertainty

Where are answers ambiguous or contradictory?

You could formulate the question-selection problem as:

> **Ask the question that provides the greatest reduction in important uncertainty.**

That gives you a much more rigorous foundation for the adaptive engine.

---

# 7. Branching and Returning

Describe the behavior you specifically identified.

The system may:

```text
Work
 ↓
Departments
 ↓
Workflow
 ↓
Handoffs
 ↓
Deliverables
```

and then recognize that another major area remains unexplored:

```text
                 Work
                /    \
        Departments  Communication
            ↓             ↓
         Workflow       History
```

It temporarily follows one branch deeply, then **returns to the broader model and selects the next unresolved branch**.

This makes the interaction conversational rather than survey-like while still providing systematic coverage.

---

# 8. Contradiction and Clarification

The system should not simply collect answers.

It should **reason about them**.

Example:

> "Each department owns its own work."

Later:

> "Marketing regularly edits visualization deliverables."

The system identifies a potential contradiction and asks:

> "When Marketing edits a visualization deliverable, does responsibility remain with Visualization, transfer to Marketing, or depend on the project?"

This transforms the system from a questionnaire into an **organizational reasoning system**.

---

# 9. The Production Model

At the end of the inquiry, the system produces a structured representation of the organization.

For example:

```text
PRIMARY WORK UNIT
Project

RELATIONSHIPS
Client → Project
Project → Department
Project → Deliverable

WORKFLOW
Sequential + iterative

BOUNDARIES
Departmental

HANDOFFS
Frequent cross-department exchanges

INFORMATION
Persistent
Versioned
Historical

SCALE
High volume
Long lifecycle

ACCESS
Departmental + shared

EXCEPTIONS
Projects may pause and restart
```

This is **not yet a design**.

It is a description of the organization.

---

# 10. From Model to Design

This is where the Production Sandbox hands off to another system.

The same Production Model could produce multiple designs:

```text
                PRODUCTION MODEL
                       │
          ┌────────────┼────────────┐
          ↓            ↓            ↓
      FILE DESIGN   DATABASE     WORKFLOW
          │            │            │
       Folders       Schema      Automation
```

This distinction is critical.

A production model might imply:

> "Projects are persistent, multi-department entities."

That could be implemented as:

* a project folder hierarchy
* a database
* a project management system
* an application
* a hybrid file/database system

The Sandbox doesn't prematurely decide.

---

# 11. Design as Projection

This could be one of the paper's more interesting theoretical ideas.

A **design is a projection of the organizational model into a particular medium**.

For example:

```text
ORGANIZATIONAL MODEL
        ↓
 ┌──────┼───────┐
 ↓      ↓       ↓
FILES  DATABASE  SOFTWARE
 ↓      ↓       ↓
Folders Tables  Interfaces
```

The same underlying organizational reality can therefore have multiple valid representations.

This prevents the common mistake of treating a folder structure as though it *is* the organization.

---

# 12. The Production Sandbox as a Simulation Environment

The word **Sandbox** becomes meaningful here.

Once the model exists, users could eventually ask:

> What happens if we reorganize around clients instead of projects?

> What happens if departments become independent?

> What happens if communication becomes a first-class record?

> What happens if projects are allowed to restart after archival?

The Sandbox could then compare the consequences of alternative designs.

This creates:

**Discover → Model → Experiment → Compare → Design**

rather than simply:

**Answer → Generate folders.**

---

# 13. Case Study / Example

This section could use a real-world example, perhaps an architecture/visualization organization.

Start with seemingly simple facts:

> 50 active projects
> multiple departments
> long project lifecycles
> frequent handoffs
> hundreds of deliverables
> recurring client communication

Then show how the questioning engine progressively discovers the underlying structure.

For example:

```text
"What work do you do?"
        ↓
"Architecture + Visualization"
        ↓
"Is visualization part of projects?"
        ↓
"Usually"
        ↓
"Can multiple visualization efforts occur?"
        ↓
"Yes"
        ↓
"Do departments exchange work?"
        ↓
"Yes"
        ↓
"What crosses the boundary?"
        ↓
"Models, images, information"
        ↓
"Do versions matter?"
        ↓
"Yes"
```

Then show the resulting Production Model.

---

# 14. Implications

Discuss what this approach could enable:

* organizational restructuring
* file-system design
* database design
* software requirements
* workflow automation
* permissions design
* project management
* knowledge management
* onboarding
* process improvement
* system migration

The key is that all of these can derive from the same underlying model.

---

# 15. Limitations and Open Questions

Important for making this feel like a real research paper rather than a product manifesto.

Questions include:

* How do we know when the model is sufficiently complete?
* How do we prevent leading questions?
* How should subjective organizational knowledge be represented?
* How should conflicting answers be resolved?
* How much can be automated?
* How do we distinguish organizational reality from organizational aspiration?
* How should the system represent informal work?
* How do we validate the resulting model?
* Can two different models both accurately describe the same organization?
* How should the system handle organizations that are actively changing?

---

# 16. Conclusion

Return to the central idea:

> **The problem is not that organizations lack folder structures, databases, or management systems. The problem is that these structures are often designed before the underlying organization is understood.**

The Production Sandbox proposes a layer of **systematic organizational inquiry**.

Its purpose is to gather a sufficiently complete model of:

> **what exists, who interacts with it, how things relate, how work moves, how information persists, how much occurs, how long it lasts, and what happens when reality deviates from the ideal process.**

Only after that understanding exists should implementation begin.

---

## The conceptual architecture of the paper

I think the whole paper can ultimately be reduced to this:

```text
                    ┌──────────────────┐
                    │   ORGANIZATIONAL │
                    │     REALITY      │
                    └────────┬─────────┘
                             ↓
                    ┌──────────────────┐
                    │     INQUIRY      │
                    │                  │
                    │ Adaptive         │
                    │ Questions        │
                    └────────┬─────────┘
                             ↓
                    ┌──────────────────┐
                    │    KNOWLEDGE     │
                    │      MODEL       │
                    └────────┬─────────┘
                             ↓
                    ┌──────────────────┐
                    │   PRODUCTION     │
                    │      MODEL       │
                    └────────┬─────────┘
                             ↓
              ┌──────────────┼──────────────┐
              ↓              ↓              ↓
           FILES          DATABASES       SOFTWARE
              ↓              ↓              ↓
           Folders         Schema        Interfaces
```

**The Production Sandbox is the inquiry layer.**

Its job is not to tell you how to organize.

Its job is to **ask enough of the right questions that the organization can tell you how it already works**.

Then the design can be extracted from that understanding.
