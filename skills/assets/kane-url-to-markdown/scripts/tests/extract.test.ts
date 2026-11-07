import { expect, spyOn, test } from "bun:test";
import { extractPage } from "../extract";

const prose = `<p>The team documented the system carefully so readers can understand the design without following navigation menus or unrelated account links. Each section explains a concrete choice, the available evidence, and the consequences for people maintaining the system.</p>
<p>The implementation keeps the original examples close to their explanations. Readers should be able to compare the working notes, identify important assumptions, and reuse the relevant steps without losing details during conversion.</p>
<p>Reviewers compared the written guidance with actual behavior and recorded the differences. A useful article preserves those observations alongside the examples rather than replacing them with a summary or removing meaningful structure.</p>`;

function page(content: string, head = "", title = "Field notes"): string {
  return `<!doctype html><html lang="en"><head><title>${title}</title>${head}</head><body><nav>Unrelated navigation</nav><article><h1>${title}</h1>${content}</article><footer>Unrelated footer</footer></body></html>`;
}

test("preserves main-content structures, code contents, links, and images", async () => {
  const code = '    const html = "<section>hello & goodbye</section>";\n    const fence = "````";\n\n    console.log(html);\n';
  const html = page(`${prose}
<h2>Design notes</h2><p>A paragraph with <em>emphasis</em> and <a href="../guide?q=one&amp;view=full">the guide</a>.</p>
<ul><li>First finding</li><li>Second finding</li></ul><ol><li>Open the notes</li><li>Compare the result</li></ol>
<table><thead><tr><th>Item</th><th>Result</th></tr></thead><tbody><tr><td>Structure</td><td>Preserved</td></tr><tr><td>Images</td><td>Linked</td></tr></tbody></table>
<pre><code class="language-ts">${code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>
<p><a href="../full/photo.png"><img src="./photo.png" alt="An annotated diagram" width="720" height="480"></a></p>`, '<base href="https://static.example.org/notes/2026/"><meta property="og:image" content="https://static.example.org/notes/2026/photo.png">');
  const article = await extractPage(html, "https://example.org/final/story");
  expect(article.title).toBe("Field notes");
  expect(article.markdown).toMatch(/^#{2,6} Design notes$/m);
  expect(article.markdown).toContain("A paragraph with");
  expect(article.markdown).toMatch(/[*_]emphasis[*_]/);
  expect(article.markdown).toMatch(/^[-*+] First finding$/m);
  expect(article.markdown).toMatch(/^\d+\.\s+Open the notes$/m);
  expect(article.markdown).toMatch(/\|\s*Item\s*\|\s*Result\s*\|/);
  expect(article.markdown).toMatch(/\|\s*Structure\s*\|\s*Preserved\s*\|/);
  expect(article.markdown).toContain(code);
  expect(article.markdown).toMatch(/^`{5,}ts$/m);
  expect(article.markdown).toContain("https://static.example.org/notes/guide?q=one&view=full");
  expect(article.markdown).toContain("![An annotated diagram](https://static.example.org/notes/2026/photo.png)");
  expect(article.markdown).toContain("https://static.example.org/notes/full/photo.png");
  expect(article.markdown).not.toContain("Unrelated navigation");
  expect(article.markdown).not.toContain("Unrelated footer");
  expect(article.markdown).not.toMatch(/^# Field notes$/m);
});

test("uses the final document URL when no base element is present", async () => {
  const article = await extractPage(page(`${prose}<p><a href="./details">Read the details</a></p><img src="../image.png" alt="Observed result" width="600" height="400">`), "https://example.org/redirected/entry");
  expect(article.markdown).toContain("https://example.org/redirected/details");
  expect(article.markdown).toContain("![Observed result](https://example.org/image.png)");
});

test("preserves supplied metadata without inventing absent author or publication date", async () => {
  const article = await extractPage(page(prose, '<meta name="author" content="Ada Lovelace"><meta property="article:published_time" content="2026-03-14T12:00:00Z"><meta property="og:site_name" content="Example Journal">'), "https://example.org/notes");
  expect(article.author).toBe("Ada Lovelace");
  expect(article.published).toMatch(/^2026-03-14/);
  expect(article.site).toBe("Example Journal");
  expect(article.language).toBe("en");
  const absent = await extractPage(page(prose), "https://example.org/notes");
  expect(absent.author).toBeUndefined();
  expect(absent.published).toBeUndefined();
});

test("preserves structured metadata placed inside the body", async () => {
  const data = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Structured notes",
    author: { "@type": "Person", name: "Grace Hopper" },
    datePublished: "2026-02-01",
    image: { "@type": "ImageObject", url: "https://example.org/cover.png" },
  });
  const article = await extractPage(page(`${prose}<img src="/cover.png" alt="Structured cover" width="720" height="480"><script type="application/ld+json">${data}</script>`, "", "Structured notes"), "https://example.org/structured");
  expect(article.author).toBe("Grace Hopper");
  expect(article.published).toMatch(/^2026-02-01/);
  expect(article.markdown).toContain("![Structured cover](https://example.org/cover.png)");
  expect(article.markdown).not.toContain("schema.org");
});

test("removes unsafe markup and URL schemes while retaining readable labels", async () => {
  const article = await extractPage(page(`${prose}
<p><a href="javascript:alert('unsafe-link')" onclick="unsafeEvent()">Unsafe link label</a> and <a href="data:text/html,unsafe-data">Data link label</a> remain readable.</p>
<p><a href="https://user:secret@example.org/private">Credential link label</a> and <a href="mailto:editor@example.org">Email the editor</a>.</p>
<img src="javascript:unsafeImage()" alt="Unsafe image"><img src="data:image/svg+xml,unsafe-svg" alt="Unsafe data image">
<img src="/safe.png" srcset="javascript:unsafeCandidate() 2x, /safe-large.png 3x" onerror="unsafeEvent()" alt="Safe diagram" width="600" height="400">
<iframe src="https://evil.example/embed" srcdoc="unsafe-frame"></iframe><object data="unsafe-object"></object><svg><script>unsafeSvg()</script></svg><script>unsafeScript()</script>`), "https://example.org/story");
  expect(article.markdown).toContain("Unsafe link label");
  expect(article.markdown).toContain("Data link label");
  expect(article.markdown).toContain("Credential link label");
  expect(article.markdown).toContain("mailto:editor@example.org");
  expect(article.markdown).toMatch(/!\[Safe diagram\]\(https:\/\/example\.org\/safe(?:-large)?\.png\)/);
  expect(article.markdown).not.toMatch(/javascript:|data:image|data:text|user:secret|unsafeEvent|unsafeScript|unsafeSvg|unsafeCandidate|unsafe-frame|unsafe-object|<iframe|<script|onerror=/i);
});

test("excludes hidden text before presentation attributes are discarded", async () => {
  const article = await extractPage(page(`${prose}
<p style="display:none">HiddenDisplayFixture</p><p style="visibility:hidden">HiddenVisibilityFixture</p>
<p class="body-hidden">HiddenStylesheetFixture</p><style>.body-hidden { display: none }</style>
<p hidden>HiddenAttributeFixture</p><p>A visible final observation.</p>`), "https://example.org/visibility");
  expect(article.markdown).toContain("A visible final observation.");
  expect(article.markdown).not.toMatch(/Hidden(?:Display|Visibility|Stylesheet|Attribute)Fixture/);
})

test("does not execute scripts or fetch APIs and page resources", async () => {
  let requests = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch() {
      requests++;
      return new Response("This resource must never be requested");
    },
  });
  const fetch = spyOn(globalThis, "fetch").mockImplementation(async () => {
    throw new Error("Extraction attempted a remote request");
  });
  try {
    const remote = server.url.origin;
    const html = page(`${prose}<script>document.querySelector('article').innerHTML = 'Injected article'; fetch('${remote}/inline')</script><script src="${remote}/script"></script><iframe src="${remote}/frame"></iframe><img src="${remote}/image" alt="Remote image" width="600" height="400">`, `<link rel="stylesheet" href="${remote}/style">`);
    const article = await extractPage(html, "https://example.org/inert");
    expect(article.markdown).toContain("The team documented the system");
    expect(article.markdown).not.toContain("Injected article");
    expect(article.markdown).toContain(`${remote}/image`);
    await expect(extractPage('<html><head><title>Remote-only post</title></head><body></body></html>', "https://x.com/example/status/123456789")).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
    expect(requests).toBe(0);
  } finally {
    fetch.mockRestore();
    server.stop(true);
  }
});

test("rejects empty content and title-only documents", async () => {
  for (const html of ["", "<html><head><title>Empty document</title></head><body></body></html>", page(""), page("<pre><code>   </code></pre>")]) {
    await expect(extractPage(html, "https://example.org/empty")).rejects.toThrow();
  }
});

test("rejects known gate and error titles instead of returning their shells", async () => {
  for (const title of ["Just a moment...", "Verify you are human", "403 Forbidden", "Attention Required! | Cloudflare", "Sign in", "Page not found"]) {
    await expect(extractPage(page("<p>Please continue to access the requested page.</p>", "", title), "https://example.org/gate")).rejects.toThrow();
  }
  await expect(extractPage('<html><head><title>Account portal</title></head><body><form><p>Sign in to continue</p><input type="password"><button>Sign in</button></form></body></html>', "https://example.org/login")).rejects.toThrow();
  await expect(extractPage('<html><body><h1>Checking your browser...</h1><p>Please wait.</p></body></html>', "https://example.org/check")).rejects.toThrow();
});

test("accepts genuine articles discussing login and CAPTCHA", async () => {
  const article = await extractPage(page(`${prose}<h2>Login and CAPTCHA</h2><p>Sign in prompts and CAPTCHA challenges should not replace the article a reader requested. This section discusses how to design those interactions accessibly.</p>`, "", "Login"), "https://example.org/security-design");
  expect(article.title).toBe("Login");
  expect(article.markdown).toContain("This section discusses");
});

test("accepts short articles with a hostname title fallback", async () => {
  const article = await extractPage('<html><body><article><p>The garden opened today. Neighbors planted three oak trees beside the public path.</p></article></body></html>', "https://journal.example.org/brief");
  expect(article.title).toBe("journal.example.org");
  expect(article.markdown).toContain("Neighbors planted three oak trees");
  expect(article.author).toBeUndefined();
  expect(article.published).toBeUndefined();
});
