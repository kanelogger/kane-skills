import { afterAll, beforeAll, expect, test } from "bun:test"
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const root = join(import.meta.dir, "..")
let tmp = ""

async function run(args: string[], cwd = tmp, env: Record<string, string> = {}) {
  const proc = Bun.spawn(args, { cwd, stdout: "pipe", stderr: "pipe", env: { ...process.env, ...env, PYTHONDONTWRITEBYTECODE: "1" } })
  const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited])
  return { out, err, code }
}

function skill(path: string) {
  return join(tmp, "skills", path)
}

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), "kane skills test-"))
  for (const file of ["skills", "docs", "README.md", "README-CN.md", "LICENSE"]) {
    await cp(join(root, file), join(tmp, file), { recursive: true, filter: path => !path.endsWith("node_modules") && !path.endsWith(".DS_Store") })
  }
})

afterAll(async () => {
  await rm(tmp, { recursive: true, force: true })
})

test("all 14 packages pass static checks after copying outside the repository", async () => {
  const res = await run([process.execPath, join(root, "scripts/check-skills.ts"), tmp])
  expect(res.code).toBe(0)
  expect(res.out).toContain("OK: 14 skills")
})

test("checker rejects noncanonical user-input rules and escaping links", async () => {
  const path = skill("writing/document-clarifier/SKILL.md")
  const old = await readFile(path, "utf8")
  try {
    await writeFile(path, old.replace("## User Input Tools", "## 用户输入工具") + "\n[bad](../../../README.md)\n")
    const res = await run([process.execPath, join(root, "scripts/check-skills.ts"), tmp])
    expect(res.code).toBe(1)
    expect(res.err).toContain("exactly one User Input Tools")
    expect(res.err).toContain("local link escapes skill")
  } finally {
    await writeFile(path, old)
  }
})

test("GitHub downloads enforce HTTPS, redirect limits, timeout and JSON content type", async () => {
  const res = await run(["python3", "-c", `
import importlib.util, subprocess
from types import SimpleNamespace
from unittest.mock import patch
spec = importlib.util.spec_from_file_location("search", "${skill("engineering/github-reuse-scout/scripts/search_candidates.py")}")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
with patch.dict(m.os.environ, {"GITHUB_TOKEN": "fixture-only"}):
    with patch.object(m.subprocess, "run", return_value=SimpleNamespace(returncode=0, stdout='{"items": []}\\napplication/json; charset=utf-8', stderr="")) as call:
        assert m.fetch_with_curl("a & b", 3) == []
        args = call.call_args.args[0]
        assert isinstance(args, list)
        for flag, value in [("--proto", "=https"), ("--proto-redir", "=https"), ("--max-redirs", "5"), ("--max-time", "30")]:
            assert args[args.index(flag) + 1] == value
        assert call.call_args.kwargs["timeout"] == 31
        assert "a%20%26%20b" in args[-1]
    for response in ['{"items": []}\\ntext/html', 'not-json\\napplication/json', '[]\\napplication/json', '{"items": 3}\\napplication/json']:
        with patch.object(m.subprocess, "run", return_value=SimpleNamespace(returncode=0, stdout=response, stderr="")):
            assert m.fetch_with_curl("test", 3) is None
    with patch.object(m.subprocess, "run", side_effect=subprocess.TimeoutExpired("curl", 31)):
        assert m.fetch_with_curl("test", 3) is None
`])
  expect(res.code).toBe(0)
})

