const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const MINI_APP_URL = process.env.MINI_APP_URL;
const ADMIN_ID = process.env.ADMIN_TELEGRAM_ID;
const LOGO_URL = process.env.LOGO_URL || '';
const TG_CONTACT = process.env.TELEGRAM_CONTACT_URL || 'https://t.me/MFFlavours';
const SIG_CONTACT = process.env.SIGNAL_URL || 'https://signal.me';

const INFO = `ℹ️ *MFFlavours — Info*

━━━━━━━━━━━━━━━━━━
📦 *PICKUP*
📍 Utrecht, Netherlands
🕐 Mon – Sun  |  19:00 – 22:00
⚠️ Min order: *€500*

━━━━━━━━━━━━━━━━━━
🚚 *SHIPPING*
🌍 Same day shipping across Europe
📦 Premium stealth packaging
⚠️ Min order: *€250*

━━━━━━━━━━━━━━━━━━
💳 *PAYMENT*
₿ Bitcoin (BTC)
💎 Tether (USDT)
💵 Cash on pickup

━━━━━━━━━━━━━━━━━━
⚡ Fast • Stealth • Trusted`;

const MAIN_BUTTONS = {
  inline_keyboard: [
    [
      { text: 'ℹ️ Info', callback_data: 'info' },
      { text: '📞 Contact', callback_data: 'contact' },
    ],
    [
      { text: '🛍️ Open Menu', web_app: { url: MINI_APP_URL } }
    ]
  ]
};

async function saveSubscriber(msg) {
  try {
    await supabase.from('subscribers').upsert({
      telegram_id: msg.from.id,
      username: msg.from.username || null,
      first_name: msg.from.first_name || null,
    }, { onConflict: 'telegram_id' });
  } catch (e) {
    console.log('Subscriber save error:', e.message);
  }
}

function isAdmin(msg) {
  return String(msg.from.id) === String(ADMIN_ID);
}

// ── /start ────────────────────────────────────────────────────────────────────
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const name = msg.from.first_name || 'there';
  await saveSubscriber(msg);

  const caption = `👋 *Welcome to MFFlavours, ${name}!*\n\n🔥 Maroc's Finest Flavours\n_Premium quality — straight from the source_\n\nTap below to browse our full selection.`;

  try {
    if (LOGO_URL) {
      await bot.sendPhoto(chatId, LOGO_URL, {
        caption,
        parse_mode: 'Markdown',
        reply_markup: MAIN_BUTTONS,
      });
    } else {
      await bot.sendMessage(chatId, caption, {
        parse_mode: 'Markdown',
        reply_markup: MAIN_BUTTONS,
      });
    }
  } catch (e) {
    await bot.sendMessage(chatId, caption, {
      parse_mode: 'Markdown',
      reply_markup: MAIN_BUTTONS,
    });
  }
});

// ── /menu ─────────────────────────────────────────────────────────────────────
bot.onText(/\/menu/, async (msg) => {
  await saveSubscriber(msg);
  await bot.sendMessage(msg.chat.id, '🛍️ Open the MFFlavours menu:', {
    reply_markup: {
      inline_keyboard: [[{ text: '🛍️ Open Menu', web_app: { url: MINI_APP_URL } }]]
    }
  });
});

// ── /info ─────────────────────────────────────────────────────────────────────
bot.onText(/\/info/, async (msg) => {
  await bot.sendMessage(msg.chat.id, INFO, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[{ text: '🛍️ Open Menu', web_app: { url: MINI_APP_URL } }]]
    }
  });
});

// ── /help ─────────────────────────────────────────────────────────────────────
bot.onText(/\/help/, async (msg) => {
  await bot.sendMessage(msg.chat.id,
    `*MFFlavours*\n\nCommands:\n/start — Welcome bericht\n/info — Pickup, shipping & betaling\n/menu — Open de winkel`,
    { parse_mode: 'Markdown', reply_markup: MAIN_BUTTONS }
  );
});

// ── Callback knoppen ──────────────────────────────────────────────────────────
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  await bot.answerCallbackQuery(query.id);

  if (query.data === 'info') {
    await bot.sendMessage(chatId, INFO, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛍️ Open Menu', web_app: { url: MINI_APP_URL } }],
          [{ text: '◀️ Terug', callback_data: 'back' }]
        ]
      }
    });
  }

  if (query.data === 'contact') {
    await bot.sendMessage(chatId,
      `📞 *Contact MFFlavours*\n\nWe reageren snel — meestal binnen enkele minuten.\n\n✈️ Telegram: ${TG_CONTACT}\n🔵 Signal: ${SIG_CONTACT}\n\n🕐 Beschikbaar: Ma–Zo | 19:00–22:00`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✈️ Telegram', url: TG_CONTACT },
              { text: '🔵 Signal', url: SIG_CONTACT },
            ],
            [{ text: '◀️ Terug', callback_data: 'back' }]
          ]
        }
      }
    );
  }

  if (query.data === 'back') {
    await bot.sendMessage(chatId, '🏠 *MFFlavours*', {
      parse_mode: 'Markdown',
      reply_markup: MAIN_BUTTONS,
    });
  }
});

// ═══════════════════════════════════════════════════════
// ADMIN COMMANDS
// ═══════════════════════════════════════════════════════

