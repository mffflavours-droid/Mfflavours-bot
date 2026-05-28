const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const MINI_APP_URL = process.env.MINI_APP_URL;
const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID;

// ── Save subscriber when they start the bot ───────────────────────────────────
async function saveSubscriber(msg) {
  const { id, username, first_name } = msg.from;
  await supabase.from('subscribers').upsert({
    telegram_id: id,
    username: username || null,
    first_name: first_name || null,
  }, { onConflict: 'telegram_id' });
}

// ── /start ────────────────────────────────────────────────────────────────────
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || 'there';

  await saveSubscriber(msg);

  await bot.sendMessage(chatId,
    `🔥 *Welcome to MFFlavours, ${firstName}!*\n\nFast • Stealth • Trusted\n\n_Browse our full menu via the button below._`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '🛍️ Open Menu', web_app: { url: MINI_APP_URL } }]]
      }
    }
  );
});

// ── /menu ─────────────────────────────────────────────────────────────────────
bot.onText(/\/menu/, async (msg) => {
  await saveSubscriber(msg);
  await bot.sendMessage(msg.chat.id, '🛍️ Open the MFFlavours menu:', {
    reply_markup: {
      keyboard: [[{ text: '🛍️ Open Menu', web_app: { url: MINI_APP_URL } }]],
      resize_keyboard: true
    }
  });
});

// ── /help ─────────────────────────────────────────────────────────────────────
bot.onText(/\/help/, async (msg) => {
  await bot.sendMessage(msg.chat.id,
    `*MFFlavours — How it works:*\n\n1️⃣ Tap *Open Menu* to browse\n2️⃣ Pick your products & sizes\n3️⃣ Contact us via Telegram or Signal\n\n📦 Discreet packaging\n💬 Questions? Just message us!`,
    { parse_mode: 'Markdown' }
  );
});

// ── /admin — owner only ───────────────────────────────────────────────────────
bot.onText(/\/admin/, async (msg) => {
  if (String(msg.from.id) !== String(ADMIN_TELEGRAM_ID)) {
    return bot.sendMessage(msg.chat.id, '⛔ Access denied.');
  }

  const { count } = await supabase
    .from('subscribers')
    .select('*', { count: 'exact', head: true });

  await bot.sendMessage(msg.chat.id,
    `🔐 *Admin Panel*\n\n👥 Subscribers: ${count || 0}\n\nCommands:\n/broadcast \\[message\\] — Send to everyone\n/stats — View subscriber count`,
    {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [[{ text: '⚙️ Open Admin Panel', url: process.env.ADMIN_URL }]]
      }
    }
  );
});

// ── /stats ────────────────────────────────────────────────────────────────────
bot.onText(/\/stats/, async (msg) => {
  if (String(msg.from.id) !== String(ADMIN_TELEGRAM_ID)) return;

  const { count } = await supabase
    .from('subscribers')
    .select('*', { count: 'exact', head: true });

  await bot.sendMessage(msg.chat.id, `👥 Total subscribers: *${count || 0}*`, { parse_mode: 'Markdown' });
});

// ── /broadcast [message] — send to all subscribers ───────────────────────────
bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  if (String(msg.from.id) !== String(ADMIN_TELEGRAM_ID)) {
    return bot.sendMessage(msg.chat.id, '⛔ Access denied.');
  }

  const message = match[1];
  if (!message) return bot.sendMessage(msg.chat.id, 'Usage: /broadcast Your message here');

  // Get all subscribers
  const { data: subscribers, error } = await supabase
    .from('subscribers')
    .select('telegram_id');

  if (error || !subscribers?.length) {
    return bot.sendMessage(msg.chat.id, '❌ No subscribers found.');
  }

  await bot.sendMessage(msg.chat.id, `📤 Sending to ${subscribers.length} subscribers...`);

  let sent = 0;
  let failed = 0;

  for (const sub of subscribers) {
    try {
      await bot.sendMessage(sub.telegram_id,
        `📢 *MFFlavours*\n\n${message}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '🛍️ Open Menu', web_app: { url: MINI_APP_URL } }]]
          }
        }
      );
      sent++;
      // Small delay to avoid Telegram rate limits
      await new Promise(r => setTimeout(r, 50));
    } catch (e) {
      failed++;
      console.log(`Failed to send to ${sub.telegram_id}:`, e.message);
    }
  }

  await bot.sendMessage(msg.chat.id,
    `✅ Broadcast done!\n\n✓ Sent: ${sent}\n✗ Failed: ${failed}`
  );
});

// ── /broadcastmedia — send photo or video to all ─────────────────────────────
bot.onText(/\/broadcastphoto/, async (msg) => {
  if (String(msg.from.id) !== String(ADMIN_TELEGRAM_ID)) return;
  await bot.sendMessage(msg.chat.id,
    '📸 Reply to this message with a photo or video to broadcast it to all subscribers.\n\nOr use:\n/broadcast Your text message here'
  );
});

// Handle photo replies for broadcast
bot.on('photo', async (msg) => {
  if (String(msg.from.id) !== String(ADMIN_TELEGRAM_ID)) return;
  if (!msg.caption?.startsWith('/send')) return;

  const caption = msg.caption.replace('/send', '').trim();
  const photo = msg.photo[msg.photo.length - 1].file_id;

  const { data: subscribers } = await supabase.from('subscribers').select('telegram_id');
  if (!subscribers?.length) return bot.sendMessage(msg.chat.id, 'No subscribers.');

  let sent = 0;
  for (const sub of subscribers) {
    try {
      await bot.sendPhoto(sub.telegram_id, photo, {
        caption: caption ? `📢 *MFFlavours*\n\n${caption}` : '📢 *MFFlavours*',
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '🛍️ Open Menu', web_app: { url: MINI_APP_URL } }]]
        }
      });
      sent++;
      await new Promise(r => setTimeout(r, 50));
    } catch (e) { console.log(`Failed:`, e.message); }
  }
  await bot.sendMessage(msg.chat.id, `✅ Photo sent to ${sent} subscribers!`);
});

// Express health check
const app = express();
app.use(cors());
app.get('/health', (_, res) => res.json({ status: 'ok', bot: 'MFFlavours' }));
app.listen(process.env.PORT || 3001, () => console.log('🚀 Server running'));
console.log('✅ Bot started — listening for messages...');