test("GitHub cache merges, scoring and explicit filtered inspections work offline", async () => {
  const dir = join(tmp, "scout-project")
  const reuse = join(dir, ".reuse")
  await mkdir(reuse, { recursive: true })
  const repo = (name: string, archived = false) => ({ full_name: name, html_url: `https://github.com/${name}`, license: "MIT", stargazers_count: 100, pushed_at: new Date().toISOString(), language: "TypeScript", archived, size: 100 })
  await writeFile(join(reuse, "search-cache.json"), JSON.stringify({ fixture: { items: [repo("owner/first"), repo("owner/selected"), repo("owner/archived", true)] } }))
  const base = skill("engineering/github-reuse-scout/scripts")
  expect((await run(["python3", join(base, "search_candidates.py"), "--query", "fixture", "--workdir", dir, "--sleep", "0"])).code).toBe(0)
  expect((await run(["python3", join(base, "score_candidates.py"), "--workdir", dir, "--language", "TypeScript"])).code).toBe(0)
  const scored = JSON.parse(await readFile(join(reuse, "scored.json"), "utf8"))
  expect(scored.excluded).toEqual(["owner/archived"])
  expect(scored.scored[0].breakdown.language).toBe(3)
  const cached = join(reuse, "cache/owner-selected")
  await mkdir(cached, { recursive: true })
  await writeFile(join(cached, "README.md"), "# Selected\nOffline evidence")
  const res = await run(["python3", join(base, "inspect_candidates.py"), "--repo", "owner/selected", "--workdir", dir])
  expect(res.code).toBe(0)
  const evidence = JSON.parse(await readFile(join(reuse, "evidence/owner-selected.json"), "utf8"))
  expect(evidence.readme_head).toContain("Selected")
  expect(await Bun.file(join(reuse, "evidence/owner-first.json")).exists()).toBe(false)
})

test("GitHub inspection rejects unsafe transports, traversal and symlink evidence", async () => {
  const res = await run(["python3", "-c", `
import importlib.util, subprocess, tempfile
from pathlib import Path
from unittest.mock import patch
spec = importlib.util.spec_from_file_location("inspect", "${skill("engineering/github-reuse-scout/scripts/inspect_candidates.py")}")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as tmp:
    root = Path(tmp)
    with patch.object(m.subprocess, "run") as call:
        for url in ["http://github.com/o/r", "file:///etc/passwd", "https://evil.example/o/r", "--upload-pack=bad"]:
            assert m.clone(root / "repo", url)
        call.assert_not_called()
    with patch.object(m.subprocess, "run", side_effect=subprocess.TimeoutExpired("git", 30)) as call:
        assert m.clone(root / "repo", "https://github.com/owner/repo")
        assert call.call_args.kwargs["timeout"] == 30
        assert "http.followRedirects=false" in call.call_args.args[0]
    secret = root / "private.txt"
    secret.write_text("private fixture")
    link = root / "README.md"
    link.symlink_to(secret)
    assert m.head_lines(link, 60) == ""
`])
  expect(res.code).toBe(0)
  const dir = join(tmp, "unsafe-repo")
  await mkdir(join(dir, ".reuse"), { recursive: true })
  await writeFile(join(dir, ".reuse/scored.json"), JSON.stringify({ scored: [{ full_name: "../../escape", html_url: "https://github.com/o/r" }] }))
  expect((await run(["python3", skill("engineering/github-reuse-scout/scripts/inspect_candidates.py"), "--workdir", dir])).code).toBe(1)
})

test("GitHub missing-input paths fail cleanly rather than raising NameError", async () => {
  for (const name of ["score_candidates.py", "inspect_candidates.py"]) {
    const res = await run(["python3", skill(`engineering/github-reuse-scout/scripts/${name}`), "--workdir", join(tmp, "missing")])
    expect(res.code).toBe(1)
    expect(res.err).not.toContain("Traceback")
    expect(res.err).toContain("未找到")
  }
})

test("distillation smoke runs from a copied package and preserves existing output", async () => {
  const base = skill("engineering/it-system-skill-distiller")
  const output = join(tmp, "distilled")
  const args = ["python3", join(base, "scripts/smoke_agent_run.py"), "--skill-dir", base, "--output-dir", output]
  const res = await run(args)
  expect(res.code).toBe(0)
  expect(res.out).toContain("SMOKE OK")
  await writeFile(join(output, "sentinel.txt"), "keep")
  expect((await run(args)).code).toBe(2)
  expect(await readFile(join(output, "sentinel.txt"), "utf8")).toBe("keep")
  await writeFile(join(output, "domain/unknown.md"), "[[missing-object]]")
  const invalid = await run(["python3", join(base, "scripts/validate_distilled_package.py"), output])
  expect(invalid.code).toBe(1)
  expect(invalid.out).toContain("references unknown slug")
})

