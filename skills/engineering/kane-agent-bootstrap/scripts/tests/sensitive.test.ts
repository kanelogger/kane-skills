import { expect, test } from "bun:test"
import { sensitiveText } from "../sensitive.ts"

test("reports supported credential formats with line numbers and no values", () => {
  const provider = `ghp_${"Fixture000".repeat(4).slice(0, 36)}`
  const basic = Buffer.from("fixture:literal-credential").toString("base64")
  const text = [
    "# Setup guide",
    "-----BEGIN OPENSSH PRIVATE KEY-----",
    `Save ${provider} in a credential store.`,
    "DATABASE_URL=postgresql://fixture:literal-credential@localhost/database",
    "Authorization: Bearer literal-bearer-credential",
    `curl -H 'Authorization: Basic ${basic}'`,
    "export OPENAI_API_KEY=literal-api-key",
    'clientSecret: "literal value with spaces"',
    '{"accessToken":"literal-json-value"}',
    "program --db-password 'literal flag argument'",
    "https://localhost/route?access_token=literal-query-value",
    "API_KEY=nullWithSuffix",
    "- password: literal-list-item",
    "api_key: |-",
    "  literal-yaml-block",
    '{"client_secret":',
    '  "literal-json-next-line"}',
  ].join("\r\n")

  expect(sensitiveText(text)).toEqual([
    { kind: "private_key", line: 2 },
    { kind: "provider_token", line: 3 },
    { kind: "credential_url", line: 4 },
    { kind: "authorization_header", line: 5 },
    { kind: "authorization_header", line: 6 },
    { kind: "credential_assignment", line: 7 },
    { kind: "credential_assignment", line: 8 },
    { kind: "credential_assignment", line: 9 },
    { kind: "credential_assignment", line: 10 },
    { kind: "credential_assignment", line: 11 },
    { kind: "credential_assignment", line: 12 },
    { kind: "credential_assignment", line: 13 },
    { kind: "credential_assignment", line: 14 },
    { kind: "credential_assignment", line: 16 },
  ])
})

test("permits placeholder credentials, variable references and ordinary documentation", () => {
  expect(sensitiveText([
    "Set `OPENAI_API_KEY` in your environment.",
    "Use a token: only read access is required.",
    "- Password: stored in the system keyring.",
    "API_KEY=<your API key>",
    "API_KEY=YOUR_API_KEY_HERE",
    "API_KEY=ghp_REDACTED",
    "export GITHUB_TOKEN",
    "CLIENT_SECRET=",
    "token: ${OIDC_TOKEN}",
    '"token": "${{ secrets.CI_TOKEN }}"',
    'const apiKey = process.env.API_KEY',
    "program --api-key $API_KEY --token <token> --password --verbose",
    'curl -H "Authorization: Bearer <access token>"',
    'Authorization: Bearer ${ACCESS_TOKEN}',
    "postgresql://user:<password>@localhost/database",
    "https://user:your-password@example.com/",
    "-----BEGIN PUBLIC KEY-----",
    "AWS publishes AKIAIOSFODNN7EXAMPLE in its example configuration.",
    "name: GITHUB_TOKEN",
    "password: |",
    "  <password>",
    "hostname: localhost",
  ].join("\n"))).toEqual([])
})

test("bounds metadata and deduplicates a kind on the same line", () => {
  const text = Array(70).fill('TOKEN=first-literal PASSWORD=second-literal').join("\n")
  const hits = sensitiveText(text)
  expect(hits).toHaveLength(50)
  expect(hits[0]).toEqual({ kind: "credential_assignment", line: 1 })
  expect(hits.at(-1)).toEqual({ kind: "credential_assignment", line: 50 })
})
