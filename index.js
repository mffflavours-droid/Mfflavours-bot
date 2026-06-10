const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// ── Setup ─────────────────────────────────────────────────────────────────────
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const MINI_APP_URL = process.env.MINI_APP_URL || '';
const ADMIN_URL    = process.env.ADMIN_URL || '';
const ADMIN_ID     = String(process.env.ADMIN_TELEGRAM_ID || '');
const LOGO_URL     = process.env.LOGO_URL || '';
const TG_CONTACT   = process.env.TELEGRAM_CONTACT_URL || 'https://t.me/MFFlavours';
const SIG_CONTACT  = process.env.SIGNAL_URL || 'https://signal.me';

// ── Static texts — no Markdown, no special chars ──────────────────────────────
const INFO_TEXT = [
  'ℹ️ MFFlavours — Info',
  '',
  '📦 PICKUP',
  '📍 Location: Utrecht, Netherlands',
  '🕐 Hours: Mon - Sun  |  19:00 - 22:00',
  '⚠️ Min order: 500 EUR',
  '',
  '🚚 SHIPPING',
  '🌍 Same day shipping across Europe',
  '📦 Premium stealth packaging',
  '⚠️ Min order: 250 EUR',
  '',
  '💳 PAYMENT',
  '₿ Bitcoin (BTC)',
  '💎 Tether (USDT)',
  '💵 Cash on pickup',
  '',
  '⚡ Fast - Stealth - Trusted',
].join('\n');

const MAIN_KEYBOARD = {
  inline_keyboard: [
    [
      { text: 'ℹ️ Info',    callback_data: 'info'    },
      { text: '📞 Contact', callback_data: 'contact' },
    ],
    [{ text: '🛍️ Open Menu', web_app: { url: MINI_APP_URL } }]
  ]
};

const MENU_BUTTON = {
  inline_keyboard: [[{ text: '🛍️ Open Menu', web_app: { url: MINI_APP_URL } }]]
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const isAdmin = (msg) => String(msg.from?.id) === ADMIN_ID;

async function saveSubscriber(msg) {
  try {
    await supabase.from('subscribers').upsert({
      telegram_id: msg.from.id,
      username:    msg.from.username   || null,
      first_name:  msg.from.first_name || null,
    }, { onConflict: 'telegram_id' });
  } catch (e) { console.log('saveSubscriber:', e.message); }
}

async function safeSend(fn) {
  try { return await fn(); }
  catch (e) { console.log('safeSend:', e.message); }
}

async function getSubscribers() {
  const { data, error } = await supabase.from('subscribers').select('telegram_id');
  if (error) throw new Error(error.message);
  return data || [];
}

// ── /start ────────────────────────────────────────────────────────────────────
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || 'there';
  await saveSubscriber(msg);

  const text = `Welcome to MFFlavours, ${name}!\n\nMaroc's Finest Flavours\nPremium quality — straight from the source\n\nTap below to browse our full selection.`;

  if (LOGO_URL) {
    await safeSend(() => bot.sendPhoto(chatId, LOGO_URL, { caption: text, reply_markup: MAIN_KEYBOARD }));
  } else {
    await safeSend(() => bot.sendMessage(chatId, text, { reply_markup: MAIN_KEYBOARD }));
  }
});

// ── /menu ─────────────────────────────────────────────────────────────────────
bot.onText(/\/menu/, async (msg) => {
  await saveSubscriber(msg);
  await safeSend(() => bot.sendMessage(msg.chat.id, 'Open the MFFlavours menu:', { reply_markup: MENU_BUTTON }));
});

// ── /info ─────────────────────────────────────────────────────────────────────
bot.onText(/\/info/, async (msg) => {
  await safeSend(() => bot.sendMessage(msg.chat.id, INFO_TEXT, { reply_markup: MENU_BUTTON }));
});

// ── /help ─────────────────────────────────────────────────────────────────────
bot.onText(/\/help/, async (msg) => {
  await safeSend(() => bot.sendMessage(msg.chat.id,
    'Commands:\n/start - Welcome message\n/info - Pickup, shipping and payment info\n/menu - Open the store',
    { reply_markup: MAIN_KEYBOARD }
  ));
});

