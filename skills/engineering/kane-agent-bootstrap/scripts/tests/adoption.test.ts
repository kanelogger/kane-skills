import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

type Entry = { file: string; select?: string[] }
type Report = {
  schema_version: number
  command: string
  scope?: string
  status: string
  findings?: { code: string; status: string }[]
  context_index?: { status: string }
  error?: { code: string }
  commands_executed?: number
  runtime_verified?: boolean
  business_verified?: boolean
}

const cli = join(import.meta.dir, "../main.ts")
const indexPath = ".agents/context/index.json"
const workflowPath = "docs/work/handbook.md"
const lessonsPath = "docs/shared/learning-log.md"
const projectCheck = { file: "project.yml", select: ["environment", "commands", "check"] }
const packageCheck = { file: "package.json", select: ["scripts", "check"] }
const check = {
  run: "bun run check",
  definition_source: "package.json#scripts.check",
  working_directory: ".",
  prerequisites: [],
  side_effects: [],
}
let project = ""

beforeEach(async () => {
  project = await mkdtemp(join(tmpdir(), "bun-bootstrap-adoption-"))
})

afterEach(async () => {
  await rm(project, { recursive: true, force: true })
})

async function write(path: string, content: string) {
  const target = join(project, path)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, content)
}

async function index(entries: Record<string, Entry>) {
  await write(indexPath, JSON.stringify({ schema_version: 1, entries }))
}

async function manifest(command?: typeof check) {
  await write("project.yml", JSON.stringify({
    schema_version: 1,
    project: { name: "fixture" },
    environment: {
      supported_platforms: ["darwin", "linux"],
      toolchains: [],
      commands: command ? { check: command } : {},
      services: [],
      tools: [],
      variables: [],
      local_paths: {},
    },
    requirements: { filesystem: [], network: [] },
    guides: {},
  }))
}

async function linkedWorkflow() {
  await write("AGENTS.md", `# Project\n\nRead [开发工作流][workflow].\n\n[workflow]: ${workflowPath}#ship-a-change\n`)
  await write(workflowPath, "# Engineering handbook\n\n## Ship a change\n\nRun the project check and review the result. Read the [经验库][lessons].\n\n## References\n\n[lessons]: ../shared/learning-log.md#entries\n")
  await write(lessonsPath, "# Team learning log\n\n## Entries\n\nReview prior lessons before changing build tooling.\n")
}

async function packageScript() {
  await write("package.json", JSON.stringify({ scripts: { check: "bun marker.ts" } }))
  await write("marker.ts", 'await Bun.write(new URL("command-ran", import.meta.url), "unexpected")\n')
}

async function seed() {
  await linkedWorkflow()
  await manifest(check)
  await packageScript()
  await index({ "quality-check": projectCheck })
}

async function verify(code = 0, args = ["--adoption"]) {
  const proc = Bun.spawn([process.execPath, cli, "verify", project, ...args], { stdout: "pipe", stderr: "pipe", timeout: 15000 })
  const [stdout, stderr, exit] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited])
  expect(exit, `${stdout}\n${stderr}`).toBe(code)
  const report = JSON.parse(stdout) as Report
  expect(report.schema_version).toBe(1)
  expect(report.command).toBe("verify")
  return report
}

function hasFinding(report: Report, code: string) {
  expect(report.findings).toContainEqual(expect.objectContaining({ code, status: "failed" }))
}

