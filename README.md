# cl — Claude × Telegram Bot（Mac 远程控制）

通过 Telegram 远程控制 Mac，让 Claude Code 执行命令、做数据分析。  
**无需 API Key** — 使用 Claude Pro 账号即可。

## 前提条件

Mac 上需安装 Claude Code CLI 并登录：

```bash
npm install -g @anthropic-ai/claude-code
claude auth login   # 用浏览器登录你的 Claude Pro 账号
```

## 快速开始

### 1. 创建 Telegram Bot

1. 在 Telegram 搜索 [@BotFather](https://t.me/BotFather)
2. 发送 `/newbot`，按提示设置名称和用户名
3. 复制获得的 Bot Token（**不要分享给任何人**）

### 2. 查询你的 Telegram 用户 ID（强烈建议）

向 [@userinfobot](https://t.me/userinfobot) 发任意消息，它会返回你的数字 ID。

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`：

```env
TELEGRAM_BOT_TOKEN=8432888793:AAF...   # 你的 Bot Token
ALLOWED_USER_IDS=123456789             # 你的 Telegram 数字 ID（必填！）
WORK_DIR=/Users/yourname/projects/anda # 默认工作目录
```

### 4. 安装依赖并运行

```bash
pip install -r requirements.txt
python bot.py
```

后台运行：

```bash
nohup python bot.py > bot.log 2>&1 &
```

## Bot 命令

| 命令 | 说明 |
|------|------|
| `/start` | 连接 Mac，清除历史 |
| `/clear` | 清除当前对话记录 |
| `/pwd` | 查看当前工作目录 |
| 任意文字 | Claude 理解并执行 |

## 使用示例

```
你：列一下项目里的 Python 文件
Claude：[执行 ls *.py] 找到以下文件……

你：运行安达测算工具，输入数据是 input.xlsx
Claude：[执行 python anda_tool.py input.xlsx] 计算结果……

你：把结果导出成 CSV 并告诉我关键指标
Claude：[读取输出，写入 result.csv] 关键指标如下……
```

## 功能

- Claude 可执行 shell 命令（Python、bash 等）
- 可读写本地文件，支持数据分析脚本
- 多轮对话记住上下文
- 白名单保护，只允许指定用户控制 Mac
- 长输出自动分段发送