Yes. I’d make the categories feel **natural to a person describing their business**, rather than categories from information architecture theory.

The key is that these are **areas of reality to investigate**, not design categories.

## Production Sandbox — Question Categories

### 1. **What You Do**

**Understand the actual work.**

* What does the organization produce?
* What kinds of work happen?
* What are the major types of work?
* What is repeated?
* What is unique?
* What is the primary unit of work?

This establishes the basic **work objects**.

---

### 2. **What You Work With**

**Understand the things involved in the work.**

* Clients
* Projects
* Products
* Documents
* Assets
* Deliverables
* Vendors
* Equipment
* Resources
* People

Questions:

> What things do you create?

> What things do you receive?

> What things do you manage?

> What things exist independently of a particular piece of work?

This is essentially discovering the organization's **entities** without using technical language.

---

### 3. **Who Is Involved**

**Understand people and groups.**

* Individuals
* Teams
* Departments
* Leadership
* Clients
* Vendors
* Consultants
* External collaborators

Questions:

> Who does the work?

> Who contributes?

> Who reviews?

> Who makes decisions?

> Who needs to know?

> Who is outside the organization but participates?

---

### 4. **How Things Are Connected**

**Understand relationships.**

This is one of the most important categories.

> What belongs to what?

> What is associated with what?

> Can one thing relate to many others?

> What things are always used together?

> What things need to remain connected?

For example:

```text
Client
  ↓
Project
  ↓
Department
  ↓
Deliverable
```

The user doesn't need to know they're describing a relationship graph.

---

### 5. **How Work Happens**

**Understand workflow.**

> What happens first?

> What happens next?

> Where does work move?

> What causes the next step?

> What happens when something is finished?

> What happens when something isn't finished?

This reveals the actual **flow of production**.

---

### 6. **Who Does What**

**Understand responsibility.**

I'd keep this separate from "Who Is Involved."

You aren't just asking who exists. You're asking:

> Who is responsible for this?

> Who creates it?

> Who changes it?

> Who reviews it?

> Who approves it?

> Who is accountable when something goes wrong?

This discovers **ownership and responsibility**.

---

### 7. **How Work Changes**

**Understand states and transitions.**

> Does work go through stages?

> What are the meaningful stages?

> What causes a transition?

> Can something go backward?

> Can something be revised?

> When is something considered complete?

This uncovers things like:

```text
Idea → Working → Review → Approved → Final
```

without asking the user to design a status system.

---

### 8. **How Work Moves Between People**

**Understand handoffs.**

I'd actually give this its own category because it's so important to organizational structure.

> Does work move between teams?

> What gets handed off?

> What information goes with it?

> Who receives it?

> What does the next person need to know?

> Does the work ever come back?

This exposes **organizational boundaries and dependencies**.

---

### 9. **When Things Happen**

**Understand time.**

> How long does this work last?

> How often does it happen?

> Is it recurring?

> Are there deadlines?

> Does information remain useful after the work is finished?

> Do relationships continue after a project ends?

This captures **time, recurrence, lifecycle, and history**.

---

### 10. **How Much Happens**

**Understand scale.**

This should be surprisingly prominent.

> How many are active at once?

> How many are created each week/month/year?

> How quickly does information accumulate?

> How large can a single piece of work become?

> Does volume fluctuate?

Because the same organizational model can require radically different designs at different scales.

---

### 11. **What Needs to Be Remembered**

**Understand information persistence.**

This is less about "files" and more about **organizational memory**.

> What information needs to survive?

> What do people need to look up later?

> Do past decisions matter?

> Does communication need to be retained?

> Are previous versions important?

> Do people need to understand why something happened?

This is where things like communication history, decisions, versions, and context emerge naturally.

---

### 12. **Who Needs to See What**

**Understand access and boundaries.**

> Who needs access?

> Does everyone need the same information?

> Is some information restricted?

> Do external people participate?

> Does access change depending on the stage of work?

This gives the eventual design system information about **visibility and permissions**.

---

### 13. **What Happens When Things Go Wrong**

**Understand exceptions.**

This is a fantastic category for the Sandbox because organizations often design around the happy path.

Ask:

> What happens when a project stops?

> What happens when someone leaves?

> What happens when responsibility changes?

> What happens when something is lost?

> What happens when work needs to be restarted?

> What happens when two people create competing versions?

This reveals weaknesses in the organizational model.

---

### 14. **What Stays and What Goes**

**Understand lifecycle and retention.**

This is subtly different from time.

> What eventually becomes inactive?

> What gets archived?

> What gets deleted?

> What needs to remain forever?

> What can safely disappear?

> Can old work become active again?

This becomes extremely important when translating the model into actual systems.

---

# But I wouldn't necessarily show all 14 at once

I'd probably present them as **six intuitive "big questions"**, with the system dynamically drilling into the deeper categories.

Something like:

```text
┌──────────────────────────────────────────┐
│        UNDERSTAND YOUR PRODUCTION        │
│                                          │
│  What do you do?                         │
│  Who is involved?                        │
│  How does the work happen?               │
│  What happens to information?            │
│  How does everything change over time?   │
│  What happens when things go wrong?      │
└──────────────────────────────────────────┘
```

And internally those expand into the 14 areas.

### The six user-facing categories

**1. Work**
What do you do and what do you produce?

**2. People**
Who is involved and who is responsible?

**3. Relationships**
How are the things and people connected?

**4. Flow**
How does work move and change?

**5. Information**
What needs to be remembered, shared, or protected?

**6. Time & Scale**
How often, how much, how long, and what happens over time?

Then **Exceptions** could be a special cross-cutting category that the engine invokes whenever it detects something worth stress-testing.

---

## And importantly, "Files" should probably NOT be a category

I think this is central to your concept.

The Sandbox shouldn't ask:

> **What files do you have?**

until it absolutely needs to.

Instead:

> What do you produce?

> Who uses it?

> How does it move?

> How long does it matter?

> Who needs it?

> How is it revised?

Eventually the system can conclude:

> **This work produces persistent, versioned, department-specific artifacts that are exchanged between teams and retained for several years.**

**Now** the design system can determine that files are important.

That keeps the Production Sandbox focused on **how the organization actually operates**, rather than accidentally turning it into a file-management questionnaire.