test("distillation --keep leaves its generated output available after exit", async () => {
  const base = skill("engineering/it-system-skill-distiller")
  const res = await run(["python3", join(base, "scripts/smoke_agent_run.py"), "--skill-dir", base, "--keep"], tmp, { TMPDIR: tmp })
  expect(res.code).toBe(0)
  const output = res.out.match(/^SMOKE OK: .*: (.+)$/m)?.[1]
  expect(output).toBeDefined()
  expect(await Bun.file(join(output!, "validation/results.md")).exists()).toBe(true)
})

test("subtitle packaging works independently and refuses to overwrite a prior package", async () => {
  const source = join(tmp, "subtitles.srt")
  const raw = "1\n00:00:00,000 --> 00:00:01,000\n这是第一句。\n\n2\n00:00:01,000 --> 00:00:02,000\n这是第二句。\n"
  await writeFile(source, raw)
  const script = skill("writing/subtext-article/scripts/prepare_article_package.py")
  expect((await run(["python3", script, source])).code).toBe(0)
  const output = join(tmp, "subtitles_article")
  const normalized = await readFile(join(output, "01-normalized.txt"), "utf8")
  expect(normalized).toContain("这是第一句。")
  expect(normalized).toContain("这是第二句。")
  expect(normalized).not.toContain("-->")
  expect((await readdir(output)).sort()).toEqual(["00-source.srt", "01-normalized.txt"])
  expect(await readFile(join(output, "00-source.srt"), "utf8")).toBe(raw)
  await writeFile(join(output, "01-normalized.txt"), "keep existing")
  expect((await run(["python3", script, source])).code).toBe(1)
  expect(await readFile(join(output, "01-normalized.txt"), "utf8")).toBe("keep existing")
  expect(await readFile(source, "utf8")).toBe(raw)
  expect((await run(["python3", script, source, "--output-dir", join(tmp, "subtitles_article-2")])).code).toBe(0)
})

test("subtitle packages keep source-named final articles separate from source copies", async () => {
  const script = skill("writing/subtext-article/scripts/prepare_article_package.py")
  for (const [name, copy] of [["访谈.zh.srt", "00-source.srt"], ["原稿.md", "00-source.md"], ["无扩展名", "00-source.txt"], ["00-source.md", "work-00-source.md"], ["00-source.MD", "work-00-source.MD"]]) {
    const dir = await mkdtemp(join(tmp, "subtitle-package-names-"))
    const source = join(dir, name)
    const output = join(dir, "custom-package")
    const text = "仅在两个试点团队使用，尚未推广。\n"
    const raw = name.endsWith(".srt") ? `1\n00:00:00,000 --> 00:00:01,000\n${text}` : text
    await writeFile(source, raw)
    expect((await run(["python3", script, source, "--output-dir", output])).code).toBe(0)
    const final = `${name.replace(/\.[^.]+$/, "")}.md`
    await writeFile(join(output, final), "# 已核对的终稿\n", { flag: "wx" })
    expect((await readdir(output)).sort()).toEqual([copy, "01-normalized.txt", final].sort())
    expect(await readFile(source, "utf8")).toBe(raw)
    expect(await readFile(join(output, copy), "utf8")).toBe(raw)
    expect(await readFile(join(output, "01-normalized.txt"), "utf8")).toContain(text.trim())
  }
})

