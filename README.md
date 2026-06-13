# cl — Claude × Telegram Bot

通过 Telegram 直接与 Claude 对话。

## 快速开始

### 1. 创建 Telegram Bot

1. 在 Telegram 搜索 [@BotFather](https://t.me/BotFather)
2. 发送 `/newbot`，按提示设置名称和用户名
3. 复制获得的 Bot Token

### 2. 获取 Anthropic API Key

前往 [console.anthropic.com](https://console.anthropic.com) 创建 API Key。

### 3. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，填入 TELEGRAM_BOT_TOKEN 和 ANTHROPIC_API_KEY
```

可选：设置 `ALLOWED_USER_IDS`（逗号分隔的 Telegram 用户 ID）来限制访问权限。  
留空则所有人均可使用。

### 4. 安装依赖并运行

```bash
pip install -r requirements.txt
python bot.py
```

## Bot 命令

| 命令 | 说明 |
|------|------|
| `/start` | 开始对话 / 清除历史 |
| `/clear` | 清除当前对话记录 |
| 任意文字 | 发送给 Claude，获取回复 |

## 功能特性

- 多轮对话：Bot 记住同一聊天窗口内的上下文
- 长消息自动分段发送（Telegram 单条限 4096 字符）
- 支持白名单限制访问人员