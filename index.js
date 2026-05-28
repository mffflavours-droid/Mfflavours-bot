const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const MINI_APP_URL = process.env.MINI_APP_URL;
const ADMIN_ID = process.env.ADMIN_TELEGRAM_ID;

// ── Jouw logo URL — upload naar imgur.com en vervang deze link ────────────────
const LOGO_URL = process.env.LOGO_URL || 'https://i.imgur.com/JOUWLOGO.jpg';

// ── Info tekst ────────────────────────────────────────────────────────────────
const INFO_TEXT = `
╔════════════════════════╗
        ✦ MFF LAVOURS ✦
╚════════════════════════╝

🏆 *Maroc's Finest Flavours*
_Premium Quality • Fast • Discreet_

━━━━━━━━━━━━━━━━━━━━━━

📦 *PICKUP*
📍 Utrecht, Netherlands
🕐 Mon – Sun  |  19:00 – 22:00
⚠️ Min. order: *€500*

━━━━━━━━━━━━━━━━━━━━━━

🚚 *SHIPPING*
🌍 Same day shipping across Europe
📦 Premium stealth packaging
⚠️ Min. order: *€250*

━━━━━━━━━━━━━━━━━━━━━━

💳 *PAYMENT*
₿  Bitcoin \\(BTC\\)
💎  Tether \\(USDT\\)
💵  Cash on pickup

━━━━━━━━━━━━━━━━━━━━━━

⚡ _Fast • Stealth • Trusted_
`.trim();

const WELCOME_TEXT = (name) => `
👋 *Welcome to MFFlavours, ${name}\\!*

🔥 Maroc's Finest Flavours
_Premium quality — straight from the source_

Tap below to browse our full selection\\.
`.trim();

// ── Main keyboard buttons ─────────────────────────────────────────────────────
const MAIN_KEYBOARD = {
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

// ── Save subscriber ───────────────────────────────────────────────────────────
async function saveSubscriber(msg) {
  const { id, username, first_name } = msg.from;
  try {
    await supabase.from('subscribers').upsert({
      telegram_id: id,
      username: username || null,
      first_name: first_name || null,
    }, { onConflict: 'telegram_id' });
  } catch (e) {
    console.error('Save subscriber error:', e.message);
  }
}

// ── /start ────────────────────────────────────────────────────────────────────
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || 'there';

  await saveSubscriber(msg);

  try {
    await bot.sendPhoto(chatId, LOGO_URL, {
      caption: WELCOME_TEXT(firstName),
      parse_mode: 'MarkdownV2',
      reply_markup: MAIN_KEYBOARD,
    });
  } catch (e) {
    // Fallback zonder foto als URL niet werkt
    await bot.sendMessage(chatId, WELCOME_TEXT(firstName), {
      parse_mode: 'MarkdownV2',
      reply_markup: MAIN_KEYBOARD,
    });
  }
});

// ── /menu ─────────────────────────────────────────────────────────────────────
bot.onText(/\/menu/, async (msg) => {
  await saveSubscriber(msg);
  await bot.sendMessage(msg.chat.id, '🛍️ *MFFlavours Menu*\n\nTap below to browse our selection:', {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[{ text: '🛍️ Open Menu', web_app: { url: MINI_APP_URL } }]]
    }
  });
});

// ── /info ─────────────────────────────────────────────────────────────────────
bot.onText(/\/info/, async (msg) => {
  await bot.sendMessage(msg.chat.id, INFO_TEXT, {
    parse_mode: 'MarkdownV2',
    reply_markup: {
      inline_keyboard: [[{ text: '🛍️ Open Menu', web_app: { url: MINI_APP_URL } }]]
    }
  });
});

// ── /help ─────────────────────────────────────────────────────────────────────
bot.onText(/\/help/, async (msg) => {
  await bot.sendMessage(msg.chat.id, WELCOME_TEXT(msg.from.first_name || 'there'), {
    parse_mode: 'MarkdownV2',
    reply_markup: MAIN_KEYBOARD,
  });
});