describe("adoption verification", () => {
  test.each(["package.json", "package.json#scripts.check"])("checks the linked workflow, alternate lessons and command source %s without running the command", async definition_source => {
    await seed()
    await manifest({ ...check, definition_source })
    const report = await verify()
    expect(report.scope).toBe("adoption")
    expect(report.status).toBe("passed")
    expect(report.context_index?.status).toBe("passed")
    expect(report.commands_executed).toBe(0)
    expect(report.runtime_verified).toBe(false)
    expect(report.business_verified).toBe(false)
    expect(await Bun.file(join(project, "command-ran")).exists()).toBe(false)
  })

  test("accepts an inline workflow, root lessons and a direct package script route", async () => {
    await write("AGENTS.md", "# Project\n\n## Development workflow\n\nRead the task, then run the quality check and consult [Lessons](LESSONS.md).\n")
    await write("LESSONS.md", "# Lessons\n\nKeep changes reversible until verified.\n")
    await manifest()
    await packageScript()
    await index({ checks: packageCheck })
    expect((await verify()).status).toBe("passed")
    expect(await Bun.file(join(project, "command-ran")).exists()).toBe(false)
  })

  test("accepts a check routed to a declared Makefile recipe", async () => {
    await linkedWorkflow()
    await manifest({ ...check, run: "make test", definition_source: "Makefile#test" })
    await write("Makefile", "test:\n\ttouch command-ran\n")
    await index({ "quality-check": projectCheck })
    expect((await verify()).status).toBe("passed")
    expect(await Bun.file(join(project, "command-ran")).exists()).toBe(false)
  })

  test("requires a local check script to match the declared invocation and working directory", async () => {
    await linkedWorkflow()
    await write("tools/check.sh", "touch command-ran\n")
    await index({ "quality-check": projectCheck })
    const command = { ...check, run: "sh ./check.sh", definition_source: "tools/check.sh", working_directory: "tools" }
    await manifest(command)
    expect((await verify()).status).toBe("passed")
    await manifest({ ...command, run: "sh ./unrelated.sh" })
    hasFinding(await verify(1), "adoption_check_invalid")
    await manifest({ ...command, run: "./check.sh" })
    hasFinding(await verify(1), "adoption_check_invalid")
    expect(await Bun.file(join(project, "tools/command-ran")).exists()).toBe(false)
  })

  test("requires adoption artifacts only when opted in", async () => {
    await write("AGENTS.md", "# Project\n\nReview [environment](project.yml).\n")
    await manifest()
    const ordinary = await verify(0, [])
    expect(ordinary.scope).toBe("static_only")
    expect(ordinary.context_index).toBeUndefined()
    const adoption = await verify(1)
    hasFinding(adoption, "adoption_workflow_missing")
    hasFinding(adoption, "adoption_lessons_missing")
    hasFinding(adoption, "adoption_index_missing")
  })

  test("rejects adoption with partial path scope in either flag order", async () => {
    for (const args of [["--adoption", "--paths", "AGENTS.md"], ["--paths", "AGENTS.md", "--adoption"]]) {
      expect((await verify(2, args)).error?.code).toBe("usage")
    }
  })

  test.each([
    ["missing workflow file", "docs/work/missing.md"],
    ["missing workflow anchor", `${workflowPath}#missing`],
    ["remote workflow", "https://example.com/workflow.md"],
  ])("rejects a %s", async (_name, reference) => {
    await seed()
    await write("AGENTS.md", `# Project\n\nRead [开发工作流](${reference}).\n\nRead [经验库](${lessonsPath}).\n`)
    hasFinding(await verify(1), "adoption_workflow_reference")
  })

  test.each([
    ["missing lessons file", "docs/shared/missing.md"],
    ["missing lessons anchor", `${lessonsPath}#missing`],
    ["remote lessons", "https://example.com/lessons.md"],
  ])("rejects a %s", async (_name, reference) => {
    await seed()
    await write("AGENTS.md", `# Project\n\n## Development workflow\n\nCheck the change and read [经验库](${reference}).\n`)
    hasFinding(await verify(1), "adoption_lessons_reference")
  })

  test("ignores workflow and lessons examples inside a code fence", async () => {
    await seed()
    await write("AGENTS.md", `# Project\n\n\`\`\`markdown\n## Development workflow\n\nRead [开发工作流](${workflowPath}) and [经验库](${lessonsPath}).\n\`\`\`\n`)
    const report = await verify(1)
    hasFinding(report, "adoption_workflow_missing")
    hasFinding(report, "adoption_lessons_missing")
  })

  test("requires content in an inline workflow section", async () => {
    await seed()
    await write("AGENTS.md", `# Project\n\n## Development workflow\n\n## Reading\n\nConsult [经验库](${lessonsPath}).\n`)
    hasFinding(await verify(1), "adoption_workflow_missing")
  })

  test("requires the lesson link to be reachable from the selected workflow heading", async () => {
    await seed()
    await write(workflowPath, "# Engineering handbook\n\n## Ship a change\n\nRun the project check and review the result.\n\n## Retrospectives\n\nRead [经验库](../shared/learning-log.md#entries).\n")
    hasFinding(await verify(1), "adoption_lessons_missing")
  })

  test.each(["    ", "\\"])("ignores nonlink Markdown examples with prefix %j", async prefix => {
    await seed()
    await write("AGENTS.md", `# Project\n\n${prefix}[Workflow](${workflowPath})\n${prefix}[Lessons](${lessonsPath})\n`)
    const report = await verify(1)
    hasFinding(report, "adoption_workflow_missing")
    hasFinding(report, "adoption_lessons_missing")
  })

  test("requires a workflow section when the project points to a general README", async () => {
    await seed()
    await write("AGENTS.md", `# Project\n\nRead [Workflow](README.md) and [Lessons](${lessonsPath}).\n`)
    await write("README.md", "# Project\n\nA fixture for adoption tests.\n")
    hasFinding(await verify(1), "adoption_workflow_reference")
    await write("README.md", "# Project\n\n## Development workflow\n\nRun the quality check before handoff.\n")
    expect((await verify()).status).toBe("passed")
  })

  test("requires an index route even when a real check script exists", async () => {
    await seed()
    await index({ project: { file: "project.yml", select: ["project", "name"] } })
    hasFinding(await verify(1), "adoption_check_missing")
  })

  test("rejects an invalid context index even when the underlying check script exists", async () => {
    await seed()
    await write(indexPath, JSON.stringify({ schema_version: 2, entries: { "quality-check": projectCheck } }))
    hasFinding(await verify(1), "context_index_invalid")
  })

  test.each([
    ["unavailable", null],
    ["missing", { scripts: { lint: "bun marker.ts" } }],
    ["empty", { scripts: { check: "   " } }],
  ])("rejects a %s package check script", async (_name, data) => {
    await seed()
    if (data === null) await rm(join(project, "package.json"))
    else await write("package.json", JSON.stringify(data))
    const report = await verify(1)
    hasFinding(report, "adoption_check_invalid")
    expect(report.commands_executed).toBe(0)
    expect(await Bun.file(join(project, "command-ran")).exists()).toBe(false)
  })

  test("rejects a package check runner with an appended shell command", async () => {
    await seed()
    await manifest({ ...check, definition_source: "package.json", run: "bun run check && bun marker.ts" })
    hasFinding(await verify(1), "adoption_check_invalid")
    expect(await Bun.file(join(project, "command-ran")).exists()).toBe(false)
  })
})
