const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const MINI_APP_URL = process.env.MINI_APP_URL;
const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID;

// /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from.first_name || 'there';
  await bot.sendMessage(chatId,
    `💰 *Welcome to MFFlavours, ${firstName}!*\n\n🔥 Premium quality — Fast & Discreet\n\n_Browse our full menu and place your order directly through the app below._`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '🛍️ Open Menu', web_app: { url: MINI_APP_URL } }]]
      }
    }
  );
});

// /menu
bot.onText(/\/menu/, async (msg) => {
  await bot.sendMessage(msg.chat.id, '🛍️ Tap below to open the MFFlavours menu:', {
    reply_markup: {
      keyboard: [[{ text: '🛍️ Open Menu', web_app: { url: MINI_APP_URL } }]],
      resize_keyboard: true
    }
  });
});

// /admin — owner only
bot.onText(/\/admin/, async (msg) => {
  if (String(msg.from.id) !== String(ADMIN_TELEGRAM_ID)) {
    return bot.sendMessage(msg.chat.id, '⛔ Access denied.');
  }
  await bot.sendMessage(msg.chat.id, '🔐 *Admin Panel*', {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[{ text: '⚙️ Open Admin Panel', url: process.env.ADMIN_URL }]]
    }
  });
});

// /help
bot.onText(/\/help/, async (msg) => {
  await bot.sendMessage(msg.chat.id,
    `*MFFlavours — How it works:*\n\n1️⃣ Tap *Open Menu* to browse\n2️⃣ Select your size & add to cart\n3️⃣ Place your order\n4️⃣ We confirm via Telegram\n\n📦 Discreet packaging guaranteed\n💬 Questions? Just message us!`,
    { parse_mode: 'Markdown' }
  );
});

// Order from mini app
bot.on('web_app_data', async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || msg.from.first_name;
  const userId = msg.from.id;

  let orderData;
  try {
    orderData = JSON.parse(msg.web_app_data.data);
  } catch {
    return bot.sendMessage(chatId, '❌ Failed to process order. Please try again.');
  }

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      telegram_id: userId,
      username,
      items: orderData.items,
      total: orderData.total,
      notes: orderData.notes || '',
      status: 'pending'
    })
    .select()
    .single();

  if (error) {
    console.error('Order save error:', error);
    return bot.sendMessage(chatId, '❌ Something went wrong. Please try again.');
  }

  const itemList = orderData.items
    .map(i => `  • ${i.name} (${i.varLabel}) x${i.qty} — €${(i.price * i.qty).toFixed(2)}`)
    .join('\n');

  // Confirm to customer
  await bot.sendMessage(chatId,
    `✅ *Order Received!*\n\n${itemList}\n\n💰 *Total: €${orderData.total}*\n\n_We'll be in touch shortly to confirm._`,
    { parse_mode: 'Markdown' }
  );

  // Notify admin with approve/decline buttons
  await bot.sendMessage(ADMIN_TELEGRAM_ID,
    `🔔 *New Order #${order.id}*\n\n👤 @${username} (ID: ${userId})\n\n${itemList}\n\n💰 *Total: €${orderData.total}*\n📝 Notes: ${orderData.notes || 'none'}`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Confirm', callback_data: `confirm_${order.id}_${chatId}` },
          { text: '❌ Decline', callback_data: `decline_${order.id}_${chatId}` }
        ]]
      }
    }
  );
});

// Admin callback buttons
bot.on('callback_query', async (query) => {
  if (String(query.from.id) !== String(ADMIN_TELEGRAM_ID)) return;
  const [action, orderId, customerChatId] = query.data.split('_');

  if (action === 'confirm') {
    await supabase.from('orders').update({ status: 'confirmed' }).eq('id', orderId);
    await bot.sendMessage(customerChatId,
      '✅ *Your order has been confirmed!*\nWe\'ll contact you shortly with details.',
      { parse_mode: 'Markdown' }
    );
    await bot.answerCallbackQuery(query.id, { text: 'Order confirmed ✅' });
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: query.message.chat.id, message_id: query.message.message_id }
    );
  }

  if (action === 'decline') {
    await supabase.from('orders').update({ status: 'declined' }).eq('id', orderId);
    await bot.sendMessage(customerChatId,
      '❌ *Your order could not be processed.*\nPlease contact us directly for assistance.',
      { parse_mode: 'Markdown' }
    );
    await bot.answerCallbackQuery(query.id, { text: 'Order declined ❌' });
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: query.message.chat.id, message_id: query.message.message_id }
    );
  }
});

// Express health check (required for Railway)
const app = express();
app.use(cors());
app.get('/health', (_, res) => res.json({ status: 'ok', bot: 'MFFlavours' }));
app.listen(process.env.PORT || 3001, () => console.log('🚀 Server running'));
console.log('✅ Bot started — listening for messages...');
