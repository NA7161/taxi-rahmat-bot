"""
Taxi Rahmat Bot

This file is the main Python module for the Taxi Rahmat Telegram bot.

The original document was plain Markdown which caused a SyntaxError when run as Python.
To fix that, the repository README is preserved here inside this module-level docstring
and the rest of the file contains runnable Python code.

Usage:
  - Set environment variable `TELEGRAM_BOT_TOKEN` to your bot token from @BotFather.
  - Install dependencies: `pip install python-telegram-bot>=20.0`
  - Run: `python main.py`

This module also includes a small test suite. To run tests locally:
  - `ACTION=test python main.py`

Notes about behavior:
  - If the `python-telegram-bot` library is not installed, the module prints instructions
    and the bot will not attempt to start. This keeps the file runnable in environments
    without the library (useful for CI/tests).

"""

import os
import logging
from typing import Any

# Try to import telegram; if unavailable, tests still run and give helpful messages.
try:
    from telegram import InlineKeyboardButton, InlineKeyboardMarkup
    from telegram.ext import ApplicationBuilder, CommandHandler, CallbackQueryHandler, ContextTypes
    TELEGRAM_LIB_AVAILABLE = True
except Exception:
    TELEGRAM_LIB_AVAILABLE = False


def get_bot_token() -> str:
    """Read bot token from environment.

    Returns a string token (may be the placeholder)."""
    return os.getenv("TELEGRAM_BOT_TOKEN", "YOUR_BOT_TOKEN_HERE")


def validate_token(token: str) -> bool:
    """Basic validation for a Telegram bot token.

    This is a conservative check used for local testing: a valid token is non-empty,
    not the placeholder, and reasonably long.
    It does NOT verify the token with Telegram API here.
    """
    if not isinstance(token, str):
        return False
    t = token.strip()
    if len(t) < 10:
        return False
    if t == "YOUR_BOT_TOKEN_HERE":
        return False
    return True


# Handlers (async functions). When python-telegram-bot is not installed,
# these functions will still exist but won't be registered.
async def start(update: Any, context: Any) -> None:
    """Send a welcome message with inline keyboard.

    If the telegram library is unavailable, this function will simply log the call.
    """
    if TELEGRAM_LIB_AVAILABLE:
        keyboard = [
            [InlineKeyboardButton("🚖 Вызвать такси", callback_data='order_taxi')],
            [InlineKeyboardButton("ℹ О нас", callback_data='about')],
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        # `update.message` is expected when called from the telegram framework
        await update.message.reply_text("Добро пожаловать в Такси Рахмат!", reply_markup=reply_markup)
    else:
        logging.info("start() called but python-telegram-bot not available")


async def button_handler(update: Any, context: Any) -> None:
    """Handle inline button presses.

    If the telegram library is unavailable, this will log the call instead.
    """
    if TELEGRAM_LIB_AVAILABLE:
        query = update.callback_query
        await query.answer()
        if query.data == 'order_taxi':
            await query.edit_message_text(text="Пожалуйста, отправьте вашу геолокацию для заказа такси.")
        elif query.data == 'about':
            await query.edit_message_text(text="Такси Рахмат — быстро, удобно, надёжно! 🚖")
    else:
        logging.info("button_handler() called but python-telegram-bot not available")


async def run_bot() -> None:
    """Start the telegram bot using the token in TELEGRAM_BOT_TOKEN.

    Raises RuntimeError if TELEGRAM_BOT_TOKEN is invalid or the telegram library
    is not installed.
    """
    token = get_bot_token()
    if not validate_token(token):
        raise RuntimeError("Invalid TELEGRAM_BOT_TOKEN. Set TELEGRAM_BOT_TOKEN environment variable to your bot token.")

    if not TELEGRAM_LIB_AVAILABLE:
        raise RuntimeError(
            "Required library python-telegram-bot is not installed. "
            "Install it with: pip install python-telegram-bot>=20.0"
        )

    app = ApplicationBuilder().token(token).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(button_handler))

    print("Бот запускается...")
    await app.run_polling()


# Small built-in tests
def _run_tests() -> int:
    """Run a tiny test suite. Returns exit code 0 on success, 1 on failure."""
    import unittest

    class TestValidateToken(unittest.TestCase):
        def test_valid_token(self):
            self.assertTrue(validate_token('1234567890abcdef'))

        def test_short_token(self):
            self.assertFalse(validate_token('short'))

        def test_placeholder(self):
            self.assertFalse(validate_token('YOUR_BOT_TOKEN_HERE'))

        def test_none(self):
            self.assertFalse(validate_token(None))

    suite = unittest.defaultTestLoader.loadTestsFromTestCase(TestValidateToken)
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    return 0 if result.wasSuccessful() else 1


if __name__ == "__main__":
    # Basic CLI: run tests if ACTION=test, otherwise try to start the bot.
    action = os.getenv("ACTION", "run").lower()
    if action == "test":
        raise SystemExit(_run_tests())

    # Try to start the bot; provide actionable messages if dependencies missing.
    try:
        import asyncio
        asyncio.run(run_bot())
    except RuntimeError as e:
        print("Error:", e)
        print("")
        if not TELEGRAM_LIB_AVAILABLE:
            print("Quick fix: install dependencies: pip install python-telegram-bot>=20.0")
        elif not validate_token(get_bot_token()):
            print("Quick fix: set environment variable TELEGRAM_BOT_TOKEN to your bot token.")
        raise
    except Exception as exc:
        # Any other unexpected exception — print and re-raise for easier debugging.
        logging.exception("Unexpected error while running the bot")
        raise
