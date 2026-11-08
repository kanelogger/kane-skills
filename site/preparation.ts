export const preparation: Record<string, [zh: string, en: string]> = {
  "article-analyzer": [
    "给出可读取的原文或全文链接，并说明你更关心论证、事实核验还是行动启示。",
    "Provide the full text or a readable link. Say whether you need an argument map, a fact audit, or implications for action.",
  ],
  "kane-explainer": [
    "给出原文、文件或会话范围，补充读者已有的知识和最想弄懂的问题。",
    "Share a source, file, or conversation range. Describe what readers already know and what they need explained.",
  ],
  "concept-fable": [
    "指定想解释的概念及其领域。有理论出处或争议时，一并给出可核对的资料。",
    "Name the concept and its field. Share any sources that clarify the theory or disputed interpretations.",
  ],
  "douban-dice-review": [
    "给出片名或电影素材。随机掷骰脚本可用 Node.js 或 Bun 运行。",
    "Provide the film title or source material. The dice script runs on Node.js or Bun.",
  ],
  "subtext-article": [
    "给出已有字幕或转写文本，如 SRT、VTT 或纯文本。需要先转写音视频时，请先准备转写稿。",
    "Provide existing captions or a transcript such as SRT, VTT, or plain text. Have any audio or video transcribed first.",
  ],
  "document-clarifier": [
    "提供完整成稿及目标读者。有术语表或引用规范时，请一并给出。",
    "Share the complete draft and its intended readers. Include any glossary or citation conventions.",
  ],
  "kane-translate": [
    "提供正文、可读文件或 HTTPS 链接，注明目标语言。可附术语表和风格要求。",
    "Provide text, a readable file, or an HTTPS link and name the target language. Add a glossary or style requirements if available.",
  ],
  "merge-drafts": [
    "准备至少两份稿件，并指出需要保留的结构或材料。源稿会保留。",
    "Supply at least two drafts and identify any structure or material you want to retain. The originals are preserved.",
  ],
  "blog-checker": [
    "提供完整的中文技术文章。只给片段时，审查限于可见内容。",
    "Share the complete Chinese technical article. With an excerpt, the review covers only the material provided.",
  ],
  "kane-bilibili-transcript": [
    "提供视频链接或 BV 号。视频须已有字幕轨，受限字幕可能需要已登录的 B 站浏览器会话。",
    "Provide a video URL or BV ID. The video needs an existing caption track. Restricted tracks may require a signed-in Bilibili session.",
  ],
  "kane-youtube-transcript": [
    "提供视频链接或 ID，选择字幕语言和格式。视频须有可访问的 YouTube 字幕轨。",
    "Provide a video URL or ID, along with the subtitle language and format. The video needs an accessible YouTube caption track.",
  ],
  "kane-compress-image": [
    "提供本地静态图片或目录，以及期望的格式和质量。脚本使用 Bun 和 Sharp。",
    "Provide local still images or a directory, plus your preferred format and quality. The script uses Bun and Sharp.",
  ],
  "kane-url-to-markdown": [
    "提供 HTTPS 链接及可读正文。动态或登录页需要浏览器会话，直接运行保存脚本时要指定输入方式。",
    "Provide an HTTPS URL and accessible article text. Dynamic or gated pages need a browser session. Choose an input mode when running the save script directly.",
  ],
  "kane-post-to-wx": [
    "提供成稿和素材。文章预览使用 Bun 1.3.8 或更新版本，写入草稿或发表需要已登录的公众号后台。",
    "Provide a finished draft and assets. Article previews use Bun 1.3.8 or later. Saving drafts or publishing requires a signed-in Official Account.",
  ],
  "kane-post-to-x": [
    "提供成稿和素材。线上操作需要已登录的 X 账号，长文发表还取决于该账号的 Articles 权限。",
    "Provide a finished draft and assets. Online steps need a signed-in X account. Publishing an Article also depends on the account’s Articles access.",
  ],
  "kane-post-to-weibo": [
    "准备正文和本地媒体文件。网页交接需要已登录的微博账号，头条文章本地转换使用 Bun 1.3.8 或更新版本。",
    "Prepare the text and local media files. Browser handoff needs a signed-in Weibo account. Local Article conversion uses Bun 1.3.8 or later.",
  ],
  "requirement-explorer": [
    "先提供原始业务需求、涉及的角色和已知约束，随后确认项目特有的规则与边界。",
    "Start with the business need, the people involved, and known constraints. Then confirm project-specific rules and boundaries.",
  ],
  "github-reuse-scout": [
    "说明目标需求、项目目录和技术约束。搜索和检出脚本使用 Python 3.9 或更新版本、curl 和 Git。",
    "Describe the need, project directory, and technical constraints. Search and checkout scripts use Python 3.9 or later, curl, and Git.",
  ],
  "it-system-skill-distiller": [
    "提供系统目录、现有资料和输出位置。动态验证还需要明确测试环境和操作权限。",
    "Provide the system directory, existing material, and an output location. Dynamic verification also needs a test environment and defined permissions.",
  ],
  "simplify-codebase": [
    "指定仓库或子系统、关注的复杂度，以及可运行的验证命令。可以先审计，再决定是否改动。",
    "Name the repository or subsystem, the complexity to investigate, and available verification commands. Start with an audit if you want to review the evidence first.",
  ],
  "git-commit-push": [
    "指定本次任务的改动范围。需要推送时，明确授权并提供可用的 Git 上游。",
    "Identify the changes belonging to this task. Pushing requires explicit permission and a working Git upstream.",
  ],
  "kane-task-retro": [
    "提供可见会话或相关片段，尽量附上原始目标、交付物和验收记录。",
    "Provide a visible conversation or relevant excerpts. Include the original goal, deliverables, and acceptance evidence where available.",
  ],
  "kane-task-cleanup": [
    "明确允许清理的任务和目录。停止后台进程需要另外授权。",
    "Identify the task and directories you want reviewed. Stopping background processes requires separate authorization.",
  ],
}