// ── Callback buttons ──────────────────────────────────────────────────────────
bot.on('callback_query', async (query) => {
  const chatId = query.message?.chat?.id;
  if (!chatId) return;

  // Silently ignore expired callback queries
  try { await bot.answerCallbackQuery(query.id); } catch (_) {}

  if (query.data === 'info') {
    await safeSend(() => bot.sendMessage(chatId, INFO_TEXT, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛍️ Open Menu', web_app: { url: MINI_APP_URL } }],
          [{ text: '◀️ Back', callback_data: 'back' }]
        ]
      }
    }));
  }

  if (query.data === 'contact') {
    await safeSend(() => bot.sendMessage(chatId,
      '📞 Contact MFFlavours\n\nSend us a message anytime — we are available 24/7.',
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✈️ Telegram', url: TG_CONTACT },
              { text: '🔵 Signal',   url: SIG_CONTACT },
            ],
            [{ text: '◀️ Back', callback_data: 'back' }]
          ]
        }
      }
    ));
  }

  if (query.data === 'back') {
    await safeSend(() => bot.sendMessage(chatId, '🏠 MFFlavours', { reply_markup: MAIN_KEYBOARD }));
  }
});

// ── Global error handlers — bot will never crash ──────────────────────────────
bot.on('polling_error', (err) => console.log('Polling error:', err.message));
process.on('unhandledRejection', (err) => console.log('Unhandled rejection:', err?.message || err));
process.on('uncaughtException', (err) => console.log('Uncaught exception:', err?.message || err));

// ═════════════════════════════════════════════════════════════════════════════
//  ADMIN COMMANDS
// ═════════════════════════════════════════════════════════════════════════════

// ── /admin ────────────────────────────────────────────────────────────────────
bot.onText(/\/admin/, async (msg) => {
  if (!isAdmin(msg)) return safeSend(() => bot.sendMessage(msg.chat.id, 'Access denied.'));
  try {
    const { count } = await supabase.from('subscribers').select('*', { count: 'exact', head: true });
    await safeSend(() => bot.sendMessage(msg.chat.id,
      `🔐 Admin Panel\n\n👥 Subscribers: ${count || 0}\n\nCommands:\n/broadcast [text] — Send to everyone\n/subscribers — List all subscribers\n/stats — Subscriber count\n\n📸 Broadcast media: just send a photo or video to this chat.`,
      { reply_markup: { inline_keyboard: [[{ text: '⚙️ Open Admin Panel', url: ADMIN_URL }]] } }
    ));
  } catch (e) { console.log('/admin error:', e.message); }
});

// ── /stats ────────────────────────────────────────────────────────────────────
bot.onText(/\/stats/, async (msg) => {
  if (!isAdmin(msg)) return;
  try {
    const { count } = await supabase.from('subscribers').select('*', { count: 'exact', head: true });
    await safeSend(() => bot.sendMessage(msg.chat.id, `Total subscribers: ${count || 0}`));
  } catch (e) { console.log('/stats error:', e.message); }
});

// ── /subscribers ──────────────────────────────────────────────────────────────
bot.onText(/\/subscribers/, async (msg) => {
  if (!isAdmin(msg)) return;
  try {
    const { data: subs } = await supabase
      .from('subscribers')
      .select('telegram_id, username, first_name, joined_at')
      .order('joined_at', { ascending: false })
      .limit(50);

    if (!subs?.length) return safeSend(() => bot.sendMessage(msg.chat.id, 'No subscribers yet.'));

    const list = subs.map((s, i) => {
      const name = s.username ? `@${s.username}` : (s.first_name || 'Unknown');
      return `${i + 1}. ${name} (${s.telegram_id})`;
    }).join('\n');

    await safeSend(() => bot.sendMessage(msg.chat.id, `Subscribers (${subs.length}):\n\n${list}`));
  } catch (e) { console.log('/subscribers error:', e.message); }
});