// ── /admin ────────────────────────────────────────────────────────────────────
bot.onText(/\/admin/, async (msg) => {
  if (!isAdmin(msg)) return bot.sendMessage(msg.chat.id, '⛔ Access denied.');
  const { count } = await supabase.from('subscribers').select('*', { count: 'exact', head: true });
  await bot.sendMessage(msg.chat.id,
    `🔐 *Admin Panel*\n\n👥 Subscribers: *${count || 0}*\n\n*Commands:*\n/broadcast tekst — Stuur naar iedereen\n/subscribers — Zie alle subscribers\n/stats — Statistieken\n\n*Media sturen:*\nStuur gewoon een foto of video naar deze chat — gaat automatisch naar alle subscribers`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '⚙️ Open Admin Panel', url: process.env.ADMIN_URL }]]
      }
    }
  );
});

// ── /stats ────────────────────────────────────────────────────────────────────
bot.onText(/\/stats/, async (msg) => {
  if (!isAdmin(msg)) return;
  const { count } = await supabase.from('subscribers').select('*', { count: 'exact', head: true });
  await bot.sendMessage(msg.chat.id, `📊 *Stats*\n\n👥 Subscribers: *${count || 0}*`, { parse_mode: 'Markdown' });
});

// ── /subscribers ──────────────────────────────────────────────────────────────
bot.onText(/\/subscribers/, async (msg) => {
  if (!isAdmin(msg)) return;
  const { data: subs } = await supabase
    .from('subscribers')
    .select('telegram_id, username, first_name, joined_at')
    .order('joined_at', { ascending: false })
    .limit(50);

  if (!subs?.length) return bot.sendMessage(msg.chat.id, 'Nog geen subscribers.');

  const list = subs.map((s, i) => {
    const name = s.username ? `@${s.username}` : (s.first_name || 'Unknown');
    return `${i + 1}. ${name} — ID: ${s.telegram_id}`;
  }).join('\n');

  await bot.sendMessage(msg.chat.id, `👥 *Subscribers (${subs.length}):*\n\n${list}`, { parse_mode: 'Markdown' });
});

// ── /broadcast tekst ─────────────────────────────────────────────────────────
bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  if (!isAdmin(msg)) return;
  const text = match[1];
  const { data: subs } = await supabase.from('subscribers').select('telegram_id');
  if (!subs?.length) return bot.sendMessage(msg.chat.id, 'Geen subscribers.');

  await bot.sendMessage(msg.chat.id, `📤 Sturen naar ${subs.length} subscribers...`);

  let sent = 0, failed = 0;
  for (const sub of subs) {
    try {
      await bot.sendMessage(sub.telegram_id,
        `📢 *MFFlavours*\n\n${text}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[{ text: '🛍️ Open Menu', web_app: { url: MINI_APP_URL } }]]
          }
        }
      );
      sent++;
      await new Promise(r => setTimeout(r, 60));
    } catch (e) { failed++; }
  }
  await bot.sendMessage(msg.chat.id, `✅ Klaar!\n\n✓ Verstuurd: ${sent}\n✗ Mislukt: ${failed}`);
});

// ── Foto van admin → broadcast ────────────────────────────────────────────────
bot.on('photo', async (msg) => {
  if (!isAdmin(msg)) return;
  const caption = msg.caption || '';
  const photo = msg.photo[msg.photo.length - 1].file_id;
  const { data: subs } = await supabase.from('subscribers').select('telegram_id');
  if (!subs?.length) return bot.sendMessage(msg.chat.id, 'Geen subscribers.');

  await bot.sendMessage(msg.chat.id, `📤 Foto sturen naar ${subs.length} subscribers...`);
  let sent = 0, failed = 0;
  for (const sub of subs) {
    try {
      await bot.sendPhoto(sub.telegram_id, photo, {
        caption: caption ? `📢 *MFFlavours*\n\n${caption}` : '📢 *MFFlavours*',
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🛍️ Open Menu', web_app: { url: MINI_APP_URL } }]] }
      });
      sent++;
      await new Promise(r => setTimeout(r, 60));
    } catch (e) { failed++; }
  }
  await bot.sendMessage(msg.chat.id, `✅ Foto verstuurd naar ${sent} subscribers!`);
});

// ── Video van admin → broadcast ───────────────────────────────────────────────
bot.on('video', async (msg) => {
  if (!isAdmin(msg)) return;
  const caption = msg.caption || '';
  const video = msg.video.file_id;
  const { data: subs } = await supabase.from('subscribers').select('telegram_id');
  if (!subs?.length) return bot.sendMessage(msg.chat.id, 'Geen subscribers.');

  await bot.sendMessage(msg.chat.id, `📤 Video sturen naar ${subs.length} subscribers...`);
  let sent = 0, failed = 0;
  for (const sub of subs) {
    try {
      await bot.sendVideo(sub.telegram_id, video, {
        caption: caption ? `📢 *MFFlavours*\n\n${caption}` : '📢 *MFFlavours*',
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '🛍️ Open Menu', web_app: { url: MINI_APP_URL } }]] }
      });
      sent++;
      await new Promise(r => setTimeout(r, 60));
    } catch (e) { failed++; }
  }
  await bot.sendMessage(msg.chat.id, `✅ Video verstuurd naar ${sent} subscribers!`);
});

// Express health check
const app = express();
app.use(cors());
app.get('/health', (_, res) => res.json({ status: 'ok' }));
app.listen(process.env.PORT || 3001, () => console.log('🚀 Server running'));
console.log('✅ Bot started — listening for messages...');
