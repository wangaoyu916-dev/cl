"""
Telegram bot that invokes Claude Code CLI on the local Mac.
No API key needed — uses your Claude Pro subscription via `claude auth login`.
"""
import os
import asyncio
from pathlib import Path
from dotenv import load_dotenv
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
from telegram.constants import ChatAction

load_dotenv()

TELEGRAM_BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
WORK_DIR = os.getenv("WORK_DIR", str(Path.home()))

_allowed_raw = os.getenv("ALLOWED_USER_IDS", "")
ALLOWED_USER_IDS: set[int] = (
    {int(uid.strip()) for uid in _allowed_raw.split(",") if uid.strip()}
    if _allowed_raw.strip()
    else set()
)

# Whether a CC session exists to continue (single-user assumption)
has_session: bool = False


def _is_allowed(user_id: int) -> bool:
    return not ALLOWED_USER_IDS or user_id in ALLOWED_USER_IDS


async def run_claude(message: str, continue_session: bool = False) -> str:
    global has_session

    cmd = ["claude", "--dangerously-skip-permissions", "-p", message]
    if continue_session and has_session:
        cmd = ["claude", "--continue", "--dangerously-skip-permissions", "-p", message]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=WORK_DIR,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=300)
        has_session = True
        output = stdout.decode().strip()
        if not output:
            output = stderr.decode().strip()
        return output or "（无输出）"
    except asyncio.TimeoutError:
        proc.kill()
        return "超时（5分钟），任务可能仍在后台运行。"
    except FileNotFoundError:
        return (
            "找不到 claude 命令。请先在 Mac 上安装 Claude Code：\n"
            "npm install -g @anthropic-ai/claude-code\n"
            "然后登录：claude auth login"
        )


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    global has_session
    if not _is_allowed(update.effective_user.id):
        return
    has_session = False
    await update.message.reply_text(
        f"已连接 Mac，工作目录：{WORK_DIR}\n"
        "直接发消息即可，Claude Code 会帮你执行。\n"
        "/clear 重置对话  /pwd 查看目录"
    )


async def clear(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    global has_session
    if not _is_allowed(update.effective_user.id):
        return
    has_session = False
    await update.message.reply_text("已重置，下条消息将开启新会话。")


async def pwd(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_allowed(update.effective_user.id):
        return
    await update.message.reply_text(f"工作目录：{WORK_DIR}")


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_allowed(update.effective_user.id):
        await update.message.reply_text("无访问权限。")
        return

    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action=ChatAction.TYPING)
    reply = await run_claude(update.message.text, continue_session=True)

    for chunk in _split(reply, 4096):
        await update.message.reply_text(chunk)


def _split(text: str, limit: int) -> list[str]:
    if len(text) <= limit:
        return [text]
    chunks, while_text = [], text
    while while_text:
        chunks.append(while_text[:limit])
        while_text = while_text[limit:]
    return chunks


def main() -> None:
    app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("clear", clear))
    app.add_handler(CommandHandler("pwd", pwd))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    print(f"Bot 启动，工作目录：{WORK_DIR}")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
