---
name: first-time-setup
description: First-time setup flow for kane-post-to-wx preferences
---

# First-Time Setup

## Overview

When no EXTEND.md is found, guide user through preference setup.

**BLOCKING OPERATION**: This setup MUST complete before ANY other workflow steps. Do NOT:
- Read or inspect the article, image paths, frontmatter, or metadata.
- Run Markdown conversion, `--dry-run`, browser automation, or publishing.
- Ask about article-specific title, summary, cover, account, or publishing details beyond the setup questions below.

ONLY ask the questions in this setup flow, save EXTEND.md, then continue.

## Setup Flow

```
No EXTEND.md found
        |
        v
+---------------------+
| AskUserQuestion     |
| (all questions)     |
+---------------------+
        |
        v
+---------------------+
| Create EXTEND.md    |
+---------------------+
        |
        v
    Continue to Step 1
```

## Questions

**Language**: Use user's input language or saved language preference.

Use AskUserQuestion with ALL questions in ONE call:

### Question 1: Default Theme

```yaml
header: "Theme"
question: "Default theme for article conversion?"
options:
  - label: "default (Recommended)"
    description: "Classic layout - centered title with border, white-on-color H2 (default: blue)"
  - label: "grace"
    description: "Elegant - text shadows, rounded cards, refined blockquotes (default: purple)"
  - label: "simple"
    description: "Minimal modern - asymmetric rounded corners, clean whitespace (default: green)"
  - label: "modern"
    description: "Large rounded corners, pill headings, spacious (default: orange)"
```

### Question 2: Default Color

```yaml
header: "Color"
question: "Default color preset? (theme default if not set)"
options:
  - label: "Theme default (Recommended)"
    description: "Use the theme's built-in default color"
  - label: "blue"
    description: "#0F4C81 经典蓝"
  - label: "red"
    description: "#A93226 中国红"
  - label: "green"
    description: "#009874 翡翠绿"
```

Note: User can choose "Other" to type any preset name (vermilion, yellow, purple, sky, rose, olive, black, gray, pink, orange) or hex value.

### Question 3: Default Publishing Method

```yaml
header: "Method"
question: "Default publishing method?"
options:
  - label: "api (Recommended)"
    description: "Fast, requires API credentials (AppID + AppSecret)"
  - label: "browser"
    description: "Uses an isolated ego-browser task space and your login session"
  - label: "remote-api"
    description: "Fast, tunnels WeChat API calls through SSH to a server whose IP is on the WeChat allowlist"
```

If the user selects `remote-api`, prompt for `remote_publish_host` and (optionally) `remote_publish_user`, `remote_publish_identity_file`. These can also be filled in later by editing EXTEND.md.

### Question 4: Default Author

```yaml
header: "Author"
question: "Default author name for articles?"
options:
  - label: "No default"
    description: "Leave empty, specify per article"
```

Note: User will likely choose "Other" to type their author name.

### Question 5: Open Comments

```yaml
header: "Comments"
question: "Enable comments on articles by default?"
options:
  - label: "Yes (Recommended)"
    description: "Allow readers to comment on articles"
  - label: "No"
    description: "Disable comments by default"
```

### Question 6: Fans-Only Comments

```yaml
header: "Fans only"
question: "Restrict comments to followers only?"
options:
  - label: "No (Recommended)"
    description: "All readers can comment"
  - label: "Yes"
    description: "Only followers can comment"
```

### Question 7: Save Location

```yaml
header: "Save"
question: "Where to save preferences?"
options:
  - label: "Project (Recommended)"
    description: ".kane-skills/ (this project only)"
  - label: "User"
    description: "~/.kane-skills/ (all projects)"
```

## Save Locations

| Choice | Path | Scope |
|--------|------|-------|
| Project | `.kane-skills/kane-post-to-wx/EXTEND.md` | Current project |
| User | `~/.kane-skills/kane-post-to-wx/EXTEND.md` | All projects |

## After Setup

1. Create directory if needed
2. Write EXTEND.md
3. Confirm: "Preferences saved to [path]"
4. Continue to Step 0 (load the saved preferences)

## EXTEND.md Template

### Single Account (Default)

```md
default_theme: [default/grace/simple/modern]
default_color: [preset name, hex, or empty for theme default]
default_publish_method: [api/browser/remote-api]
default_author: [author name or empty]
need_open_comment: [1/0]
only_fans_can_comment: [1/0]
chrome_profile_path:

# Personal style is the default profile. It inherits the default theme.
style_profile: personal
style_font_family: -apple-system-font, BlinkMacSystemFont, Helvetica Neue, PingFang SC, Microsoft YaHei, sans-serif
style_font_size: 16px
style_line_height: 1.75
style_paragraph_spacing: 1.5em 8px
style_heading: filled
style_blockquote: soft
style_code_theme: github
style_mac_code_block: 1
style_show_line_number: 0

# Remote API publishing — only fill in if default_publish_method is remote-api
# or you plan to pass --remote on the CLI.
remote_publish_host:
remote_publish_user:
remote_publish_port:
remote_publish_identity_file:
remote_publish_known_hosts_file:
remote_publish_strict_host_key_checking:
remote_publish_connect_timeout:
remote_publish_proxy_jump:
```

Raw `ssh` / `scp` options are intentionally not supported; only the typed keys above are honored. Authentication is SSH key only.

### Multi-Account

```md
default_theme: [default/grace/simple/modern]
default_color: [preset name, hex, or empty for theme default]
style_profile: personal
style_font_family: -apple-system-font, BlinkMacSystemFont, Helvetica Neue, PingFang SC, Microsoft YaHei, sans-serif
style_font_size: 16px
style_line_height: 1.75
style_paragraph_spacing: 1.5em 8px
style_heading: filled
style_blockquote: soft
style_code_theme: github
style_mac_code_block: 1
style_show_line_number: 0

accounts:
  - name: [display name]
    alias: [short key, e.g. "kane"]
    default: true
    default_publish_method: [api/browser/remote-api]
    default_author: [author name]
    need_open_comment: [1/0]
    only_fans_can_comment: [1/0]
    app_id: [WeChat App ID, optional]
    app_secret: [WeChat App Secret, optional]
    # Remote API publishing (optional, per-account override of globals)
    remote_publish_host:
    remote_publish_user:
    remote_publish_identity_file:
  - name: [second account name]
    alias: [short key, e.g. "ai-tools"]
    default_publish_method: [api/browser/remote-api]
    default_author: [author name]
    need_open_comment: [1/0]
    only_fans_can_comment: [1/0]
```

## Adding More Accounts Later

After initial setup, users can add accounts by editing EXTEND.md:

1. Add an `accounts:` block with list items
2. Move per-account settings (author, publish method, comments) into each account entry
3. Keep global settings (theme, color) at the top level
4. Each account needs a unique `alias` (used for CLI `--account` arg and Chrome profile naming)
5. Set `default: true` on the primary account

## Modifying Preferences Later

Users can edit EXTEND.md directly or delete it to trigger setup again.