// ── Callback buttons (Info & Contact) ─────────────────────────────────────────
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  await bot.answerCallbackQuery(query.id);

  if (data === 'info') {
    await bot.sendMessage(chatId, INFO_TEXT, {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛍️ Open Menu', web_app: { url: MINI_APP_URL } }],
          [{ text: '◀️ Back', callback_data: 'back' }]
        ]
      }
    });
  }

  if (data === 'contact') {
    const tgUrl = process.env.TELEGRAM_CONTACT_URL || 'https://t.me/MFFlavours';
    const sigUrl = process.env.SIGNAL_URL || 'https://signal.me';

    await bot.sendMessage(chatId,
      `📞 *Contact MFFlavours*\n\n_We reply fast — usually within minutes\\._\n\n✈️ *Telegram:* [Chat with us](${tgUrl})\n🔵 *Signal:* [Chat with us](${sigUrl})\n\n⏰ Available: Mon–Sun | 19:00–22:00`.replace(/[.!]/g, '\\$&'),
      {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✈️ Telegram', url: tgUrl },
              { text: '🔵 Signal', url: sigUrl },
            ],
            [{ text: '◀️ Back', callback_data: 'back' }]
          ]
        }
      }
    );
  }

  if (data === 'back') {
    await bot.sendMessage(chatId, '🏠 *MFFlavours*', {
      parse_mode: 'Markdown',
      reply_markup: MAIN_KEYBOARD,
    });
  }

  // Admin order confirm/decline
  if (data.startsWith('confirm_') || data.startsWith('decline_')) {
    if (String(query.from.id) !== String(ADMIN_ID)) return;
    const [action, orderId, customerChatId] = data.split('_');
    if (action === 'confirm') {
      await supabase.from('orders').update({ status: 'confirmed' }).eq('id', orderId);
      await bot.sendMessage(customerChatId, '✅ *Your order has been confirmed\\!*\nWe\'ll contact you shortly\\.', { parse_mode: 'MarkdownV2' });
      await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: query.message.chat.id, message_id: query.message.message_id });
    }
    if (action === 'decline') {
      await supabase.from('orders').update({ status: 'declined' }).eq('id', orderId);
      await bot.sendMessage(customerChatId, '❌ *Order could not be processed\\.*\nPlease contact us directly\\.', { parse_mode: 'MarkdownV2' });
      await bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: query.message.chat.id, message_id: query.message.message_id });
    }
  }
});

// ═══════════════════════════════════════════════════════════════
//  ADMIN COMMANDS — alleen jij kan deze gebruiken
// ═══════════════════════════════════════════════════════════════

function isAdmin(msg) { return String(msg.from.id) === String(ADMIN_ID); }

// ── /admin ────────────────────────────────────────────────────────────────────
bot.onText(/\/admin/, async (msg) => {
  if (!isAdmin(msg)) return bot.sendMessage(msg.chat.id, '⛔ Access denied.');

  const { count } = await supabase.from('subscribers').select('*', { count: 'exact', head: true });

  await bot.sendMessage(msg.chat.id,
    `🔐 *MFFlavours Admin*\n\n👥 Subscribers: *${count || 0}*\n\n*Commands:*\n/broadcast tekst — Stuur naar iedereen\n/broadcastphoto — Stuur foto naar iedereen\n/subscribers — Zie alle subscribers\n/stats — Statistieken\n/setlogo URL — Update welkomstfoto`,
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
    const name = s.username ? `@${s.username}` : s.first_name || 'Unknown';
    return `${i + 1}. ${name} (${s.telegram_id})`;
  }).join('\n');

  await bot.sendMessage(msg.chat.id,
    `👥 *Subscribers (${subs.length}):*\n\n${list}`,
    { parse_mode: 'Markdown' }
  );
});

// ── /broadcast [tekst] ────────────────────────────────────────────────────────
bot.onText(/\/broadcast (.+)/, async (msg, match) => {
  if (!isAdmin(msg)) return;

  const text = match[1];
  const { data: subs } = await supabase.from('subscribers').select('telegram_id');
  if (!subs?.length) return bot.sendMessage(msg.chat.id, '❌ Geen subscribers.');

  await bot.sendMessage(msg.chat.id, `📤 Bezig met sturen naar ${subs.length} subscribers...`);

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

  await bot.sendMessage(msg.chat.id, `✅ Klaar\\!\n\n✓ Verstuurd: ${sent}\n✗ Mislukt: ${failed}`, { parse_mode: 'MarkdownV2' });
});

// ── /broadcastphoto — stuur foto naar iedereen ────────────────────────────────
bot.onText(/\/broadcastphoto/, async (msg) => {
  if (!isAdmin(msg)) return;
  await bot.sendMessage(msg.chat.id,
    '📸 Stuur nu een foto naar deze chat met je tekst als caption\\.\n\nVoorbeeld caption:\n`Nieuwe batch binnen 🔥`',
    { parse_mode: 'MarkdownV2' }
  );
});

// Handle foto van admin — stuur naar alle subscribers
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
        reply_markup: {
          inline_keyboard: [[{ text: '🛍️ Open Menu', web_app: { url: MINI_APP_URL } }]]
        }
      });
      sent++;
      await new Promise(r => setTimeout(r, 60));
    } catch (e) { failed++; }
  }
  await bot.sendMessage(msg.chat.id, `✅ Foto verstuurd naar ${sent} subscribers!`);
});

// ── Handle video van admin — stuur naar alle subscribers ──────────────────────
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
        reply_markup: {
          inline_keyboard: [[{ text: '🛍️ Open Menu', web_app: { url: MINI_APP_URL } }]]
        }
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
app.get('/health', (_, res) => res.json({ status: 'ok', bot: 'MFFlavours' }));
app.listen(process.env.PORT || 3001, () => console.log('🚀 Server running'));
console.log('✅ Bot started — listening for messages...');
