type Hit = { kind: string; line: number }

const maxHits = 50
const privateKey = /(?<!-)-{4,6}[ \t]*BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?[ \t]*-{4,6}(?!-)/
const providerPatterns = [
  /gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,}/,
  /glpat-[A-Za-z0-9_-]{20,}/,
  /npm_[A-Za-z0-9]{36,}/,
  /pypi-AgEIcHlwaS5vcmc[A-Za-z0-9_-]{40,}/,
  /(?:AKIA|ASIA)[A-Z0-9]{16}/,
  /AIza[A-Za-z0-9_-]{35}/,
  /sk-(?:proj-|svcacct-|admin-|ant-api\d+-)?[A-Za-z0-9_-]{24,}/,
  /(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/,
  /xox[baprs]-\d[0-9A-Za-z-]{10,}|xapp-\d-[0-9A-Za-z-]{15,}/,
]
const providers = new RegExp(`(?<![A-Za-z0-9_])(?:${providerPatterns.map(pattern => pattern.source).join("|")})(?![A-Za-z0-9_-])`, "g")
const urls = /\b[a-z][a-z0-9+.-]{1,30}:\/\/[^\s:/@`"']+:(?<password>[^\s/@`"']+)@[^\s<>`"']/gi
const auth = /\bauthorization["']?[ \t]*[:=][ \t]*[`"']?(?<scheme>bearer|basic)[ \t]+(?<value>[^\s`"',;)}\]>]+)/gi
const assignments = /(?:^|[\s{[(,;`?&])(?<quote>["']?)(?<name>[A-Za-z_][\w.-]*)\k<quote>[ \t]*(?<separator>:(?!:)|=(?!=|>))[ \t]*/g
const flags = /(?:^|[ \t`])--(?<name>[A-Za-z][\w-]*)(?:[ \t]*(?<separator>=)[ \t]*|[ \t]+)/g
const yamlBlock = /^[|>](?:[1-9][+-]?|[+-][1-9]?)?[ \t]*(?:#.*)?$/
const quotedValue = /^(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`([^`]*)`)/
const knownName = /(?:^|_)(?:api_?key|access_key(?:_id)?|secret_access_key|private_key|secret_key|client_key|password|passwd|passphrase|token|secret|jwt|pat|db_pwd)$/
const references = /^(?:\$(?:\{|[A-Za-z_]|\()|\{\{|%[A-Za-z_][\w]*%|(?:process\.env|import\.meta\.env|os\.environ|os\.getenv|System\.getenv|secrets|ENV|env)(?:[.\[(]|$)|(?:getenv|env)\()/
const placeholders = [
  /^(?:<[^<>\n]+>|【[^】\n]+】|\[(?:redacted|placeholder|masked)\]|[x*._•-]{3,})$/i,
  /^(?:redacted|masked|placeholder|change[-_ ]?me|replace[-_ ]?me|insert[-_ ]?here|example|sample|dummy|fake|tbd|todo|none|n\/a|%s)$/i,
  /^(?:your|replace[-_ ]with|insert|paste|enter|fill[-_ ]in)[-_ ][a-z0-9][a-z0-9_ .-]*$/i,
  /^(?:example|sample|dummy|fake|placeholder)[-_ ](?:api[-_ ]?key|token|password|secret|key)$/i,
  /^(?:api[-_ ]?key|token|password|secret|key)[-_ ](?:here|placeholder|example)$/i,
  /^(?:sk-|ghp_|glpat-|npm_|xox[baprs]-)(?:[x_.-]{3,}|(?:example|placeholder|redacted)[x_.-]*)$/i,
]
const bareType = /^(?:null|undefined|nil|true|false|string|number|boolean|unknown|any)(?![A-Za-z0-9_.-])/

function literal(value: string) {
  const text = value.trim()
  return Boolean(text && !references.test(text) && !placeholders.some(pattern => pattern.test(text)))
}

function credentialName(name: string) {
  return knownName.test(name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[-.]/g, "_").toLowerCase())
}

function isAssignment(lines: string[], index: number, match: RegExpMatchArray) {
  const { name, quote, separator } = match.groups!
  if (!credentialName(name!)) return false
  const line = lines[index]!
  if (separator === ":" && !quote && !/^\s*(?:[-+*][ \t]*|>[ \t]*)?$/.test(line.slice(0, match.index)) && !/^[{[(,]/.test(match[0])) return false
  const raw = line.slice(match.index! + match[0].length)
  const block = separator === ":" && yamlBlock.test(raw)
  const continued = separator === ":" && Boolean(quote) && !raw
  if (block || continued) {
    const indent = line.length - line.trimStart().length
    for (let next = index + 1; next < lines.length; next++) {
      const content = lines[next]!.trimStart()
      if (!content) continue
      if (block) {
        if (lines[next]!.length - content.length <= indent) return false
        if (literal(content)) return true
        continue
      }
      const quoted = quotedValue.exec(content)
      return Boolean(quoted && literal(quoted[1] ?? quoted[2] ?? quoted[3]!))
    }
    return false
  }
  const quoted = quotedValue.exec(raw)
  if (quoted) return literal(quoted[1] ?? quoted[2] ?? quoted[3]!)
  if (/^[\[{#(]|^(?:<[^<>]+>|【[^】]+】)(?=$|[\s`"',;)}\]&])/.test(raw) || references.test(raw)) return false
  if ((separator === ":" && bareType.test(raw)) || (!separator && raw.startsWith("--"))) return false
  const part = /^[^\s`"',;)}\]>&]+/.exec(raw)?.[0]
  if (!part || (separator === ":" && /^\s+[^#\]}),;`]/.test(raw.slice(part.length)))) return false
  return literal(part)
}

function basicCredential(value: string) {
  if (!/^[A-Za-z0-9+/]{4,}={0,2}$/.test(value)) return false
  const decoded = Buffer.from(value, "base64")
  const colon = decoded.indexOf(58)
  return colon >= 0 && colon < decoded.length - 1
}

function hasMatch(value: string, pattern: RegExp, check: (match: RegExpMatchArray) => boolean) {
  for (const match of value.matchAll(pattern)) if (check(match)) return true
  return false
}

export function sensitiveText(text: string): Hit[] {
  const hits: Hit[] = []
  const lines = text.split(/\r\n?|\n/)
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!
    const add = (kind: string) => {
      if (hits.length < maxHits) hits.push({ kind, line: index + 1 })
    }
    if (privateKey.test(line)) add("private_key")
    if (hasMatch(line, providers, match => match[0] !== "AKIAIOSFODNN7EXAMPLE" && literal(match[0]))) add("provider_token")
    if (hasMatch(line, urls, match => literal(match.groups!.password!))) add("credential_url")
    if (hasMatch(line, auth, match => {
      const { scheme, value } = match.groups!
      if (!literal(value!) || value!.startsWith("<")) return false
      return scheme!.toLowerCase() === "basic" ? basicCredential(value!) : value!.length >= 4 && value!.toLowerCase() !== "token"
    })) add("authorization_header")
    const assigned = (match: RegExpMatchArray) => isAssignment(lines, index, match)
    if (hasMatch(line, assignments, assigned) || hasMatch(line, flags, assigned)) add("credential_assignment")
    if (hits.length === maxHits) break
  }
  return hits
}
