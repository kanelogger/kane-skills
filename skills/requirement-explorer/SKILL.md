---
name: requirement-explorer
description: 引导业务专家完成软件需求探索、需求确认和需求文档生成。Use when the user wants to turn raw business needs into a structured software requirements document, asks for 需求探索、需求分析、需求访谈、需求确认、软件需求文档、业务对象/业务功能/流程/岗位角色梳理, or needs a requirements document suitable for later ontology/modeling work.
---

# Requirement Exploration

将一句话或一段原始业务需求，推进成一份可用于后续本体建模的软件需求文档。

## Required Resources

Load these files based on the task:

- `prompt/system-fragment.md`: Read before running an interactive requirement-exploration session. It contains the operational role, A/B confirmation rules, staged interview flow, final-output logic, and hard constraints.
- `knowledge/requirement-spec.md`: Read before drafting, reviewing, or finalizing a requirements document. It defines the six-part document structure, ID scheme, required fields, Mermaid requirements, and completeness checklist.
- `knowledge/exploration-prompt.md`: Read when the user asks to inspect, reuse, or refine the original exploration methodology, or when `prompt/system-fragment.md` is insufficient.
- `data/config.yaml`: Read when you need exact stage names, question limits, section list, completeness checklist, or Word-export defaults.
- `capability/tools.yaml`: Read when an environment provides matching requirement-service tools, or when you need the intended tool contract.
- `skill.manifest.yaml`: Treat as legacy/source-platform metadata. Do not use it as the Codex skill entry point.

## Core Workflow

1. Receive the raw business need and restate the understood scope in business language.
2. Identify high-level business domains, business objects, business functions, and end-to-end processes.
3. Ask the user to confirm the scope before detailed drafting.
4. Explore in this order:
   - Business objects
   - Business functions and rules
   - Scenarios, end-to-end processes, and approval flows
   - Roles, permissions, and data-scope rules
5. For each stage, draft first with common industry assumptions, then ask only for enterprise-specific information that cannot be safely inferred.
6. Persist the evolving draft in the conversation or available artifact/tooling after each confirmation.
7. Run the completeness checklist before calling the document complete.
8. Produce the final Markdown requirements document only when pending confirmations are resolved, or explicitly include unresolved items in Appendix B.

## Decision Rules

Classify every requirement detail before drafting:

- `A class`: Common domain knowledge or standard industry practice. Draft it directly, label it as `[AI自动补全]`, and ask the user to confirm or modify.
- `B class`: Enterprise-specific facts that would create real business-logic errors if guessed. Ask explicitly, record unanswered items as `[待确认]`, and add them to Appendix B.

Always treat these as B-class confirmations:

- Whether each core business document needs manual approval.
- Whether each automatic downstream step is synchronous waiting or asynchronous triggering.
- What happens to child or referenced objects when a parent is deleted or voided.
- Data visibility ranges for each role on each query/list function.
- Actual job titles, organization levels, and role names.
- Concrete business definitions for amount, ratio, deadline, tax, threshold, and special internal terms.

## Document Contract

Generate Markdown using the six-part structure from `knowledge/requirement-spec.md`:

1. Scenario and process descriptions
2. Business function descriptions, including rules
3. Business object descriptions
4. Role descriptions
5. Appendix A: glossary
6. Appendix B: pending clarification list

Use the required ID patterns:

- Business objects: `OBJ-{DOMAIN}-{NNN}`
- Business functions: `FUNC-{DOMAIN}-{NNN}`
- Business rules: `RULE-{DOMAIN}-{NNN}`
- End-to-end processes: `PROC-{DOMAIN}-{NNN}`
- Approval flows: `APPR-{DOMAIN}-{NNN}`
- Roles: `ROLE-{ROLE}`

Use Mermaid source blocks for process and approval diagrams. Do not replace Mermaid with static images in Markdown.

## Tool Handling

`capability/tools.yaml` describes the original platform's intended tools:

- `save_requirement_draft`
- `check_completeness`
- `generate_final_document`
- `render_mermaid`
- `export_to_word`
- `query_requirement_documents`

If tools with these exact capabilities are available, use them according to `capability/tools.yaml`.

If they are not available, do not pretend tool calls occurred. Maintain the draft as Markdown, perform the completeness check manually against `knowledge/requirement-spec.md` and `data/config.yaml`, and clearly state what remains pending.

## Boundaries

- Keep the discussion at the business-requirement level.
- Exclude UI/UX layout, widget behavior, screen composition, database table design, API design, technical architecture, performance engineering, retry/compensation mechanics, and external integration contracts unless the user explicitly asks for a separate downstream artifact.
- When users provide UI details, translate them into business actions and note that interface design belongs to a later phase.
- Use business language with domain experts. Avoid internal modeling terms such as ontology, aggregate root, M1-M5, or event model unless the user asks about the modeling handoff.

## Completion Check

Before calling a requirements document complete, verify:

- Every process has ordered steps, function references, transition type, branch conditions, and Mermaid.
- Every core document explicitly says whether it needs approval.
- Every function has role, main object, referenced objects, preconditions, business steps, rules, post-state changes, and downstream triggers.
- Every referenced rule has a standalone `RULE` definition.
- Every object has category, attributes, constraints, relationships, and delete/void handling.
- Every role has functional permissions and data-scope rules for query/list functions.
- Appendix B has no unresolved B-class item, unless the output is explicitly a draft with pending clarifications.
