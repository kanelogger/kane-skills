# Examples

Read this file only when the user requests reference examples or when testing the skill.

## Example 1: Quick Compilation

**User Input**: "Help me write a prompt to have AI turn meeting notes into a to-do list."

**State Assessment**: Clear requirements. Skip routing, enter State 3 directly.

**Output**:

```markdown
# Context
You have received meeting notes and need to extract the action items.

# Task
Organize the task assignments from the meeting notes into a to-do list.

# Constraints
- Each to-do must include: Task description, Assignee, Deadline (if any).
- If information is missing, mark it as "To be confirmed" rather than guessing.
- Sort by priority; if the original text does not specify priority, sort chronologically.

# Output Format
Output as a Markdown task list:
- [ ] [Task Description] | Assignee: [Name] | Deadline: [Date or "To be confirmed"]
```

**Design Rationale**: Lightweight Markdown structure. Constraints focus on "no guessing" and "required fields" to avoid over-design.

---

## Example 2: Deep Optimization

**User Input**: "I want AI to help me analyze competitors and output a structured competitive analysis report."

**After State 1 Deep Alignment** (Task Routing → Perspective Suggestion → Variable Completion → Paradigm Anchoring):

**Output**:

```xml
<context>
You need to conduct a competitive analysis for a [Product Type] product to provide a basis for product decision-making.
Analysis scope: [User-specified competitor list or "Please select 3-5 direct competitors on your own"]
</context>

<task>
1. Conduct a multi-dimensional capability assessment for each competitor.
2. Identify differentiation opportunities and threats.
3. Output a structured competitive analysis report.
</task>

<constraints>
- All conclusions must be based on verifiable information, clearly citing information sources.
- Avoid subjective assumptions; use "Data shows..." instead of "I feel...".
- If certain information cannot be obtained, clearly mark "Information not public" instead of fabricating.
</constraints>

<success_criteria>
- After reading the report, readers can clearly answer: What is the core advantage of each competitor? Where is our differentiation space?
- All key conclusions are supported by information sources.
</success_criteria>

<output_format>
# Competitive Analysis Report: [Product Name]

## Analysis Summary (3-5 lines)

## Competitor Inventory
| Competitor Name | Positioning | Core Features | Target Audience |

## Detailed Analysis
### [Competitor 1]
#### Strengths
#### Weaknesses
#### Differentiation Opportunities

### [Competitor 2]
...

## Summary and Recommendations
</output_format>
```

**Design Rationale**: XML structure separates different dimensions. Emphasized verifiability constraints to prevent hallucination. Output format provides specific table and chapter structures.
