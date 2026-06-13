# cl — Claude × Telegram Bot（Mac 远程控制）

通过 Telegram 远程控制 Mac，让 Claude 执行命令、做数据分析。Bot 在 Mac 本地运行，Claude 可以读写文件、跑脚本、调用数据分析工具。

## 快速开始

### 1. 创建 Telegram Bot

1. 在 Telegram 搜索 [@BotFather](https://t.me/BotFather)
2. 发送 `/newbot`，按提示设置名称和用户名
3. 复制获得的 Bot Token

### 2. 获取 Anthropic API Key

前往 [console.anthropic.com](https://console.anthropic.com) 创建 API Key。

### 3. 查询你的 Telegram 用户 ID（强烈建议）

向 [@userinfobot](https://t.me/userinfobot) 发任意消息，它会返回你的数字 ID。

### 4. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`：

```env
TELEGRAM_BOT_TOKEN=123456:ABC-xxx
ANTHROPIC_API_KEY=sk-ant-xxx
ALLOWED_USER_IDS=你的TelegramID        # 强烈建议填写，防止他人控制你的Mac
WORK_DIR=/Users/yourname/projects/anda  # Bot 的默认工作目录
```

### 5. 安装依赖并运行

```bash
pip install -r requirements.txt
python bot.py
```

建议用 `tmux` 或 `nohup` 保持后台运行：

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