// ── /broadcast [text] ─────────────────────────────────────────────────────────
bot.on('message', async (msg) => {
  if (!isAdmin(msg)) return;
  const text = msg.text || '';

  // Match /broadcast with or without bot username
  const match = text.match(/^\/broadcast(?:@\S+)?\s+(.+)/s);
  if (!match) return;

  const broadcastText = match[1].trim();
  if (!broadcastText) return safeSend(() => bot.sendMessage(msg.chat.id, 'Usage: /broadcast Your message here'));

  try {
    const { data: subs, error } = await supabase.from('subscribers').select('telegram_id');

    if (error) {
      console.log('Supabase error fetching subscribers:', error.message);
      return safeSend(() => bot.sendMessage(msg.chat.id, 'Error fetching subscribers: ' + error.message));
    }

    if (!subs || subs.length === 0) {
      return safeSend(() => bot.sendMessage(msg.chat.id, 'No subscribers found. People need to send /start to the bot first.'));
    }

    await safeSend(() => bot.sendMessage(msg.chat.id, `Sending to ${subs.length} subscribers...`));

    let sent = 0, failed = 0;
    for (const sub of subs) {
      try {
        await bot.sendMessage(sub.telegram_id, `📢 MFFlavours\n\n${broadcastText}`, { reply_markup: MENU_BUTTON });
        sent++;
      } catch (e) {
        failed++;
        console.log(`Failed to send to ${sub.telegram_id}:`, e.message);
      }
      await new Promise(r => setTimeout(r, 60));
    }

    await safeSend(() => bot.sendMessage(msg.chat.id, `✅ Broadcast complete!\n\nSent: ${sent}\nFailed: ${failed}`));
  } catch (e) {
    console.log('/broadcast error:', e.message);
    await safeSend(() => bot.sendMessage(msg.chat.id, 'Broadcast failed: ' + e.message));
  }
});

// ── Photo from admin → broadcast ─────────────────────────────────────────────
bot.on('photo', async (msg) => {
  if (!isAdmin(msg)) return;
  try {
    const caption = msg.caption || '';
    const photo = msg.photo[msg.photo.length - 1].file_id;
    const subs = await getSubscribers();
    if (!subs.length) return safeSend(() => bot.sendMessage(msg.chat.id, 'No subscribers.'));

    await safeSend(() => bot.sendMessage(msg.chat.id, `Sending photo to ${subs.length} subscribers...`));

    let sent = 0;
    for (const sub of subs) {
      try {
        await bot.sendPhoto(sub.telegram_id, photo, {
          caption: caption ? `MFFlavours\n\n${caption}` : 'MFFlavours',
          reply_markup: MENU_BUTTON,
        });
        sent++;
      } catch (_) {}
      await new Promise(r => setTimeout(r, 60));
    }
    await safeSend(() => bot.sendMessage(msg.chat.id, `Photo sent to ${sent} subscribers.`));
  } catch (e) { console.log('Photo broadcast error:', e.message); }
});

// ── Video from admin → broadcast ─────────────────────────────────────────────
bot.on('video', async (msg) => {
  if (!isAdmin(msg)) return;
  try {
    const caption = msg.caption || '';
    const video = msg.video.file_id;
    const subs = await getSubscribers();
    if (!subs.length) return safeSend(() => bot.sendMessage(msg.chat.id, 'No subscribers.'));

    await safeSend(() => bot.sendMessage(msg.chat.id, `Sending video to ${subs.length} subscribers...`));

    let sent = 0;
    for (const sub of subs) {
      try {
        await bot.sendVideo(sub.telegram_id, video, {
          caption: caption ? `MFFlavours\n\n${caption}` : 'MFFlavours',
          reply_markup: MENU_BUTTON,
        });
        sent++;
      } catch (_) {}
      await new Promise(r => setTimeout(r, 60));
    }
    await safeSend(() => bot.sendMessage(msg.chat.id, `Video sent to ${sent} subscribers.`));
  } catch (e) { console.log('Video broadcast error:', e.message); }
});

// ── Health check ──────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.get('/health', (_, res) => res.json({ status: 'ok', bot: 'MFFlavours' }));
app.listen(process.env.PORT || 3001);

console.log('Bot started — listening for messages...');
console.log('Server running on port', process.env.PORT || 3001);
