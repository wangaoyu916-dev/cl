"""
Telegram bot that gives Claude tool access to run commands on the local Mac.
Run this on the Mac you want to control. Messages sent via Telegram are
forwarded to Claude with shell-execution tools; results come back to Telegram.
"""
import os
import subprocess
import logging
import json
from pathlib import Path
from dotenv import load_dotenv
import anthropic
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
from telegram.constants import ChatAction

load_dotenv()

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

TELEGRAM_BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
WORK_DIR = os.getenv("WORK_DIR", str(Path.home()))

_allowed_raw = os.getenv("ALLOWED_USER_IDS", "")
ALLOWED_USER_IDS: set[int] = (
    {int(uid.strip()) for uid in _allowed_raw.split(",") if uid.strip()}
    if _allowed_raw.strip()
    else set()
)

claude = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

conversations: dict[int, list[dict]] = {}

SYSTEM_PROMPT = f"""你是运行在用户 Mac 上的智能助手，能够执行 shell 命令、读写文件、进行数据分析。

当前工作目录：{WORK_DIR}

能力：
- 执行任意 shell 命令（Python、bash、open 等）
- 读取和写入文件
- 列出目录内容
- 运行数据分析脚本

原则：
- 执行命令前先告知用户你要做什么
- 如果命令有风险（删除文件、修改系统配置等），先确认
- 优先用中文回复
- 对于数据分析任务，主动展示中间结果
"""

TOOLS = [
    {
        "name": "run_command",
        "description": "在 Mac 上执行 shell 命令，返回 stdout、stderr 和退出码",
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "要执行的 shell 命令"},
                "working_dir": {
                    "type": "string",
                    "description": "执行命令的目录，默认为 WORK_DIR",
                },
                "timeout": {
                    "type": "integer",
                    "description": "超时秒数，默认 60",
                    "default": 60,
                },
            },
            "required": ["command"],
        },
    },
    {
        "name": "read_file",
        "description": "读取文件内容",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "文件路径（绝对或相对于 WORK_DIR）"},
                "max_chars": {
                    "type": "integer",
                    "description": "最多读取字符数，默认 20000",
                    "default": 20000,
                },
            },
            "required": ["path"],
        },
    },
    {
        "name": "write_file",
        "description": "写入文件内容（会覆盖已有文件）",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "文件路径"},
                "content": {"type": "string", "description": "写入的内容"},
            },
            "required": ["path", "content"],
        },
    },
    {
        "name": "list_directory",
        "description": "列出目录中的文件和子目录",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "目录路径，默认为 WORK_DIR",
                    "default": "",
                },
            },
        },
    },
]


def _resolve(path: str) -> Path:
    p = Path(path)
    return p if p.is_absolute() else Path(WORK_DIR) / p


def handle_tool(name: str, inputs: dict) -> str:
    try:
        if name == "run_command":
            cwd = inputs.get("working_dir") or WORK_DIR
            timeout = inputs.get("timeout", 60)
            result = subprocess.run(
                inputs["command"],
                shell=True,
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=timeout,
            )
            parts = []
            if result.stdout.strip():
                parts.append(f"stdout:\n{result.stdout.strip()}")
            if result.stderr.strip():
                parts.append(f"stderr:\n{result.stderr.strip()}")
            parts.append(f"exit_code: {result.returncode}")
            return "\n\n".join(parts)

        if name == "read_file":
            p = _resolve(inputs["path"])
            max_chars = inputs.get("max_chars", 20000)
            text = p.read_text(errors="replace")
            if len(text) > max_chars:
                text = text[:max_chars] + f"\n\n[截断，共 {len(text)} 字符]"
            return text

        if name == "write_file":
            p = _resolve(inputs["path"])
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(inputs["content"])
            return f"已写入 {p}"

        if name == "list_directory":
            p = _resolve(inputs.get("path") or "")
            entries = sorted(p.iterdir(), key=lambda x: (x.is_file(), x.name))
            lines = [
                f"{'[DIR] ' if e.is_dir() else '      '}{e.name}"
                for e in entries
            ]
            return "\n".join(lines) or "（空目录）"

    except subprocess.TimeoutExpired:
        return "命令超时"
    except Exception as e:
        return f"错误：{e}"

    return "未知工具"


def _is_allowed(user_id: int) -> bool:
    return not ALLOWED_USER_IDS or user_id in ALLOWED_USER_IDS


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_allowed(update.effective_user.id):
        return
    conversations.pop(update.effective_chat.id, None)
    await update.message.reply_text(
        f"已连接到 Mac（工作目录：{WORK_DIR}）\n"
        "你可以让我执行命令、分析数据、读写文件。\n"
        "发送 /clear 清除对话记录，/pwd 查看当前目录。"
    )


async def clear(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_allowed(update.effective_user.id):
        return
    conversations.pop(update.effective_chat.id, None)
    await update.message.reply_text("对话记录已清除。")


async def pwd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_allowed(update.effective_user.id):
        return
    await update.message.reply_text(f"工作目录：{WORK_DIR}")


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_allowed(update.effective_user.id):
        await update.message.reply_text("无访问权限。")
        return

    chat_id = update.effective_chat.id
    user_text = update.message.text

    history = conversations.setdefault(chat_id, [])
    history.append({"role": "user", "content": user_text})

    await context.bot.send_chat_action(chat_id=chat_id, action=ChatAction.TYPING)

    # Agentic loop: Claude may call tools multiple times before final reply
    while True:
        try:
            response = claude.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=8096,
                system=SYSTEM_PROMPT,
                tools=TOOLS,
                messages=history,
            )
        except anthropic.APIError as e:
            logger.error("API error: %s", e)
            await update.message.reply_text(f"API 错误：{e}")
            return

        # Collect all text content to send
        text_parts = [b.text for b in response.content if b.type == "text" and b.text.strip()]
        if text_parts:
            for chunk in _split("\n".join(text_parts), 4096):
                await update.message.reply_text(chunk)

        if response.stop_reason != "tool_use":
            # Done — record assistant turn and exit loop
            history.append({"role": "assistant", "content": response.content})
            break

        # Execute tool calls
        tool_results = []
        for block in response.content:
            if block.type != "tool_use":
                continue
            await context.bot.send_chat_action(chat_id=chat_id, action=ChatAction.TYPING)
            logger.info("Tool call: %s %s", block.name, json.dumps(block.input, ensure_ascii=False))
            output = handle_tool(block.name, block.input)
            # Show user what's running (brief preview)
            preview = f"`{block.input.get('command', block.name)}`" if block.name == "run_command" else f"[{block.name}]"
            await update.message.reply_text(f"执行：{preview}", parse_mode="Markdown")
            if len(output) < 2000:
                for chunk in _split(f"```\n{output}\n```", 4096):
                    await update.message.reply_text(chunk, parse_mode="Markdown")
            tool_results.append({"type": "tool_result", "tool_use_id": block.id, "content": output})

        history.append({"role": "assistant", "content": response.content})
        history.append({"role": "user", "content": tool_results})


def _split(text: str, limit: int) -> list[str]:
    if len(text) <= limit:
        return [text]
    chunks = []
    while text:
        chunks.append(text[:limit])
        text = text[limit:]
    return chunks


def main() -> None:
    app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("clear", clear))
    app.add_handler(CommandHandler("pwd", pwd))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    logger.info("Bot started on Mac, work_dir=%s", WORK_DIR)
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
