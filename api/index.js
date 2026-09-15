/*
|--------------------------------------------------------------------------
| 𝐀𝐔𝐑𝐀 𝐂𝐇𝐀𝐍𝐍𝐄𝐋 𝐒𝐄𝐋𝐋 (TURBO SPEED ENGINE ⚡)
| - Bot Name: 𝐀𝐔𝐑𝐀 𝐂𝐇𝐀𝐍𝐍𝐄𝐋 𝐒𝐄𝐋𝐋
| - Bot Username: @AuraChannelSellBot
| - Super Admin: 8045367594
| - Render: https://aura-channel-sell.onrender.com
| - Firebase: https://aura-channel-sell-default-rtdb.firebaseio.com/
|--------------------------------------------------------------------------
*/

const express = require('express');

// ==========================================
// ১. আপনার দেওয়া বট ও সার্ভার কনফিগারেশন
// ==========================================
const BOT_TOKEN = '8362797762:AAH23qRjM7Lte-Mfcmxq9mNCNEZetXpvFZg';
const BOT_USERNAME = 'AuraChannelSellBot';
const BOT_NAME = '𝐀𝐔𝐑𝐀 𝐂𝐇𝐀𝐍𝐍𝐄𝐋 𝐒𝐄𝐋𝐋';
const APP_URL = 'https://aura-channel-sell.onrender.com';
const SUPER_ADMIN_ID = '8045367594';

// ডিফল্ট ভ্যালু
const DEFAULT_CHANNEL_OWNER = '@Sakib_Developer1';
const DEFAULT_CHANNEL_LOG_ID = '-1003945593094';  // চ্যানেল সেল রিকোয়েস্ট চ্যানেল
const DEFAULT_WITHDRAW_LOG_ID = '-1003945593094'; // উইথড্র রিকোয়েস্ট চ্যানেল
const DEFAULT_SUPPORT_URL = 'https://t.me/AuraSupportsBot';
const DEVELOPER_NAME = 'SΛKIB 〆 DΞVΞLOPΞR';
const DEVELOPER_LINK = 'https://t.me/Sakib_Developer1';

/*
|--------------------------------------------------------------------------
| ২. ফায়ারবেস কনফিগারেশন (aura-channel-sell)
|--------------------------------------------------------------------------
*/
const ACTIVE_FIREBASE_URL = 'https://aura-channel-sell-default-rtdb.firebaseio.com';
const FIREBASE_API_KEY = 'AIzaSyB_obVWto2nUbwPptTocQn4INllEJkxuhY';
const FIREBASE_AUTH_EMAIL = 'tasin301210@gmail.com';
const FIREBASE_AUTH_PASSWORD = 'mayabiri#';

/*
|--------------------------------------------------------------------------
| ৩. ইন-মেমোরি RAM ক্যাশিং (0ms ফাস্ট রেসপন্স)
|--------------------------------------------------------------------------
*/
const cache = {
    users: new Map(),
    settings: new Map(),
    registeredChannels: new Map(),
    admins: {},
    adminStates: new Map(),
    userStates: new Map()
};

/*
|--------------------------------------------------------------------------
| ৪. ফরম্যাটিং হেল্পার
|--------------------------------------------------------------------------
*/
function escapeHtml(text) {
    if (typeof text !== 'string') text = String(text ?? '');
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatNumber(number) {
    const num = Number(number);
    if (!isFinite(num) || isNaN(num)) return '0';
    return (Math.round(num * 100) / 100).toString();
}

function normalizeText(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
}

function isNumericAmount(value) {
    if (typeof value !== 'string' && typeof value !== 'number') return false;
    const str = String(value).trim();
    return str !== '' && !isNaN(Number(str)) && isFinite(Number(str));
}

function formatTimestamp(timestampInSeconds) {
    if (!timestampInSeconds) return 'N/A';
    const d = new Date(Number(timestampInSeconds) * 1000);
    return d.toLocaleString('en-US', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

function normalizeChannelInput(input) {
    input = normalizeText(input).trim();
    if (!input) return '';
    if (input.startsWith('-100')) return input;
    const linkMatch = input.match(/(?:https?:\/\/)?(?:www\.)?t\.me\/([A-Za-z0-9_]{4,32})/i);
    if (linkMatch) return '@' + linkMatch[1];
    if (input.startsWith('@')) return input;
    if (/^[A-Za-z0-9_]{4,32}$/.test(input)) return '@' + input;
    return input;
}

/*
|--------------------------------------------------------------------------
| ৫. ফায়ারবেস সিকিউর ক্লায়েন্ট (REST API + Token)
|--------------------------------------------------------------------------
*/
let cachedToken = null;
let tokenExpiresAt = 0;

async function getFirebaseToken() {
    const now = Math.floor(Date.now() / 1000);
    if (cachedToken && now < tokenExpiresAt) return cachedToken;

    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: FIREBASE_AUTH_EMAIL,
                password: FIREBASE_AUTH_PASSWORD,
                returnSecureToken: true
            })
        });
        if (!res.ok) return null;
        const data = await res.json();
        if (!data?.idToken) return null;

        cachedToken = data.idToken;
        tokenExpiresAt = now + Math.max(60, (parseInt(data.expiresIn) || 3600) - 60);
        return cachedToken;
    } catch {
        return null;
    }
}

async function firebaseRequest(path, method = 'GET', data = null) {
    path = path.replace(/^\/+|\/+$/g, '');
    if (!path) return null;

    const token = await getFirebaseToken();
    let url = `${ACTIVE_FIREBASE_URL.replace(/\/+$/, '')}/${path}.json${token ? `?auth=${encodeURIComponent(token)}` : ''}`;

    const options = {
        method: method.toUpperCase(),
        headers: { 'Content-Type': 'application/json' }
    };
    if (data !== null) options.body = JSON.stringify(data);

    try {
        const res = await fetch(url, options);
        if (!res.ok) return null;
        const text = await res.text();
        return (text === 'null' || text === '') ? null : JSON.parse(text);
    } catch {
        return null;
    }
}

/*
|--------------------------------------------------------------------------
| ৬. টেলিগ্রাম API ইঞ্জিন
|--------------------------------------------------------------------------
*/
async function telegramApi(method, params = {}) {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });
        return await res.json().catch(() => null);
    } catch (e) {
        return { ok: false, description: e.message || 'Network error' };
    }
}

async function sendMessage(chatId, text, replyMarkup = null) {
    const params = {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
    };
    if (replyMarkup) params.reply_markup = replyMarkup;
    return await telegramApi('sendMessage', params);
}