test("subtitle packaging normalizes the saved source snapshot after the original changes", async () => {
  const dir = await mkdtemp(join(tmp, "subtitle-package-snapshot-"))
  const source = join(dir, "transcript.txt")
  const output = join(dir, "article-package")
  const original = "这是复制时保留的原始内容。\n"
  const changed = "这是复制后修改的内容。\n"
  await writeFile(source, original)
  const res = await run(["python3", "-c", `
import sys
from pathlib import Path
sys.path.insert(0, sys.argv[1])
import prepare_article_package as package
copy_source = package.shutil.copy2
def copy_then_change(source, destination):
    result = copy_source(source, destination)
    source.write_text(sys.argv[4], encoding="utf-8")
    return result
package.shutil.copy2 = copy_then_change
print(package.prepare_package(Path(sys.argv[2]), Path(sys.argv[3])))
`, skill("writing/subtext-article/scripts"), source, output, changed])
  expect(res.code).toBe(0)
  expect(await readFile(source, "utf8")).toBe(changed)
  expect(await readFile(join(output, "00-source.txt"), "utf8")).toBe(original)
  const normalized = await readFile(join(output, "01-normalized.txt"), "utf8")
  expect(normalized).toContain(original.trim())
  expect(normalized).not.toContain(changed.trim())
})

test("subtitle packaging preserves failed normalization evidence and requires a new directory to retry", async () => {
  const script = skill("writing/subtext-article/scripts/prepare_article_package.py")
  const fixtures = [
    { name: "invalid.txt", raw: Buffer.from([0xff]) },
    { name: "empty.txt", raw: Buffer.alloc(0) },
    { name: "no-speech.srt", raw: Buffer.from("1\n00:00:00,000 --> 00:00:01,000\n\n") },
  ]
  for (const { name, raw } of fixtures) {
    const dir = await mkdtemp(join(tmp, "subtitle-package-failure-"))
    const source = join(dir, name)
    const stem = name.slice(0, name.lastIndexOf("."))
    const output = join(dir, `${stem}_article`)
    await writeFile(source, raw)
    const failed = await run(["python3", script, source])
    expect(failed.code).toBe(1)
    expect(failed.out).toBe("")
    expect(failed.err).toContain("Failed to prepare article package:")
    expect(failed.err).not.toContain("Traceback")

    const copied = join(output, `00-source${name.slice(name.lastIndexOf("."))}`)
    expect(await readFile(copied)).toEqual(raw)
    expect(await readFile(source)).toEqual(raw)
    expect(await Bun.file(join(output, "01-normalized.txt")).exists()).toBe(false)
    expect(await readdir(output)).toEqual([`00-source${name.slice(name.lastIndexOf("."))}`])

    const speech = "这次补上可以归一化的正文。"
    const repaired = name.endsWith(".srt") ? `1\n00:00:00,000 --> 00:00:01,000\n${speech}\n` : `${speech}\n`
    await writeFile(source, repaired)
    const refused = await run(["python3", script, source])
    expect(refused.code).toBe(1)
    expect(refused.err).toContain("choose a new --output-dir")
    expect(await readFile(copied)).toEqual(raw)
    expect(await Bun.file(join(output, "01-normalized.txt")).exists()).toBe(false)
    expect(await readFile(source, "utf8")).toBe(repaired)

    const retryOutput = join(dir, "retry-package")
    expect((await run(["python3", script, source, "--output-dir", retryOutput])).code).toBe(0)
    expect(await readFile(join(retryOutput, `00-source${name.slice(name.lastIndexOf("."))}`), "utf8")).toBe(repaired)
    expect(await readFile(join(retryOutput, "01-normalized.txt"), "utf8")).toContain(speech)
    expect(await readFile(source, "utf8")).toBe(repaired)
  }
})

test("dice script produces exactly six valid faces plus a matching summary", async () => {
  const res = await run([process.execPath, skill("writing/douban-dice-review/scripts/roll_dice.js")])
  expect(res.code).toBe(0)
  const lines = res.out.trim().split("\n")
  expect(lines).toHaveLength(7)
  for (const [i, line] of lines.slice(0, 6).entries()) {
    expect(line).toMatch(new RegExp(`^${i + 1}\\. .+：[1-6] - .+$`))
    expect(lines[6]).toContain(line.split(" - ")[1])
  }
})
