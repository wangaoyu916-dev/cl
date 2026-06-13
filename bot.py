import os
import logging
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

_allowed_raw = os.getenv("ALLOWED_USER_IDS", "")
ALLOWED_USER_IDS: set[int] = (
    {int(uid.strip()) for uid in _allowed_raw.split(",") if uid.strip()}
    if _allowed_raw.strip()
    else set()
)

claude = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

# Per-chat conversation history: {chat_id: [{"role": ..., "content": ...}]}
conversations: dict[int, list[dict]] = {}


def _is_allowed(user_id: int) -> bool:
    return not ALLOWED_USER_IDS or user_id in ALLOWED_USER_IDS


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_allowed(update.effective_user.id):
        return
    conversations.pop(update.effective_chat.id, None)
    await update.message.reply_text(
        "你好！我是 Claude，有什么可以帮你的？\n"
        "发送 /clear 可以清除对话记录重新开始。"
    )


async def clear(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_allowed(update.effective_user.id):
        return
    conversations.pop(update.effective_chat.id, None)
    await update.message.reply_text("对话记录已清除，开始新的对话吧！")


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_allowed(update.effective_user.id):
        await update.message.reply_text("抱歉，你没有使用此 Bot 的权限。")
        return

    chat_id = update.effective_chat.id
    user_text = update.message.text

    history = conversations.setdefault(chat_id, [])
    history.append({"role": "user", "content": user_text})

    await context.bot.send_chat_action(chat_id=chat_id, action=ChatAction.TYPING)

    try:
        response = claude.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=8096,
            messages=history,
        )
        reply = response.content[0].text
    except anthropic.APIError as e:
        logger.error("Anthropic API error: %s", e)
        reply = f"调用 Claude API 时出错：{e}"

    history.append({"role": "assistant", "content": reply})

    # Telegram message limit is 4096 chars; split if needed
    for chunk in _split(reply, 4096):
        await update.message.reply_text(chunk)


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
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    logger.info("Bot started, polling…")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