async function editMessageText(chatId, messageId, text, replyMarkup = null) {
    const params = {
        chat_id: chatId,
        message_id: messageId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
    };
    if (replyMarkup) params.reply_markup = replyMarkup;
    return await telegramApi('editMessageText', params);
}

async function answerCallback(callbackId, text = '', showAlert = false) {
    return await telegramApi('answerCallbackQuery', {
        callback_query_id: callbackId,
        text: text,
        show_alert: showAlert
    });
}

/*
|--------------------------------------------------------------------------
| ৭. ডাটাবেজ হেল্পার
|--------------------------------------------------------------------------
*/
async function getUser(userId) {
    const uid = String(userId);
    if (cache.users.has(uid)) return cache.users.get(uid);
    const res = await firebaseRequest(`users/${uid}`);
    if (res && typeof res === 'object') {
        cache.users.set(uid, res);
        return res;
    }
    return null;
}

function updateUser(userId, data) {
    const uid = String(userId);
    const current = cache.users.get(uid) || {};
    const updated = { ...current, ...data };
    cache.users.set(uid, updated);
    firebaseRequest(`users/${uid}`, 'PATCH', data).catch(console.error);
    return true;
}

function getSetting(key, defaultValue = '') {
    if (cache.settings.has(key)) return cache.settings.get(key);
    return defaultValue;
}

function setSetting(key, value) {
    cache.settings.set(key, value);
    firebaseRequest(`settings/${key}`, 'PUT', value).catch(console.error);
    return true;
}

async function getAllUsers() {
    const res = await firebaseRequest('users');
    return res && typeof res === 'object' ? res : {};
}

function isSuperAdmin(userId) {
    return String(userId).trim() === SUPER_ADMIN_ID;
}

function isAdmin(userId) {
    const uid = String(userId).trim();
    if (isSuperAdmin(uid)) return true;
    return Boolean(cache.admins[uid]?.active === true);
}

/*
|--------------------------------------------------------------------------
| ৮. কীবোর্ড ও বাটনসমূহ
|--------------------------------------------------------------------------
*/
function getUserMenu(userId) {
    const keyboard = [
        [{ text: '📢 Sell Channel' }, { text: '📜 History' }],
        [{ text: '👤 My Account' }, { text: '💸 Withdraw' }],
        [{ text: '📮 Referral' }, { text: '📊 System Status' }]
    ];
    if (isAdmin(userId)) {
        keyboard.push([{ text: '🛠 Admin Panel' }]);
    }
    return { keyboard, resize_keyboard: true };
}

function getAdminMenu() {
    return {
        keyboard: [
            [{ text: '⚙️ Central Settings' }, { text: '👥 User & Balance' }],
            [{ text: '📢 Broadcast Message' }, { text: '🔙 Back to User Panel' }]
        ],
        resize_keyboard: true
    };
}

function centralSettingsKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: '💰 Channel Price', callback_data: 'cfg_price' },
                { text: '👥 Referral Bonus', callback_data: 'cfg_ref' }
            ],
            [
                { text: '💸 Min Withdraw', callback_data: 'cfg_min_wd' },
                { text: '🪙 Currency Name', callback_data: 'cfg_curr' }
            ],
            [
                { text: '📢 Channel Log ID', callback_data: 'cfg_chan_log' },
                { text: '💳 Withdraw Log ID', callback_data: 'cfg_wd_log' }
            ],
            [
                { text: '👤 Target Owner', callback_data: 'cfg_owner_target' }
            ]
        ]
    };
}

function getCancelKeyboard() {
    return { keyboard: [[{ text: '/cancel' }]], resize_keyboard: true, one_time_keyboard: true };
}

function publicActionKeyboard(type, id) {
    return {
        inline_keyboard: [
            [
                { text: '✅ Approve', callback_data: `${type}_app_${id}` },
                { text: '❌ Reject', callback_data: `${type}_rej_${id}` }
            ]
        ]
    };
}

function completedKeyboard() {
    return {
        inline_keyboard: [
            [{ text: '🚀 Join Bot', url: `https://t.me/${BOT_USERNAME}` }]
        ]
    };
}

/*
|--------------------------------------------------------------------------
| ৯. পাবলিক অ্যালার্ট টেমপ্লেট
|--------------------------------------------------------------------------
*/
function buildChannelPendingText(order, channelPrice, currency) {
    return `🔔 <b>New Channel Sell Request Pending Alert!</b>\n\n` +
        `👤 <b>Seller:</b> ${escapeHtml(order.user_name)}\n` +
        `🔗 <b>Username:</b> ${escapeHtml(order.user_username || 'N/A')}\n` +
        `📌 <b>User ID:</b> <code>${order.user_id}</code>\n\n` +
        `📢 <b>Channel:</b> ${escapeHtml(order.channel_title)}\n` +
        `🆔 <b>Channel ID:</b> <code>${order.channel_id}</code>\n` +
        `🔗 <b>Target:</b> ${escapeHtml(order.channel_username)}\n\n` +
        `💰 <b>Price:</b> <b>${formatNumber(channelPrice)} ${currency}</b>\n` +
        `🧾 <b>Order ID:</b> <code>${order.order_id}</code>\n` +
        `🕒 <b>Submitted At:</b> <code>${formatTimestamp(order.created_at)}</code>\n\n` +
        `⚠️ <b>Status:</b> <b>PENDING REVIEW ⏳</b>`;
}

function buildChannelApprovedText(order, adminUser, channelPrice, currency, now) {
    return `✅ <b>Channel Sell Request Approved!</b>\n\n` +
        `👤 <b>Seller:</b> ${escapeHtml(order.user_name)}\n` +
        `🔗 <b>Username:</b> ${escapeHtml(order.user_username || 'N/A')}\n` +
        `📌 <b>User ID:</b> <code>${order.user_id}</code>\n\n` +
        `📢 <b>Channel:</b> ${escapeHtml(order.channel_title)}\n` +
        `🆔 <b>Channel ID:</b> <code>${order.channel_id}</code>\n` +
        `🔗 <b>Target:</b> ${escapeHtml(order.channel_username)}\n\n` +
        `💰 <b>Rewarded:</b> <b>${formatNumber(channelPrice)} ${currency}</b>\n` +
        `🧾 <b>Order ID:</b> <code>${order.order_id}</code>\n` +
        `🕒 <b>Submitted At:</b> <code>${formatTimestamp(order.created_at)}</code>\n` +
        `✅ <b>Approved At:</b> <code>${formatTimestamp(now)}</code>\n` +
        `👮 <b>Approved By:</b> <b>${escapeHtml(adminUser)}</b>\n\n` +
        `🎉 <b>Status:</b> <b>COMPLETED & TRANSFERRED</b>`;
}

