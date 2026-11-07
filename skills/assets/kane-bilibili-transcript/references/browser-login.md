# 复用 B 站浏览器登录

1. 用户指定工具时按指定选择。否则按 **ego lite → browser-skill → Kimi WebBridge** 检查已安装工具，选第一个可连接、已登录且兼容下列接口的会话。遇到用户接管或拒绝时遵守原工具的控制状态。没有可用连接时请用户选择浏览器。
2. 按所选工具的说明打开任务页 `https://api.bilibili.com/x/web-interface/view`。该页用于发起同源请求，显示缺少参数属于正常现象。沿用原视频链接或 ID，并加上会话参数。

   | 浏览器工具 | 会话参数 |
   | --- | --- |
   | ego-browser | 按 `ego-browser skill` 将 TaskSpace 的 `p1` 打开到该地址，使用 `--ego-space <TaskSpace ID>`。 |
   | browser-skill | 使用 Agent Window 的任务页，传 `--bsk-session <session_id>`。脚本会同步会话控制状态。 |

3. 兼容的会话均未登录时，按同一优先级打开 `https://www.bilibili.com/` 并交给用户登录。交回控制权后在同一任务页返回 API 地址重试，按工具说明收尾。

凭据留在浏览器。禁止索取、读取、导出或传输 Cookie、令牌及其他凭据。只取登录状态、视频信息与字幕轨，日志和产物省略带签名的字幕地址。
