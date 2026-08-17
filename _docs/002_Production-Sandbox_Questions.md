Exactly. I’d make that distinction **very explicit**.

The Production Sandbox is **not the place where the user designs the organization**. It is the place where the system **interviews the user about reality**.

The user describes how the business works. The system extracts the organizational model. Then a separate design layer can turn that model into folders, databases, software, permissions, workflows, etc.

### The fundamental pipeline

```text
REALITY
  ↓
QUESTIONS
  ↓
ANSWERS
  ↓
ORGANIZATIONAL MODEL
  ↓
DESIGN
  ↓
IMPLEMENTATION
```

The Sandbox occupies the **Questions → Answers → Model** portion.

---

## So the Sandbox should feel like an interview

Not:

> "Design your folder structure."

Not:

> "Drag departments onto a canvas."

Not:

> "Create an org chart."

Instead:

> **How does your work actually happen?**

And then systematically interrogate it.

### What do you work with?

* What are the major things your organization produces, manages, or interacts with?
* Which of these are ongoing?
* Which are temporary?
* Which are created repeatedly?
* Which accumulate over time?

### How are things related?

* Does one thing contain many others?
* Can one thing belong to multiple things?
* Do things share information?
* What must remain associated?

### How does work happen?

* What starts the process?
* What happens next?
* Where does work move?
* Where does it stop?
* Can it go backward?
* Does the process repeat?

### Who is involved?

* Who creates the work?
* Who modifies it?
* Who reviews it?
* Who approves it?
* Who needs to see it?
* Who is responsible when something goes wrong?

### How does it change?

* Does work have stages?
* Are previous stages important?
* Are revisions common?
* Are decisions permanent?
* Can something be reopened?

### How much?

* How many things are created?
* How frequently?
* How quickly does information accumulate?
* How long does it remain relevant?

### How long?

* How long does the work last?
* How long do relationships last?
* Does work recur?
* Do old things need to be found years later?

### Where are the boundaries?

* Where does one team's work end and another's begin?
* What crosses that boundary?
* What stays with the originating team?
* What needs to be shared?

### What happens when things go wrong?

* What happens when a project stops?
* What happens when it restarts?
* What happens when responsibility changes?
* What happens when something is duplicated?
* What happens when something needs to be recovered?

---

# The important part: don't ask implementation questions

The Sandbox should have a kind of **implementation firewall**.

For example:

**Bad question:**

> "Should each department have its own folder?"

That's already designing.

**Good question:**

> "Do departments have independent workflows?"

Then perhaps:

> "Do those workflows require different information?"

> "Does work move between departments?"

> "Does each department need to manage its work independently?"

Now the eventual designer can infer:

> Departmental boundaries are organizationally meaningful.

And *then* decide whether that means folders, database entities, permissions, applications, or something else.

---

## Every question should reveal a property

This could be the core internal architecture.

The user answers:

> "We have about 50 active projects at any given time."

The Sandbox extracts:

```text
PROPERTY
active_work_items = project
active_volume ≈ 50
```

They answer:

> "Projects usually last 1–3 years."

```text
lifecycle = long
duration = 1–3 years
```

They answer:

> "Architecture, interiors, and visualization all work on the same project."

```text
work_unit = project
multiple_departments = true
cross_department_work = true
```

They answer:

> "We often need to find what a client said six months ago."

```text
communication = persistent
communication_history = required
temporal_retrieval = required
```

The user never sees those as design decisions.

They're simply **facts about the organization**.

---

# Then the output should be a "Production Model"

At the end, the Sandbox could produce something like:

```text
PRODUCTION MODEL

Primary Work Unit
    Project

Persistent Relationships
    Client → Project
    Project → Department
    Project → Deliverable

Work Characteristics
    Long-lived
    Repetitive
    Multi-department
    Iterative
    High-volume

Workflow Characteristics
    Sequential
    Cross-department
    Review-driven
    Revision-heavy

Information Characteristics
    Persistent
    Historical
    Versioned
    Shared

Organizational Characteristics
    Departmental responsibility
    Shared project context
    Multiple levels of access

Scale
    ~50 active projects
    Hundreds annually
    Multi-year retention
```

**That is the deliverable from the Sandbox.**

Not a folder tree.

Not a database.

Not an org chart.

It's the **organizational specification from which those things can be designed.**

---

# This also gives you a very clean product architecture

You could eventually have:

### 01 — Production Sandbox

**Discover**

> Ask questions about how the organization actually works.

### 02 — Production Model

**Understand**

> Convert answers into an explicit organizational model.

### 03 — Design Studio

**Design**

> Turn the model into possible organizational structures.

### 04 — Implementation

**Build**

> Generate folders, databases, applications, permissions, workflows, etc.

So:

```text
┌─────────────────────┐
│ PRODUCTION SANDBOX  │
│                     │
│ "Tell us how work   │
│  actually happens." │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│  PRODUCTION MODEL   │
│                     │
│ "This is what your  │
│  organization is."  │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│   DESIGN ENGINE     │
│                     │
│ "Here are ways to   │
│  organize it."      │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│   IMPLEMENTATION    │
│                     │
│ Files / DB / Apps / │
│ Permissions / Flow  │
└─────────────────────┘
```

I think that separation is **the key idea**.

The Sandbox shouldn't even know that the eventual answer might be a folder structure. It should be capable of describing an organization so precisely that **folder structure becomes merely one possible projection of the resulting model.**