function buildChannelRejectedText(order, adminUser, now) {
    return `❌ <b>Channel Sell Request Rejected!</b>\n\n` +
        `👤 <b>Seller:</b> ${escapeHtml(order.user_name)}\n` +
        `🔗 <b>Username:</b> ${escapeHtml(order.user_username || 'N/A')}\n` +
        `📌 <b>User ID:</b> <code>${order.user_id}</code>\n\n` +
        `📢 <b>Channel:</b> ${escapeHtml(order.channel_title)}\n` +
        `🆔 <b>Channel ID:</b> <code>${order.channel_id}</code>\n` +
        `🔗 <b>Target:</b> ${escapeHtml(order.channel_username)}\n\n` +
        `🧾 <b>Order ID:</b> <code>${order.order_id}</code>\n` +
        `🕒 <b>Submitted At:</b> <code>${formatTimestamp(order.created_at)}</code>\n` +
        `❌ <b>Rejected At:</b> <code>${formatTimestamp(now)}</code>\n` +
        `👮 <b>Rejected By:</b> <b>${escapeHtml(adminUser)}</b>\n\n` +
        `⚠️ <b>Status:</b> <b>REJECTED (Ownership Not Transferred)</b>`;
}

function buildWithdrawPendingText(withdraw, currency) {
    return `💳 <b>New Withdrawal Request Pending Alert!</b>\n\n` +
        `👤 <b>User:</b> ${escapeHtml(withdraw.user_name)}\n` +
        `🔗 <b>Username:</b> ${escapeHtml(withdraw.user_username || 'N/A')}\n` +
        `📌 <b>User ID:</b> <code>${withdraw.user_id}</code>\n\n` +
        `💰 <b>Amount:</b> <b>${formatNumber(withdraw.amount)} ${currency}</b>\n` +
        `🏦 <b>Payment Method:</b> <b>${escapeHtml(withdraw.method)}</b>\n` +
        `📬 <b>Account / Address:</b> <code>${escapeHtml(withdraw.address)}</code>\n` +
        `🧾 <b>Trx ID:</b> <code>${withdraw.trx_id}</code>\n` +
        `🕒 <b>Requested At:</b> <code>${formatTimestamp(withdraw.created_at)}</code>\n\n` +
        `⏳ <b>Status:</b> <b>PENDING PAYMENT</b>`;
}

function buildWithdrawApprovedText(withdraw, adminUser, currency, now) {
    return `✅ <b>Withdrawal Request Approved & Paid!</b>\n\n` +
        `👤 <b>User:</b> ${escapeHtml(withdraw.user_name)}\n` +
        `🔗 <b>Username:</b> ${escapeHtml(withdraw.user_username || 'N/A')}\n` +
        `📌 <b>User ID:</b> <code>${withdraw.user_id}</code>\n\n` +
        `💰 <b>Amount:</b> <b>${formatNumber(withdraw.amount)} ${currency}</b>\n` +
        `🏦 <b>Payment Method:</b> <b>${escapeHtml(withdraw.method)}</b>\n` +
        `📬 <b>Account / Address:</b> <code>${escapeHtml(withdraw.address)}</code>\n` +
        `🧾 <b>Trx ID:</b> <code>${withdraw.trx_id}</code>\n` +
        `✅ <b>Approved At:</b> <code>${formatTimestamp(now)}</code>\n` +
        `👮 <b>Paid By:</b> <b>${escapeHtml(adminUser)}</b>\n\n` +
        `🎉 <b>Status:</b> <b>PAYMENT COMPLETED</b>`;
}

function buildWithdrawRejectedText(withdraw, adminUser, currency, now) {
    return `❌ <b>Withdrawal Request Rejected!</b>\n\n` +
        `👤 <b>User:</b> ${escapeHtml(withdraw.user_name)}\n` +
        `📌 <b>User ID:</b> <code>${withdraw.user_id}</code>\n` +
        `💰 <b>Amount:</b> <b>${formatNumber(withdraw.amount)} ${currency}</b> (Refunded)\n` +
        `🧾 <b>Trx ID:</b> <code>${withdraw.trx_id}</code>\n` +
        `❌ <b>Rejected At:</b> <code>${formatTimestamp(now)}</code>\n` +
        `👮 <b>Rejected By:</b> <b>${escapeHtml(adminUser)}</b>\n\n` +
        `⚠️ <b>Status:</b> <b>REJECTED & REFUNDED</b>`;
}

