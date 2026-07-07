# article-analyzer

Analyze articles, papers, reports, essays, and long-form arguments into a structured folder of Markdown outputs.

## Use When

- The user asks for article analysis, paper scan, thought refinement, cognitive upgrade, or fact/opinion audit.
- The source is long enough to benefit from module-based analysis.
- The output should preserve evidence boundaries instead of mixing source claims with analyst interpretation.

## Output

Typical article package:

```text
article-analyzer-<slug>/
  01-deep_analysis.md
  02-thought_refine.md
  03-cognitive_upgrade.md
  99-summary.md
```

Typical paper package:

```text
article-analyzer-<slug>/
  01-paper_scan.md
  02-deep_analysis.md
  03-thought_refine.md
  04-cognitive_upgrade.md
  99-summary.md
```

## Public Notes

The skill loads only the reference prompt files required for the selected route. It should not rely on sibling skills or private workspace files.

