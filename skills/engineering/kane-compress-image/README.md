# kane-compress-image

将本地静态图片压缩为 WebP、PNG 或 JPEG，支持单文件、目录批处理和递归处理。默认质量 80、WebP 输出，原图始终保留。

## 使用

让 Agent 使用 `kane-compress-image`，并提供图片或目录路径。例如：「把这组图片压缩为 WebP，包含子目录，保留原图。」

也可复制整个技能目录后直接运行。需要 Bun（没有 Bun 时用 `npx -y bun`）和 Sharp；先在技能包的 `scripts/` 目录安装锁定依赖，再运行压缩命令。

若 `npx -y bun` 提示 Bun 的 `postinstall` 未运行，应先修复或正常安装 Bun，再执行压缩；macOS 可用 `brew install bun`。这属于运行时安装失败，不是图片编码失败。

```bash
bun install --cwd '<skill-dir>/scripts' --frozen-lockfile
bun '<skill-dir>/scripts/main.ts' './photo.png'
bun '<skill-dir>/scripts/main.ts' './screenshot.png' -f png -o './screenshot-small.png'
bun '<skill-dir>/scripts/main.ts' './images' -r -q 75 -o './images-small' --json
```

所有占位符需替换为实际路径。其它参数见 `--help`。始终保留原图，不需要 `--keep`，也不提供覆盖或删除原图的选项。

## 输入与输出

- 输入：静态 `.png`、`.jpg`、`.jpeg`、`.webp`、`.gif`、`.tif`、`.tiff`，或包含这些文件的目录。目录遍历跳过符号链接。
- 单文件：`photo.png` 默认生成同目录 `photo-compressed.webp`。
- 目录：`images/` 默认生成同级 `images-compressed/`；加 `-r` 包含子目录，保留相对路径并替换扩展名。
- `-o`：输入为文件时指定新文件路径，扩展名须与格式一致；输入为目录时指定新的输出目录。JPEG 接受 `.jpg` 或 `.jpeg`。
- 安全：已有文件、符号链接或输出目录一律拒绝覆盖；输出文件以独占方式创建，编码失败会清理本次未完成文件。批处理中，同一目录内同名不同扩展名等输出冲突会在写入前报错，大小写差异也按冲突处理。

## 编码与限制

| 格式 | 行为 |
| --- | --- |
| WebP（默认） | 有损编码，`-q` 为 1–100，默认 80；保留透明通道。 |
| PNG | 压缩级别 9，不做调色板量化，`-q` 不影响编码。 |
| JPEG | 有损编码，`-q` 为 1–100，默认 80；透明区域铺白底。 |

自动校正 EXIF 方向后移除 EXIF、ICC 等元数据，不裁剪、不缩放。输出可能转换位深与颜色空间，不适合作为 16 位、HDR 或印刷原始档案的替代品。动图、APNG 和多页图片明确报错，不提取首帧。只接受本地路径，不自动下载 URL。

小图或已充分压缩的图片可能变大；脚本仍保留新文件并报告真实变化，不保证目标体积或固定压缩率。

`--json` 输出统一的 `{ files, errors, summary }`：成功项含 `input`、`output`、`inputBytes`、`outputBytes`、`reductionPercent`；失败项含 `input`、`message`。汇总的字节数和压缩率只统计成功项，负压缩率表示变大。全部成功退出 0；任一失败退出 1，保留已成功的文件。参数、路径、依赖等执行前错误写入 stderr，不输出 JSON；批处理中断后应使用新的输出目录。

## 验证

安装依赖后运行技能包内的回归测试：

```bash
bun test '<skill-dir>/scripts/tests'
```

测试使用本地生成的图片，覆盖原图与旧产物保护、透明度、EXIF 方向、递归边界、输出冲突、动图和多页拒绝、部分失败清理以及真实体积统计。

## 参考

压缩格式、质量选项与批处理流程参考 [baoyu-compress-image](https://github.com/JimLiu/baoyu-skills/tree/main/skills/baoyu-compress-image)。本技能采用统一的 [Sharp](https://sharp.pixelplumbing.com/) 后端，不依赖系统上的 `sips`、`cwebp` 或 ImageMagick，并改为始终保留原图、拒绝覆盖旧产物。