/*
|--------------------------------------------------------------------------
| ১০. আপডেট প্রসেসর
|--------------------------------------------------------------------------
*/
async function handleUpdate(update) {
    // -------------------------------------------------------------
    // ১. CALLBACK QUERIES
    // -------------------------------------------------------------
    if (update.callback_query) {
        const callback = update.callback_query;
        const fromId = String(callback.from.id);
        const data = callback.data || '';
        const chatId = callback.message?.chat?.id;
        const messageId = callback.message?.message_id;

        // ইউজার সাবমিশন কনফার্মেশন
        if (data.startsWith('submit_channel_confirm_') || data === 'submit_channel_cancel') {
            if (data === 'submit_channel_cancel') {
                answerCallback(callback.id, "Submission cancelled.");
                cache.userStates.delete(fromId);
                if (chatId && messageId) telegramApi('deleteMessage', { chat_id: chatId, message_id: messageId });
                sendMessage(fromId, "❌ <b>Channel submission cancelled.</b>", getUserMenu(fromId));
                return;
            }

            const tempOrderKey = data.replace('submit_channel_confirm_', '');
            const pendingData = cache.userStates.get(fromId);

            if (!pendingData || pendingData.tempKey !== tempOrderKey) {
                answerCallback(callback.id, "Session expired! Please submit again.", true);
                return;
            }

            answerCallback(callback.id);
            cache.userStates.delete(fromId);

            const channelReqChannel = getSetting('channel_request_channel', DEFAULT_CHANNEL_LOG_ID);
            const channelPrice = Number(getSetting('channel_sell_price', 10));
            const currency = getSetting('currency_name', 'BDT');

            const savedOrder = await firebaseRequest('channel_sales', 'POST', pendingData.order);
            if (savedOrder?.name) {
                const lockData = {
                    status: 'pending',
                    order_id: pendingData.order.order_id,
                    user_id: fromId,
                    channel_title: pendingData.order.channel_title,
                    updated_at: Math.floor(Date.now() / 1000)
                };
                cache.registeredChannels.set(pendingData.order.channel_id, 'pending');
                firebaseRequest(`registered_channels/${pendingData.order.channel_id}`, 'PUT', lockData).catch(() => {});

                await sendMessage(
                    channelReqChannel,
                    buildChannelPendingText(pendingData.order, channelPrice, currency),
                    publicActionKeyboard('cs', savedOrder.name)
                );

                if (chatId && messageId) telegramApi('deleteMessage', { chat_id: chatId, message_id: messageId });

                sendMessage(fromId,
                    `✅ <b>Request Submitted Successfully!</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
                    `📢 <b>Channel:</b> ${escapeHtml(pendingData.order.channel_title)}\n` +
                    `🧾 <b>Order ID:</b> <code>${pendingData.order.order_id}</code>\n\n` +
                    `⚠️ <i>নিশ্চিত করুন যে আপনি চ্যানেলের ওনারশিপ <b>${escapeHtml(getSetting('channel_owner_target', DEFAULT_CHANNEL_OWNER))}</b> একাউন্টে ট্রান্সফার করেছেন।</i>`,
                    getUserMenu(fromId)
                );
            }
            return;
        }

        // =========================================================================
        // পাবলিক বাটনে ক্লিক ও পপ-আপ পারমিশন অ্যালার্ট (সাধারণ ইউজারের জন্য)
        // =========================================================================
        const channelMatch = data.match(/^cs_(app|rej)_([A-Za-z0-9_-]+)$/);
        const withdrawMatch = data.match(/^wd_(app|rej)_([A-Za-z0-9_-]+)$/);

        if (channelMatch || withdrawMatch) {
            // যদি এডমিন না হয়, সরাসরি পপ-আপ অ্যালার্ট দেখাবে
            if (!isAdmin(fromId)) {
                return await answerCallback(callback.id, "⛔ Access Denied! You are not authorized.", true);
            }

            const now = Math.floor(Date.now() / 1000);
            const adminUsername = callback.from.username ? `@${callback.from.username}` : callback.from.first_name;
            const currency = getSetting('currency_name', 'BDT');

            // --- চ্যানেল এপ্রুভ / রিজেক্ট ---
            if (channelMatch) {
                const action = channelMatch[1];
                const saleKey = channelMatch[2];
                const sale = await firebaseRequest(`channel_sales/${saleKey}`);

                if (!sale || sale.status !== 'pending') {
                    return await answerCallback(callback.id, "⚠️ Order already processed!", true);
                }

                answerCallback(callback.id);

                if (action === 'app') {
                    const channelPrice = Number(getSetting('channel_sell_price', 10));

                    cache.registeredChannels.set(sale.channel_id, 'approved');
                    firebaseRequest(`registered_channels/${sale.channel_id}/status`, 'PUT', 'approved').catch(() => {});

                    firebaseRequest(`channel_sales/${saleKey}`, 'PATCH', {
                        status: 'approved',
                        processed_by: fromId,
                        processed_at: now
                    }).catch(() => {});

                    const seller = await getUser(sale.user_id);
                    if (seller) {
                        const newBal = Number(seller.balance || 0) + channelPrice;
                        const newSold = Number(seller.total_channels_sold || 0) + 1;
                        updateUser(sale.user_id, { balance: newBal, total_channels_sold: newSold });

                        sendMessage(sale.user_id,
                            `🎉 <b>Channel Sale Approved!</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
                            `📢 Channel: <b>${escapeHtml(sale.channel_title)}</b>\n` +
                            `💰 Rewarded: <b>+${formatNumber(channelPrice)} ${currency}</b>\n` +
                            `🧾 Order ID: <code>${sale.order_id}</code>\n` +
                            `💳 New Balance: <b>${formatNumber(newBal)} ${currency}</b>`
                        ).catch(() => {});
                    }

                    if (chatId && messageId) {
                        editMessageText(chatId, messageId, buildChannelApprovedText(sale, adminUsername, channelPrice, currency, now), completedKeyboard());
                    }
                } else if (action === 'rej') {
                    // রিজেক্ট হলে পুনরায় সাবমিটের জন্য স্ট্যাটাস rejected
                    cache.registeredChannels.set(sale.channel_id, 'rejected');
                    firebaseRequest(`registered_channels/${sale.channel_id}/status`, 'PUT', 'rejected').catch(() => {});

                    firebaseRequest(`channel_sales/${saleKey}`, 'PATCH', {
                        status: 'rejected',
                        processed_by: fromId,
                        processed_at: now
                    }).catch(() => {});

                    sendMessage(sale.user_id,
                        `❌ <b>Channel Sale Rejected!</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
                        `📢 Channel: <b>${escapeHtml(sale.channel_title)}</b>\n` +
                        `🧾 Order ID: <code>${sale.order_id}</code>\n` +
                        `⚠️ Reason: Channel ownership was not transferred to ${escapeHtml(getSetting('channel_owner_target', DEFAULT_CHANNEL_OWNER))}.\n\n` +
                        `<i>ওনারশিপ ট্রান্সফার সম্পন্ন করে আবার চেষ্টা করুন।</i>`
                    ).catch(() => {});

                    if (chatId && messageId) {
                        editMessageText(chatId, messageId, buildChannelRejectedText(sale, adminUsername, now), completedKeyboard());
                    }
                }
                return;
            }

            // --- উইথড্র এপ্রুভ / রিজেক্ট ---
            if (withdrawMatch) {
                const action = withdrawMatch[1];
                const withdrawKey = withdrawMatch[2];
                const withdraw = await firebaseRequest(`withdrawals/${withdrawKey}`);

                if (!withdraw || withdraw.status !== 'pending') {
                    return await answerCallback(callback.id, "⚠️ Request already processed!", true);
                }

                answerCallback(callback.id);

                if (action === 'app') {
                    firebaseRequest(`withdrawals/${withdrawKey}`, 'PATCH', {
                        status: 'approved',
                        processed_by: fromId,
                        processed_at: now
                    }).catch(() => {});

                    sendMessage(withdraw.user_id,
                        `🎉 <b>Withdrawal Completed!</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
                        `💰 Amount: <b>${formatNumber(withdraw.amount)} ${currency}</b>\n` +
                        `🏦 Method: <b>${escapeHtml(withdraw.method)}</b>\n` +
                        `🧾 Trx ID: <code>${withdraw.trx_id}</code>\n` +
                        `🕒 Paid At: <code>${formatTimestamp(now)}</code>`
                    ).catch(() => {});

                    if (chatId && messageId) {
                        editMessageText(chatId, messageId, buildWithdrawApprovedText(withdraw, adminUsername, currency, now), completedKeyboard());
                    }
                } else if (action === 'rej') {
                    const targetUser = await getUser(withdraw.user_id);
                    if (targetUser) {
                        const newBal = Number(targetUser.balance || 0) + Number(withdraw.amount || 0);
                        updateUser(withdraw.user_id, { balance: newBal });
                    }

                    firebaseRequest(`withdrawals/${withdrawKey}`, 'PATCH', {
                        status: 'rejected',
                        processed_by: fromId,
                        processed_at: now,
                        refunded: true
                    }).catch(() => {});

                    sendMessage(withdraw.user_id,
                        `❌ <b>Withdrawal Rejected!</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
                        `💰 Amount: <b>${formatNumber(withdraw.amount)} ${currency}</b> has been refunded.\n` +
                        `🧾 Trx ID: <code>${withdraw.trx_id}</code>`
                    ).catch(() => {});

                    if (chatId && messageId) {
                        editMessageText(chatId, messageId, buildWithdrawRejectedText(withdraw, adminUsername, currency, now), completedKeyboard());
                    }
                }
                return;
            }
        }

        // =========================================================================
        // এডমিন সেন্ট্রাল সেটিংস কলব্যাক
        // =========================================================================
        if (isAdmin(fromId)) {
            if (data === 'cfg_price') {
                answerCallback(callback.id);
                cache.adminStates.set(fromId, { action: 'set_channel_price' });
                sendMessage(fromId, "💰 <b>প্রতি চ্যানেল বিক্রির রেট পাঠান (সংখ্যা):</b>", getCancelKeyboard());
                return;
            }
            if (data === 'cfg_ref') {
                answerCallback(callback.id);
                cache.adminStates.set(fromId, { action: 'set_ref_bonus' });
                sendMessage(fromId, "👥 <b>প্রতি রেফারেল বোনাসের রেট পাঠান (সংখ্যা):</b>", getCancelKeyboard());
                return;
            }
            if (data === 'cfg_min_wd') {
                answerCallback(callback.id);
                cache.adminStates.set(fromId, { action: 'set_min_wd' });
                sendMessage(fromId, "💸 <b>মিনিমাম উইথড্র লিমিট পাঠান (সংখ্যা):</b>", getCancelKeyboard());
                return;
            }
            if (data === 'cfg_curr') {
                answerCallback(callback.id);
                cache.adminStates.set(fromId, { action: 'set_currency' });
                sendMessage(fromId, "🪙 <b>কারেন্সির নাম লিখুন (যেমন: BDT):</b>", getCancelKeyboard());
                return;
            }
            if (data === 'cfg_chan_log') {
                answerCallback(callback.id);
                cache.adminStates.set(fromId, { action: 'set_chan_log' });
                sendMessage(fromId, "📢 <b>চ্যানেল সেল লগ চ্যানেলের ID পাঠান (যেমন: -100...):</b>", getCancelKeyboard());
                return;
            }
            if (data === 'cfg_wd_log') {
                answerCallback(callback.id);
                cache.adminStates.set(fromId, { action: 'set_wd_log' });
                sendMessage(fromId, "💳 <b>উইথড্র রিকোয়েস্ট লগ চ্যানেলের ID পাঠান (যেমন: -100...):</b>", getCancelKeyboard());
                return;
            }
            if (data === 'cfg_owner_target') {
                answerCallback(callback.id);
                cache.adminStates.set(fromId, { action: 'set_owner_target' });
                sendMessage(fromId, "👤 <b>যে আইডিতে ওনারশিপ নিতে চান তার Username পাঠান (যেমন: @Sakib_Developer1):</b>", getCancelKeyboard());
                return;
            }
        }
    }

    // -------------------------------------------------------------
    // ২. টেক্সট ও কমান্ড মেসেজ হ্যান্ডলার
    // -------------------------------------------------------------
    if (update.message) {
        const msg = update.message;
        const fromId = String(msg.from.id).trim();
        const chatId = String(msg.chat.id);
        const text = normalizeText(msg.text || '');
        const isAdm = isAdmin(fromId);

        let user = await getUser(fromId);
        if (!user) {
            let refBy = null;
            if (text.startsWith('/start')) {
                const match = text.match(/^\/start\s+(\d+)$/);
                if (match && match[1] !== fromId) refBy = match[1];
            }
            user = {
                user_id: fromId,
                first_name: msg.from.first_name || 'User',
                username: msg.from.username || '',
                balance: 0,
                total_channels_sold: 0,
                total_referrals: 0,
                referred_by: refBy,
                created_at: Math.floor(Date.now() / 1000)
            };
            cache.users.set(fromId, user);
            firebaseRequest(`users/${fromId}`, 'PUT', user).catch(() => {});

            if (refBy) {
                const refUser = await getUser(refBy);
                if (refUser) {
                    const refBonus = Number(getSetting('referral_bonus', 2));
                    const newBal = Number(refUser.balance || 0) + refBonus;
                    const newRefs = Number(refUser.total_referrals || 0) + 1;
                    updateUser(refBy, { balance: newBal, total_referrals: newRefs });
                    sendMessage(refBy, `🎉 <b>New Referral Joined!</b>\n+${formatNumber(refBonus)} ${getSetting('currency_name', 'BDT')} added.`).catch(() => {});
                }
            }
        }

        if (text === '/cancel') {
            cache.userStates.delete(fromId);
            cache.adminStates.delete(fromId);
            sendMessage(chatId, "❌ Action Cancelled.", getUserMenu(fromId));
            return;
        }

        // =========================================================================
        // এডমিন স্টেটস
        // =========================================================================
        if (isAdm) {
            const aState = cache.adminStates.get(fromId);
            if (aState?.action) {
                const act = aState.action;

                if (act === 'set_channel_price' && isNumericAmount(text)) {
                    setSetting('channel_sell_price', Number(text));
                    cache.adminStates.delete(fromId);
                    sendMessage(chatId, `✅ <b>চ্যানেল রেট আপডেট হয়েছে: ${text}</b>`, getAdminMenu());
                    return;
                }
                if (act === 'set_ref_bonus' && isNumericAmount(text)) {
                    setSetting('referral_bonus', Number(text));
                    cache.adminStates.delete(fromId);
                    sendMessage(chatId, `✅ <b>রেফারেল বোনাস আপডেট হয়েছে: ${text}</b>`, getAdminMenu());
                    return;
                }
                if (act === 'set_min_wd' && isNumericAmount(text)) {
                    setSetting('min_withdraw', Number(text));
                    cache.adminStates.delete(fromId);
                    sendMessage(chatId, `✅ <b>মিনিমাম উইথড্র আপডেট হয়েছে: ${text}</b>`, getAdminMenu());
                    return;
                }
                if (act === 'set_currency') {
                    setSetting('currency_name', text.trim().toUpperCase());
                    cache.adminStates.delete(fromId);
                    sendMessage(chatId, `✅ <b>কারেন্সির নাম আপডেট হয়েছে: ${text.trim().toUpperCase()}</b>`, getAdminMenu());
                    return;
                }
                if (act === 'set_chan_log') {
                    setSetting('channel_request_channel', text.trim());
                    cache.adminStates.delete(fromId);
                    sendMessage(chatId, `✅ <b>চ্যানেল সেল লগ চ্যানেল সেট হয়েছে: ${text.trim()}</b>`, getAdminMenu());
                    return;
                }
                if (act === 'set_wd_log') {
                    setSetting('withdraw_request_channel', text.trim());
                    cache.adminStates.delete(fromId);
                    sendMessage(chatId, `✅ <b>উইথড্র লগ চ্যানেল সেট হয়েছে: ${text.trim()}</b>`, getAdminMenu());
                    return;
                }
                if (act === 'set_owner_target') {
                    let target = text.trim();
                    if (!target.startsWith('@')) target = '@' + target;
                    setSetting('channel_owner_target', target);
                    cache.adminStates.delete(fromId);
                    sendMessage(chatId, `✅ <b>ওনারশিপ টার্গেট সেট হয়েছে: ${target}</b>`, getAdminMenu());
                    return;
                }
                if (act === 'broadcast_msg') {
                    cache.adminStates.delete(fromId);
                    sendMessage(chatId, "🚀 <b>ইউজারদের ব্রডকাস্ট পাঠানো শুরু হয়েছে...</b>");
                    const allUsers = await getAllUsers();
                    let success = 0;
                    for (const uId of Object.keys(allUsers)) {
                        try {
                            const res = await telegramApi('copyMessage', { chat_id: uId, from_chat_id: chatId, message_id: msg.message_id });
                            if (res?.ok) success++;
                        } catch {}
                    }
                    sendMessage(chatId, `📢 ব্রডকাস্ট সম্পন্ন! মোট ইউজার: ${success} জন।`, getAdminMenu());
                    return;
                }
            }
        }

        // =========================================================================
        // ইউজার চ্যানেল সেল
        // =========================================================================
        const uState = cache.userStates.get(fromId);
        if (uState?.action === 'awaiting_channel_for_sell' && text) {
            const normalized = normalizeChannelInput(text);
            sendMessage(chatId, "🔍 <i>Validating channel information...</i>");

            const chatRes = await telegramApi('getChat', { chat_id: normalized });
            if (!chatRes?.ok || !chatRes.result) {
                sendMessage(chatId,
                    `❌ <b>Channel Not Found!</b>\n\n` +
                    `নিশ্চিত করুন যে ইউজারনেম সঠিক এবং চ্যানেলটি পাবলিক রয়েছে।\nপুনরায় চেষ্টা করুন অথবা /cancel চাপুন:`
                );
                return;
            }

            const ch = chatRes.result;
            const numericId = String(ch.id);

            // চ্যানেল ডুপ্লিকেট লক চেক
            let currentStatus = cache.registeredChannels.get(numericId);
            if (!currentStatus) {
                const checkDb = await firebaseRequest(`registered_channels/${numericId}`);
                if (checkDb?.status) {
                    currentStatus = checkDb.status;
                    cache.registeredChannels.set(numericId, currentStatus);
                }
            }

            if (currentStatus === 'approved') {
                cache.userStates.delete(fromId);
                sendMessage(chatId,
                    `❌ <b>Channel Already Sold & Approved!</b>\n\n` +
                    `এই চ্যানেলটি ইতিমধ্যে একবার সেল এবং অ্যাপ্রুভ হয়েছে। এটি আর সেল করা সম্ভব নয়!`,
                    getUserMenu(fromId)
                );
                return;
            }

            if (currentStatus === 'pending') {
                cache.userStates.delete(fromId);
                sendMessage(chatId,
                    `⚠️ <b>Channel Request Under Review!</b>\n\n` +
                    `এই চ্যানেলটির একটি রিকোয়েস্ট বর্তমানে পেন্ডিং রয়েছে। অ্যাডমিন ফলাফল না দেওয়া পর্যন্ত অপেক্ষা করুন।`,
                    getUserMenu(fromId)
                );
                return;
            }

            const channelPrice = Number(getSetting('channel_sell_price', 10));
            const currency = getSetting('currency_name', 'BDT');
            const targetOwner = getSetting('channel_owner_target', DEFAULT_CHANNEL_OWNER);
            const orderId = `ORD${Math.floor(100000 + Math.random() * 900000)}`;
            const tempKey = `t_${Date.now()}`;

            const orderPayload = {
                order_id: orderId,
                user_id: fromId,
                user_name: msg.from.first_name || 'User',
                user_username: msg.from.username ? `@${msg.from.username}` : '',
                channel_id: numericId,
                channel_title: ch.title || 'Channel',
                channel_username: ch.username ? `@${ch.username}` : normalized,
                price: channelPrice,
                status: 'pending',
                created_at: Math.floor(Date.now() / 1000)
            };

            cache.userStates.set(fromId, {
                action: 'confirm_channel_submission',
                tempKey: tempKey,
                order: orderPayload
            });

            const previewText =
                `📋 <b>CHANNEL SELL PREVIEW</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
                `📢 <b>Channel:</b> ${escapeHtml(ch.title)}\n` +
                `🔗 <b>Username:</b> ${escapeHtml(ch.username ? `@${ch.username}` : normalized)}\n` +
                `🆔 <b>Channel ID:</b> <code>${numericId}</code>\n` +
                `💰 <b>Reward:</b> <b>${formatNumber(channelPrice)} ${currency}</b>\n` +
                `🧾 <b>Order ID:</b> <code>${orderId}</code>\n\n` +
                `⚠️ <b>গুরুত্বপূর্ণ নির্দেশিকা:</b>\n` +
                `চ্যানেলটির সম্পূর্ণ ওনারশিপ (Ownership) অবশ্যই <b>${escapeHtml(targetOwner)}</b> অ্যাকাউন্টে ট্রান্সফার করতে হবে। অন্যথায় রিকোয়েস্ট রিজেক্ট করা হবে।\n\n` +
                `<i>আপনি কি রিকোয়েস্টটি সাবমিট করতে চান?</i>`;

            const previewButtons = {
                inline_keyboard: [
                    [
                        { text: '✅ Confirm', callback_data: `submit_channel_confirm_${tempKey}` },
                        { text: '❌ Cancel', callback_data: 'submit_channel_cancel' }
                    ]
                ]
            };

            sendMessage(chatId, previewText, previewButtons);
            return;
        }

        // =========================================================================
        // উইথড্র ইনপুট
        // =========================================================================
        if (uState?.action === 'awaiting_withdraw_address' && text) {
            const u = await getUser(fromId);
            const minWithdraw = Number(getSetting('min_withdraw', 50));
            const currency = getSetting('currency_name', 'BDT');
            const currentBal = Number(u?.balance || 0);

            if (currentBal < minWithdraw) {
                cache.userStates.delete(fromId);
                sendMessage(chatId, `⚠️ Insufficient balance! Minimum: <b>${minWithdraw} ${currency}</b>`, getUserMenu(fromId));
                return;
            }

            const method = uState.method || 'bKash/Nagad';
            const address = text.trim();
            const trxId = `TXN${Date.now().toString().slice(-8)}`;
            const withdrawReqChannel = getSetting('withdraw_request_channel', DEFAULT_WITHDRAW_LOG_ID);

            const withdrawData = {
                trx_id: trxId,
                user_id: fromId,
                user_name: msg.from.first_name || 'User',
                user_username: msg.from.username ? `@${msg.from.username}` : '',
                amount: currentBal,
                method: method,
                address: address,
                status: 'pending',
                created_at: Math.floor(Date.now() / 1000)
            };

            updateUser(fromId, { balance: 0 });
            cache.userStates.delete(fromId);

            const created = await firebaseRequest('withdrawals', 'POST', withdrawData);
            if (created?.name) {
                await sendMessage(
                    withdrawReqChannel,
                    buildWithdrawPendingText(withdrawData, currency),
                    publicActionKeyboard('wd', created.name)
                );

                sendMessage(chatId,
                    `✅ <b>Withdrawal Submitted!</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
                    `💰 Amount: <b>${formatNumber(currentBal)} ${currency}</b>\n` +
                    `🏦 Method: <b>${escapeHtml(method)}</b>\n` +
                    `📬 Account: <code>${escapeHtml(address)}</code>\n` +
                    `🧾 Trx ID: <code>${trxId}</code>\n\n` +
                    `⏳ <i>Your request has been submitted to the public payment channel.</i>`,
                    getUserMenu(fromId)
                );
            }
            return;
        }

        // =========================================================================
        // মেনু অপশনস (ইউজার শুধু নিজের তথ্য দেখবে)
        // =========================================================================
        if (text === '/start' || text.startsWith('/start')) {
            const welcomeText =
                `👋 <b>Welcome to ${escapeHtml(BOT_NAME)}, ${escapeHtml(msg.from.first_name || 'User')}!</b>\n\n` +
                `এখানে আপনি টেলিগ্রাম চ্যানেল সেল করে সরাসরি টাকা আয় করতে পারবেন।\n` +
                `নিচের মেনু থেকে আপনার কাঙ্ক্ষিত অপশনটি সিলেক্ট করুন:`;
            sendMessage(chatId, welcomeText, getUserMenu(fromId));
            return;
        }

        if (text === '📢 Sell Channel') {
            cache.userStates.set(fromId, { action: 'awaiting_channel_for_sell' });
            const ownerTarget = getSetting('channel_owner_target', DEFAULT_CHANNEL_OWNER);
            sendMessage(chatId,
                `📢 <b>SELL TELEGRAM CHANNEL</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
                `আপনার চ্যানেলের <b>Username</b> (যেমন: <code>@channel</code>) অথবা <b>Public Link</b> পাঠান:\n\n` +
                `⚠️ <i>নোট: চ্যানেল ওনারশিপ অবশ্যই <b>${escapeHtml(ownerTarget)}</b> একাউন্টে ট্রান্সফার করতে হবে।</i>`,
                getCancelKeyboard()
            );
            return;
        }

        if (text === '📜 History') {
            sendMessage(chatId, "🔍 <i>Loading your personal history...</i>");
            const [salesRes, withdrawRes] = await Promise.all([
                firebaseRequest('channel_sales'),
                firebaseRequest('withdrawals')
            ]);

            const currency = getSetting('currency_name', 'BDT');
            let out = `📜 <b>YOUR PERSONAL ACTIVITY HISTORY</b>\n━━━━━━━━━━━━━━━━━━━━\n\n`;

            let hasData = false;
            if (salesRes && typeof salesRes === 'object') {
                out += `📢 <b>Channel Sales:</b>\n`;
                for (const item of Object.values(salesRes)) {
                    // শুধু এই ইউজারের নিজস্ব চ্যানেল হিস্টোরি দেখাবে
                    if (item && String(item.user_id) === fromId) {
                        hasData = true;
                        out += `• <b>${item.status.toUpperCase()}</b>: ${escapeHtml(item.channel_title)} (${formatNumber(item.price)} ${currency})\n  🧾 ID: <code>${item.order_id}</code> | ${formatTimestamp(item.created_at)}\n`;
                    }
                }
            }

            if (withdrawRes && typeof withdrawRes === 'object') {
                out += `\n💳 <b>Withdrawals:</b>\n`;
                for (const item of Object.values(withdrawRes)) {
                    // শুধু এই ইউজারের নিজস্ব উইথড্র হিস্টোরি দেখাবে
                    if (item && String(item.user_id) === fromId) {
                        hasData = true;
                        out += `• <b>${item.status.toUpperCase()}</b>: ${formatNumber(item.amount)} ${currency} (${escapeHtml(item.method)})\n  🧾 Trx: <code>${item.trx_id}</code> | ${formatTimestamp(item.created_at)}\n`;
                    }
                }
            }

            if (!hasData) out += `<i>No history found on your account.</i>`;
            sendMessage(chatId, out, getUserMenu(fromId));
            return;
        }

        if (text === '👤 My Account') {
            const u = await getUser(fromId);
            const currency = getSetting('currency_name', 'BDT');
            const accText =
                `👤 <b>MY ACCOUNT SUMMARY</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
                `👤 Name: <b>${escapeHtml(msg.from.first_name || 'User')}</b>\n` +
                `🆔 User ID: <code>${fromId}</code>\n` +
                `💰 Balance: <b>${formatNumber(u?.balance || 0)} ${currency}</b>\n` +
                `📢 Channels Sold: <b>${u?.total_channels_sold || 0} Channels</b>\n` +
                `👥 Total Referrals: <b>${u?.total_referrals || 0} Users</b>`;
            sendMessage(chatId, accText, getUserMenu(fromId));
            return;
        }

        if (text === '💸 Withdraw') {
            const u = await getUser(fromId);
            const bal = Number(u?.balance || 0);
            const minWithdraw = Number(getSetting('min_withdraw', 50));
            const currency = getSetting('currency_name', 'BDT');

            if (bal < minWithdraw) {
                sendMessage(chatId,
                    `⚠️ <b>Insufficient Balance!</b>\n\n` +
                    `Minimum Withdraw: <b>${minWithdraw} ${currency}</b>\n` +
                    `Your Balance: <b>${formatNumber(bal)} ${currency}</b>\n\n` +
                    `<i>চ্যানেল সেল অথবা রেফার করে ব্যালেন্স বাড়ান।</i>`
                );
                return;
            }

            cache.userStates.set(fromId, { action: 'awaiting_withdraw_address', method: 'bKash/Nagad' });
            sendMessage(chatId,
                `💸 <b>WITHDRAW FUNDS</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
                `💰 Available Balance: <b>${formatNumber(bal)} ${currency}</b>\n\n` +
                `আপনার <b>Payment Method & Number</b> লিখে পাঠান:\n` +
                `উদাহরণ: <code>bKash Personal 017xxxxxxxx</code>`,
                getCancelKeyboard()
            );
            return;
        }

        if (text === '📮 Referral') {
            const u = await getUser(fromId);
            const refBonus = getSetting('referral_bonus', 2);
            const currency = getSetting('currency_name', 'BDT');
            const link = `https://t.me/${BOT_USERNAME}?start=${fromId}`;

            const refText =
                `📮 <b>REFERRAL PROGRAM</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
                `👥 Total Referrals: <b>${u?.total_referrals || 0}</b>\n` +
                `💰 Reward per Referral: <b>${formatNumber(refBonus)} ${currency}</b>\n\n` +
                `🔗 <b>Your Invite Link:</b>\n<code>${link}</code>`;
            sendMessage(chatId, refText, getUserMenu(fromId));
            return;
        }

        if (text === '📊 System Status') {
            const currency = getSetting('currency_name', 'BDT');
            const price = getSetting('channel_sell_price', 10);
            const minWd = getSetting('min_withdraw', 50);

            const statusText =
                `📊 <b>LIVE SYSTEM STATUS</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
                `🤖 Bot Name: <b>${escapeHtml(BOT_NAME)}</b>\n` +
                `💰 Channel Price: <b>${formatNumber(price)} ${currency}</b>\n` +
                `💸 Minimum Withdraw: <b>${formatNumber(minWd)} ${currency}</b>\n` +
                `👮 Verification Handler: <b>${escapeHtml(getSetting('channel_owner_target', DEFAULT_CHANNEL_OWNER))}</b>\n` +
                `🔧 Developer: <a href="${DEVELOPER_LINK}">${DEVELOPER_NAME}</a>\n` +
                `⚡ Status: <b>100% TURBO OPERATIONAL</b>`;
            sendMessage(chatId, statusText, getUserMenu(fromId));
            return;
        }

        // =========================================================================
        // এডমিন প্যানেল
        // =========================================================================
        if (text === '🛠 Admin Panel' && isAdm) {
            sendMessage(chatId, "🛠 <b>Admin Control Center Activated</b>", getAdminMenu());
            return;
        }

        if (text === '⚙️ Central Settings' && isAdm) {
            sendMessage(chatId, "⚙️ <b>Central Database Configuration</b>\nনিচে থেকে যেকোনো সেটিং এডিট করুন:", centralSettingsKeyboard());
            return;
        }

        if (text === '📢 Broadcast Message' && isAdm) {
            cache.adminStates.set(fromId, { action: 'broadcast_msg' });
            sendMessage(chatId, "📢 <b>ব্রডকাস্ট মেসেজটি পাঠান (সকল ইউজারের কাছে চলে যাবে):</b>", getCancelKeyboard());
            return;
        }

        if (text === '🔙 Back to User Panel') {
            sendMessage(chatId, "👤 <b>User Menu</b>", getUserMenu(fromId));
            return;
        }
    }
}

/*
|--------------------------------------------------------------------------
| ১১. ক্যাশ প্রি-ওয়ার্মিং (স্টার্টআপেই ডাটা লোড)
|--------------------------------------------------------------------------
*/
async function preloadEngine() {
    console.log(`⚡ Pre-warming Cache for ${BOT_NAME}...`);
    try {
        const [settings, admins, regChannels] = await Promise.all([
            firebaseRequest('settings'),
            firebaseRequest('admins'),
            firebaseRequest('registered_channels')
        ]);

        if (settings && typeof settings === 'object') {
            for (const [k, v] of Object.entries(settings)) cache.settings.set(k, v);
        }
        if (admins && typeof admins === 'object') cache.admins = admins;
        if (regChannels && typeof regChannels === 'object') {
            for (const [chId, data] of Object.entries(regChannels)) {
                if (data?.status) cache.registeredChannels.set(chId, data.status);
            }
        }
        console.log(`✅ ${BOT_NAME} connected to Firebase successfully!`);
    } catch (e) {
        console.error('Preload error:', e.message);
    }
}

/*
|--------------------------------------------------------------------------
| ১২. এক্সপ্রেস সার্ভার ও রেন্ডার কিপ-এলাইভ পিং
|--------------------------------------------------------------------------
*/
const app = express();
app.use(express.json());

app.post('/api/index', (req, res) => {
    res.status(200).send('OK');
    handleUpdate(req.body || {}).catch(err => console.error('Handler Error:', err));
});

app.get('/api/index', (req, res) => res.send('Webhook Active ⚡'));
app.get('/ping', (req, res) => res.send('Pong 🏓'));
app.get('/', (req, res) => res.send(`${BOT_NAME} Engine Running 🚀`));

// রেন্ডার স্লিপিং প্রিভেনশন পিং (প্রতি ৮ মিনিট পর পর)
setInterval(() => {
    fetch(`${APP_URL}/ping`).catch(() => {});
}, 8 * 60 * 1000);

const PORT = process.env.PORT || 8000;
app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await preloadEngine();
    try {
        const webhookUrl = `${APP_URL}/api/index`;
        const setWh = await telegramApi('setWebhook', { url: webhookUrl, drop_pending_updates: true });
        console.log('Webhook Setup Result:', setWh);
    } catch (err) {
        console.error('Webhook Setup Error:', err);
    }
});
