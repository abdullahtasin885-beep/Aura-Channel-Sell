/*
|--------------------------------------------------------------------------
| 𝐀𝐔𝐑𝐀 𝐓𝐀𝐒𝐊 & 𝐄𝐀𝐑𝐍 (TURBO SPEED ENGINE ⚡)
| - Model: Task Marketplace + Force Join Gate + Multi-Step Deposit
| - Bot Token: 8362797762:AAH23qRjM7Lte-Mfcmxq9mNCNEZetXpvFZg
| - Super Admin: 8045367594
| - Payment Number: 01352946834 (Personal - Send Money)
| - Render: https://aura-channel-sell.onrender.com
| - Firebase: https://aura-channel-sell-default-rtdb.firebaseio.com/
|--------------------------------------------------------------------------
*/

const express = require('express');

// ==========================================
// ১. ক্রেডেনশিয়াল ও মূল কনফিগারেশন
// ==========================================
const BOT_TOKEN = '8362797762:AAH23qRjM7Lte-Mfcmxq9mNCNEZetXpvFZg';
const BOT_USERNAME = 'AuraChannelSellBot';
const BOT_NAME = '𝐀𝐔𝐑𝐀 𝐓𝐀𝐒𝐊 & 𝐄𝐀𝐑𝐍';
const APP_URL = 'https://aura-channel-sell.onrender.com';
const SUPER_ADMIN_ID = '8045367594';

// পেমেন্ট তথ্য
const PAYMENT_NUMBER = '01352946834'; // বিকাশ ও নগদ পার্সোনাল

// ডিফল্ট লগ চ্যানেল ও লিংক
const DEFAULT_DEPOSIT_LOG_ID = '-1003945593094';
const DEFAULT_TASK_PROOF_LOG_ID = '-1003945593094';
const DEFAULT_SUPPORT_URL = 'https://t.me/Sakib_Developer1';
const DEVELOPER_NAME = 'SΛKIB 〆 DΞVΞLOPΞR';
const DEVELOPER_LINK = 'https://t.me/Sakib_Developer1';

/*
|--------------------------------------------------------------------------
| ২. ফায়ারবেস কনফিগারেশন
|--------------------------------------------------------------------------
*/
const ACTIVE_FIREBASE_URL = 'https://aura-channel-sell-default-rtdb.firebaseio.com';
const FIREBASE_API_KEY = 'AIzaSyB_obVWto2nUbwPptTocQn4INllEJkxuhY';
const FIREBASE_AUTH_EMAIL = 'tasin301210@gmail.com';
const FIREBASE_AUTH_PASSWORD = 'mayabiri#';

/*
|--------------------------------------------------------------------------
| ৩. ইন-মেমোরি RAM ক্যাশ
|--------------------------------------------------------------------------
*/
const cache = {
    users: new Map(),
    settings: new Map(),
    packages: new Map(),
    usedTrxIds: new Set(),
    tasks: new Map(),
    userChannels: new Map(),
    forceChannels: {},
    admins: {},
    adminStates: new Map(),
    userStates: new Map()
};

const channelAlertCooldown = new Map();

function invalidateUserCache(userId) {
    cache.users.delete(String(userId));
    cache.userChannels.delete(String(userId));
}

/*
|--------------------------------------------------------------------------
| ৪. ফরম্যাটিং ও কঠোর ভ্যালিডেশন
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

function isValidBDPhone(phone) {
    const clean = phone.replace(/[^0-9]/g, '');
    return /^01[3-9]\d{8}$/.test(clean);
}

function isValidURL(link) {
    if (!link) return false;
    const str = link.trim();
    if (str.startsWith('https://t.me/') || str.startsWith('http://t.me/') || str.startsWith('t.me/')) return true;
    try {
        const u = new URL(str.startsWith('http') ? str : `https://${str}`);
        return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
        return false;
    }
}

function isValidTrxId(trx) {
    if (!trx) return false;
    const clean = trx.trim();
    return /^[A-Za-z0-9]{6,25}$/.test(clean);
}

function isPositiveInt(value) {
    if (typeof value !== 'string' && typeof value !== 'number') return false;
    const n = Number(String(value).trim());
    return Number.isInteger(n) && n > 0;
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
| ৫. ফায়ারবেস সিকিউর ক্লায়েন্ট
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

async function sendPhoto(chatId, photoFileId, caption = '', replyMarkup = null) {
    const params = {
        chat_id: chatId,
        photo: photoFileId,
        caption: caption,
        parse_mode: 'HTML'
    };
    if (replyMarkup) params.reply_markup = replyMarkup;
    return await telegramApi('sendPhoto', params);
}

async function editMessageCaption(chatId, messageId, caption, replyMarkup = null) {
    const params = {
        chat_id: chatId,
        message_id: messageId,
        caption: caption,
        parse_mode: 'HTML'
    };
    if (replyMarkup) params.reply_markup = replyMarkup;
    return await telegramApi('editMessageCaption', params);
}

async function deleteMessage(chatId, messageId) {
    return await telegramApi('deleteMessage', { chat_id: chatId, message_id: messageId });
}

async function answerCallback(callbackId, text = '', showAlert = false) {
    return await telegramApi('answerCallbackQuery', {
        callback_query_id: callbackId,
        text: text,
        show_alert: showAlert
    });
}

async function sendLongMessage(chatId, text, extra = null) {
    const max = 3800;
    if (text.length <= max) return await sendMessage(chatId, text, extra);
    let offset = 0;
    while (offset < text.length) {
        let chunk = text.slice(offset, offset + max);
        offset += chunk.length;
        await sendMessage(chatId, chunk, offset >= text.length ? extra : null);
    }
}

/*
|--------------------------------------------------------------------------
| ৭. ডাটাবেজ অপারেশনস
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

function setUser(userId, data) {
    const uid = String(userId);
    cache.users.set(uid, data);
    firebaseRequest(`users/${uid}`, 'PUT', data).catch(console.error);
    return true;
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
| ৮. ফোর্স চ্যানেল ও রিয়েল-টাইম লিভার চেকার
|--------------------------------------------------------------------------
*/
async function alertSuperAdminBotRemoved(channel, index) {
    const now = Date.now();
    const lastAlert = channelAlertCooldown.get(channel.channel_id) || 0;
    if (now - lastAlert < 3 * 60 * 1000) return;
    channelAlertCooldown.set(channel.channel_id, now);

    let channelUsername = channel.channel_username || '';
    if (!channelUsername && channel.channel_link) {
        channelUsername = normalizeChannelInput(channel.channel_link);
    }
    if (!channelUsername) channelUsername = `ID: ${channel.channel_id}`;

    const alertText =
        `🚨 <b>সুপার এডমিন সতর্কতা: চ্যানেল থেকে বট রিমুভ হয়েছে!</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `⚠️ <b>সমস্যা:</b> একজন ইউজার ভেরিফাই করতে গিয়ে আটকে গেছে, কারণ বটটিকে চ্যানেল থেকে অ্যাডমিন থেকে রিমুভ করা হয়েছে!\n\n` +
        `🔢 <b>চ্যানেল ক্রম:</b> <b>চ্যানেল #${index}</b>\n` +
        `📢 <b>নাম:</b> <b>${escapeHtml(channel.channel_name || 'N/A')}</b>\n` +
        `🔗 <b>ইউজারনেম:</b> <code>${escapeHtml(channelUsername)}</code>\n` +
        `🆔 <b>আইডি:</b> <code>${escapeHtml(channel.channel_id)}</code>\n\n` +
        `<i>💡 সমাধান: দ্রুত চ্যানেলটিতে বটকে পুনরায় Admin পারমিশন দিন।</i>`;

    sendMessage(SUPER_ADMIN_ID, alertText).catch(() => {});
}

async function verifyChannelAndBotAdmin(targetInput) {
    const normalized = normalizeChannelInput(targetInput);
    if (!normalized) return { ok: false, error: "❌ সঠিক Channel ID বা Username প্রদান করুন।" };

    const chatRes = await telegramApi('getChat', { chat_id: normalized });
    if (!chatRes?.ok || !chatRes.result) {
        return { ok: false, error: `❌ <b>চ্যানেলটি খুঁজে পাওয়া যায়নি!</b> নিশ্চিত করুন যে ইউজারনেম সঠিক ও পাবলিক।` };
    }

    const chat = chatRes.result;
    const botId = BOT_TOKEN.split(':')[0];
    const memberRes = await telegramApi('getChatMember', { chat_id: chat.id, user_id: botId });

    if (!memberRes?.ok || !memberRes.result) {
        return { ok: false, error: `❌ <b>বট এই চ্যানেলে যুক্ত নেই!</b> আগে বটকে <b>${escapeHtml(chat.title || 'Channel')}</b>-এ অ্যাডমিন বানান।` };
    }

    const isBotAdmin = ['administrator', 'creator'].includes(memberRes.result.status);
    if (!isBotAdmin) {
        return { ok: false, error: `⚠️ <b>বট চ্যানেলে অ্যাডমিন নয়!</b> অনুগ্রহ করে অ্যাডমিন পারমিশন দিন।` };
    }

    let channelLink = chat.username ? `https://t.me/${chat.username}` : (chat.invite_link || '');

    return {
        ok: true,
        channel_id: String(chat.id),
        channel_title: chat.title || 'Channel',
        channel_username: chat.username ? `@${chat.username}` : '',
        channel_link: channelLink
    };
}

async function isJoinedChannel(channelId, userId) {
    if (!channelId) return false;
    const res = await telegramApi('getChatMember', { chat_id: channelId, user_id: userId });
    if (!res?.ok) return false;
    const status = res.result?.status;
    if (['creator', 'administrator', 'member'].includes(status)) return true;
    if (status === 'restricted') return Boolean(res.result?.is_member);
    return false;
}

async function isBotAdminInChat(chatId) {
    const botId = BOT_TOKEN.split(':')[0];
    const res = await telegramApi('getChatMember', { chat_id: chatId, user_id: botId });
    return res && res.ok && ['administrator', 'creator'].includes(res.result?.status);
}

async function isUserJoinedAllChannels(userId, bypassCache = false) {
    const uidStr = String(userId);
    const now = Date.now();

    if (!bypassCache) {
        const cached = cache.userChannels.get(uidStr);
        if (cached && now < cached.expiresAt) return cached.isMember;
    }

    const channelEntries = Object.entries(cache.forceChannels).filter(([_, ch]) => ch && ch.channel_id);
    if (!channelEntries.length) {
        cache.userChannels.set(uidStr, { isMember: true, expiresAt: now + 30000 });
        return true;
    }

    const checks = await Promise.all(channelEntries.map(async ([key, ch], idx) => {
        const botIsAdmin = await isBotAdminInChat(ch.channel_id);
        if (!botIsAdmin) {
            alertSuperAdminBotRemoved(ch, idx + 1);
            return false;
        }
        return await isJoinedChannel(ch.channel_id, uidStr);
    }));

    const allJoined = checks.every(Boolean);
    cache.userChannels.set(uidStr, { isMember: allJoined, expiresAt: now + (allJoined ? 15000 : 5000) });
    return allJoined;
}

function showForceJoin(chatId, firstName = 'User') {
    const channelList = Object.values(cache.forceChannels).filter(ch => ch && ch.channel_link);
    const inlineKeyboard = [];
    const total = channelList.length;

    for (let i = 0; i < total; i += 2) {
        if (i + 1 < total) {
            inlineKeyboard.push([
                { text: channelList[i].channel_name || 'Join', url: channelList[i].channel_link, style: 'primary' },
                { text: channelList[i + 1].channel_name || 'Join', url: channelList[i + 1].channel_link, style: 'danger' }
            ]);
        } else {
            inlineKeyboard.push([
                { text: channelList[i].channel_name || 'Join', url: channelList[i].channel_link, style: 'primary' }
            ]);
        }
    }

    inlineKeyboard.push([
        { text: 'Claim', callback_data: 'verify_join', style: 'success' }
    ]);

    const text =
        `👋 <b>Hello, ${escapeHtml(firstName)}!</b>\n\n` +
        `📢 <b>Join All Channels To Continue.</b>\n` +
        `<i>(You must be a member of all channels to access ${escapeHtml(BOT_NAME)})</i>`;

    return sendMessage(chatId, text, { inline_keyboard: inlineKeyboard });
}

async function verifyAndRewardUser(fromId, callbackUser = null) {
    invalidateUserCache(fromId);
    const joinedAll = await isUserJoinedAllChannels(fromId, true);
    if (!joinedAll) return { success: false };

    let user = await getUser(fromId);
    const now = Math.floor(Date.now() / 1000);

    if (!user) {
        user = {
            user_id: fromId,
            first_name: callbackUser?.first_name || 'User',
            username: callbackUser?.username || '',
            balance: 0,
            is_verified: true,
            referral_rewarded: false,
            created_at: now
        };
        setUser(fromId, user);
    }

    const userUpdates = {
        is_verified: true,
        verified_at: now
    };

    // 🎯 কঠোর রেফারেল রিওয়ার্ড প্রদান (চ্যানেল ভেরিফাই হলেই কেবল পাবে)
    if (user.referred_by && !user.referral_rewarded && String(user.referred_by) !== String(fromId)) {
        const ref = await getUser(user.referred_by);
        if (ref) {
            const refBonus = Number(getSetting('referral_bonus', 2));
            const newTotalRefs = Number(ref.total_referrals || 0) + 1;
            const newRefBalance = Number(ref.balance || 0) + refBonus;

            updateUser(user.referred_by, {
                balance: newRefBalance,
                total_referrals: newTotalRefs
            });

            userUpdates.referral_rewarded = true;

            sendMessage(
                user.referred_by,
                `🎉 <b>New Referral Verified!</b>\n━━━━━━━━━━━━━━━━━━\n\n` +
                `👤 User: <b>${escapeHtml(user.first_name || 'User')}</b>\n` +
                `⭐ Bonus: <b>+${formatNumber(refBonus)} Coins</b>\n` +
                `👥 Total Referrals: <b>${newTotalRefs}</b>`
            ).catch(() => {});
        }
    }

    updateUser(fromId, userUpdates);
    return { success: true };
}

/*
|--------------------------------------------------------------------------
| ৯. কীবোর্ড ও মেনুসমূহ (ইংলিশ + কালার স্টাইল)
|--------------------------------------------------------------------------
*/
function getUserMenu(userId) {
    const keyboard = [
        // সবার প্রথমে Earn Coins
        [{ text: '💰 Earn Coins', style: 'success' }],
        [{ text: '📢 Bot Refer Buy', style: 'primary' }, { text: '📦 Poll Vote Buy', style: 'primary' }],
        [{ text: '📜 My Tasks', style: 'primary' }, { text: '💳 Deposit', style: 'success' }],
        [{ text: '👤 Profile', style: 'primary' }, { text: '📮 Referral', style: 'success' }],
        [{ text: '💬 Support', style: 'danger' }]
    ];
    if (isAdmin(userId)) {
        keyboard.push([{ text: '🛠 Admin Panel', style: 'danger' }]);
    }
    return { keyboard, resize_keyboard: true };
}

function getAdminMenu() {
    return {
        keyboard: [
            [{ text: '➕ Add Package', style: 'success' }, { text: '➖ Remove Package', style: 'danger' }],
            [{ text: '📋 Package List', style: 'primary' }, { text: '📢 Force Channels', style: 'primary' }],
            [{ text: '⚙️ Central Settings', style: 'primary' }, { text: '👥 Balance Control', style: 'danger' }],
            [{ text: '🔙 Back to User Panel', style: 'danger' }]
        ],
        resize_keyboard: true
    };
}

function forceJoinKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: '➕ চ্যানেল যোগ করুন', callback_data: 'force_add', style: 'success' },
                { text: '➖ চ্যানেল রিমুভ করুন', callback_data: 'force_remove', style: 'danger' }
            ],
            [
                { text: '📋 চ্যানেল তালিকা', callback_data: 'force_list', style: 'primary' }
            ]
        ]
    };
}

function getCancelKeyboard() {
    return { keyboard: [[{ text: '/cancel', style: 'danger' }]], resize_keyboard: true, one_time_keyboard: true };
}

function getDepositPackagesKeyboard() {
    const buttons = [];
    const pkgs = Array.from(cache.packages.entries());

    for (let i = 0; i < pkgs.length; i += 2) {
        const row = [];
        const [id1, p1] = pkgs[i];
        row.push({ text: `💵 ${p1.taka}৳ = ${p1.coins} Coin`, callback_data: `dep_pkg_${id1}`, style: 'primary' });

        if (i + 1 < pkgs.length) {
            const [id2, p2] = pkgs[i + 1];
            row.push({ text: `💵 ${p2.taka}৳ = ${p2.coins} Coin`, callback_data: `dep_pkg_${id2}`, style: 'success' });
        }
        buttons.push(row);
    }
    return { inline_keyboard: buttons };
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

        // কঠোর ফোর্স চ্যানেল চেকিং (ভেরিফাই বাটন ব্যতীত)
        if (!isAdmin(fromId) && data !== 'verify_join') {
            const joinedAll = await isUserJoinedAllChannels(fromId);
            if (!joinedAll) {
                answerCallback(callback.id, "⚠️ Please join all channels first!", true);
                showForceJoin(fromId, callback.from.first_name);
                return;
            }
        }

        // চ্যানেল জয়েন ভেরিফিকেশন ও রেফারেল রিওয়ার্ড
        if (data === 'verify_join') {
            answerCallback(callback.id);
            const check = await verifyAndRewardUser(fromId, callback.from);
            if (!check.success) {
                if (chatId && messageId) deleteMessage(chatId, messageId).catch(() => {});
                sendMessage(fromId, "⚠️ <b>Please join all channels first!</b>");
                showForceJoin(fromId, callback.from.first_name);
                return;
            }

            if (chatId && messageId) deleteMessage(chatId, messageId).catch(() => {});
            sendMessage(fromId, `✅ <b>Verification Successful!</b>\n\nWelcome to ${escapeHtml(BOT_NAME)}! 🎉`, getUserMenu(fromId));
            return;
        }

        // --- ডিপোজিট প্যাকেজ সিলেক্ট ---
        if (data.startsWith('dep_pkg_')) {
            answerCallback(callback.id);
            const pkgId = data.replace('dep_pkg_', '');
            const pkg = cache.packages.get(pkgId);

            if (!pkg) {
                sendMessage(fromId, "❌ প্যাকেজটি পাওয়া যায়নি!");
                return;
            }

            const depositInstructions =
                `💳 <b>DEPOSIT INSTRUCTIONS</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
                `📦 <b>প্যাকেজ:</b> ${formatNumber(pkg.taka)}৳ = ${formatNumber(pkg.coins)} Coins\n` +
                `💵 <b>পাঠাতে হবে:</b> <b>${formatNumber(pkg.taka)} টাকা</b>\n\n` +
                `📱 <b>বিকাশ ও নগদ (Personal):</b>\n` +
                `👉 <code>${PAYMENT_NUMBER}</code> <i>(ক্লিক করলে কপি হবে)</i>\n\n` +
                `⚠️ <b>জরুরি তথ্য:</b>\n` +
                `• শুধুমাত্র <b>Send Money</b> করবেন।\n` +
                `• ঠিক <b>${formatNumber(pkg.taka)} টাকা</b> পাঠাবেন।\n` +
                `• টাকা পাঠানো সম্পন্ন হলে নিচে <b>"পেমেন্ট প্রুফ জমা দিন"</b> বাটনে চাপুন।`;

            const keyboard = {
                inline_keyboard: [
                    [{ text: '📥 পেমেন্ট প্রুফ জমা দিন', callback_data: `start_dep_proof_${pkgId}`, style: 'success' }]
                ]
            };

            sendMessage(fromId, depositInstructions, keyboard);
            return;
        }

        // --- ডিপোজিট প্রুফ শুরু ---
        if (data.startsWith('start_dep_proof_')) {
            answerCallback(callback.id);
            const pkgId = data.replace('start_dep_proof_', '');
            const pkg = cache.packages.get(pkgId);

            if (!pkg) {
                sendMessage(fromId, "❌ প্যাকেজটি পাওয়া যায়নি!");
                return;
            }

            cache.userStates.set(fromId, {
                action: 'dep_step_photo',
                pkgId: pkgId,
                taka: pkg.taka,
                coins: pkg.coins
            });

            sendMessage(fromId,
                `📸 <b>ধাপ ১: পেমেন্টের স্ক্রিনশট পাঠান</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
                `প্যাকেজ: <b>${pkg.taka}৳ = ${pkg.coins} Coin</b>\n\n` +
                `সফলভাবে টাকা পাঠানোর স্ক্রিনশটটি <b>Photo</b> হিসেবে ইনবক্সে পাঠান:\n` +
                `<i>(বাতিল করতে /cancel লিখুন)</i>`,
                getCancelKeyboard()
            );
            return;
        }

        // --- আর্ন কয়েন ক্যাটাগরি ভিউ ---
        if (data === 'view_cat_refer' || data === 'view_cat_vote') {
            answerCallback(callback.id);
            const isRefer = data === 'view_cat_refer';
            const targetType = isRefer ? 'bot_refer' : 'poll_vote';

            const tasks = Array.from(cache.tasks.values())
                .filter(t => t.status === 'active' && t.type === targetType)
                .sort((a, b) => Number(b.reward_per_worker) - Number(a.reward_per_worker));

            if (!tasks.length) {
                sendMessage(fromId, `❌ বর্তমানে কোনো ${isRefer ? 'Bot Refer' : 'Poll Vote'} কাজ খালি নেই। নতুন কাজ আসলে নোটিফিকেশন পাবেন!`);
                return;
            }

            const buttons = [];
            for (const t of tasks.slice(0, 15)) {
                buttons.push([
                    {
                        text: `🔥 ${formatNumber(t.reward_per_worker)} Coins | টার্গেট: ${t.completed_count}/${t.total_needed}`,
                        callback_data: `do_task_${t.task_id}`,
                        style: 'primary'
                    }
                ]);
            }

            sendMessage(fromId,
                `💰 <b>উপলব্ধ ${isRefer ? 'Bot Refer' : 'Poll Vote'} কাজসমূহ</b>\n` +
                `<i>(যেগুলোতে বেশি কয়েন দেওয়া হচ্ছে সেগুলো সবার উপরে সাজানো রয়েছে)</i>:\n\nকাজ করতে যেকোনো একটি বেছে নিন:`,
                { inline_keyboard: buttons }
            );
            return;
        }

        // --- টাস্ক কাজ শুরু ---
        if (data.startsWith('do_task_')) {
            answerCallback(callback.id);
            const taskId = data.replace('do_task_', '');
            const task = cache.tasks.get(taskId);

            if (!task || task.status !== 'active') {
                sendMessage(fromId, "⚠️ এই কাজটি ইতিমধ্যে সম্পন্ন হয়ে গেছে!");
                return;
            }

            const userDone = await firebaseRequest(`task_completions/${taskId}/${fromId}`);
            if (userDone) {
                sendMessage(fromId, "❌ আপনি ইতিমধ্যে এই কাজটি সম্পন্ন করেছেন!");
                return;
            }

            cache.userStates.set(fromId, {
                action: 'task_step_photo',
                taskId: taskId,
                reward: task.reward_per_worker
            });

            const taskDetailText =
                `📋 <b>কাজের বিবরণ</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
                `📌 <b>কাজের ধরন:</b> ${task.type === 'bot_refer' ? '📢 Bot Refer' : '📦 Poll Vote'}\n` +
                `💰 <b>পুরস্কার:</b> +${formatNumber(task.reward_per_worker)} Coins\n` +
                `🔗 <b>লিংক:</b> ${escapeHtml(task.link)}\n` +
                `📝 <b>নিয়মাবলী:</b> ${escapeHtml(task.instructions)}\n\n` +
                `👉 লিংকে গিয়ে সঠিকভাবে কাজ শেষ করে প্রুফ হিসেবে <b>স্ক্রিনশট (Photo)</b> পাঠান:`;

            sendMessage(fromId, taskDetailText, getCancelKeyboard());
            return;
        }

        // --- ডিপোজিট অ্যাপ্রুভ / রিজেক্ট ---
        const depMatch = data.match(/^dep_(app|rej)_([A-Za-z0-9_-]+)$/);
        if (depMatch) {
            if (!isAdmin(fromId)) {
                return await answerCallback(callback.id, "⛔ Access Denied! You are not authorized.", true);
            }

            const action = depMatch[1];
            const depId = depMatch[2];
            const dep = await firebaseRequest(`deposits/${depId}`);

            if (!dep || dep.status !== 'pending') {
                return await answerCallback(callback.id, "⚠️ এই রিকোয়েস্টটি ইতিমধ্যে প্রসেস করা হয়েছে!", true);
            }

            answerCallback(callback.id);
            const now = Math.floor(Date.now() / 1000);
            const adminName = callback.from.username ? `@${callback.from.username}` : callback.from.first_name;

            if (action === 'app') {
                const targetUser = await getUser(dep.user_id);
                if (targetUser) {
                    const newBal = Number(targetUser.balance || 0) + Number(dep.coins);
                    updateUser(dep.user_id, { balance: newBal });

                    sendMessage(dep.user_id,
                        `🎉 <b>পেমেন্ট প্রুফ এপ্রুভ হয়েছে!</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
                        `✅ আপনার ডিপোজিট সফলভাবে ভেরিফাই করা হয়েছে।\n` +
                        `💰 যুক্ত হয়েছে: <b>+${formatNumber(dep.coins)} Coins</b>\n` +
                        `💳 বর্তমান ব্যালেন্স: <b>${formatNumber(newBal)} Coins</b>`
                    ).catch(() => {});
                }

                firebaseRequest(`deposits/${depId}`, 'PATCH', { status: 'approved', processed_by: fromId, processed_at: now }).catch(() => {});

                const approvedCaption =
                    `✅ <b>DEPOSIT APPROVED</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
                    `👤 <b>ইউজার:</b> ${escapeHtml(dep.user_name)} (<code>${dep.user_id}</code>)\n` +
                    `📦 <b>প্যাকেজ:</b> ${dep.taka}৳ = ${dep.coins} Coins\n` +
                    `📱 <b>প্রেরক নাম্বার:</b> <code>${escapeHtml(dep.sender_number)}</code>\n` +
                    `🧾 <b>Trx ID:</b> <code>${escapeHtml(dep.trx_id)}</code>\n` +
                    `👮 <b>Approved By:</b> ${escapeHtml(adminName)}\n` +
                    `🕒 <b>সময়:</b> ${formatTimestamp(now)}`;

                editMessageCaption(chatId, messageId, approvedCaption);
                return;
            }

            if (action === 'rej') {
                firebaseRequest(`deposits/${depId}`, 'PATCH', { status: 'rejected', processed_by: fromId, processed_at: now }).catch(() => {});

                sendMessage(dep.user_id,
                    `❌ <b>পেমেন্ট প্রুফ বাতিল করা হয়েছে!</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
                    `প্রেরিত তথ্য বা Trx ID সঠিক পাওয়া যায়নি। কোনো সমস্যা হলে সাপোর্টে যোগাযোগ করুন।`
                ).catch(() => {});

                const rejectedCaption =
                    `❌ <b>DEPOSIT REJECTED</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
                    `👤 <b>ইউজার:</b> ${escapeHtml(dep.user_name)} (<code>${dep.user_id}</code>)\n` +
                    `📦 <b>প্যাকেজ:</b> ${dep.taka}৳ = ${dep.coins} Coins\n` +
                    `📱 <b>প্রেরক নাম্বার:</b> <code>${escapeHtml(dep.sender_number)}</code>\n` +
                    `🧾 <b>Trx ID:</b> <code>${escapeHtml(dep.trx_id)}</code>\n` +
                    `👮 <b>Rejected By:</b> ${escapeHtml(adminName)}`;

                editMessageCaption(chatId, messageId, rejectedCaption);
                return;
            }
        }

        // --- টাস্ক প্রুফ অ্যাপ্রুভ / রিজেক্ট ---
        const taskProofMatch = data.match(/^tp_(app|rej)_([A-Za-z0-9_-]+)$/);
        if (taskProofMatch) {
            if (!isAdmin(fromId)) {
                return await answerCallback(callback.id, "⛔ Access Denied! You are not authorized.", true);
            }

            const action = taskProofMatch[1];
            const subId = taskProofMatch[2];
            const sub = await firebaseRequest(`task_submissions/${subId}`);

            if (!sub || sub.status !== 'pending') {
                return await answerCallback(callback.id, "⚠️ এই প্রুফটি ইতিমধ্যে প্রসেস করা হয়েছে!", true);
            }

            answerCallback(callback.id);
            const now = Math.floor(Date.now() / 1000);

            if (action === 'app') {
                const task = await firebaseRequest(`tasks/${sub.task_id}`);
                const worker = await getUser(sub.worker_id);

                if (worker) {
                    const newBal = Number(worker.balance || 0) + Number(sub.reward);
                    updateUser(sub.worker_id, { balance: newBal });
                    sendMessage(sub.worker_id, `🎉 <b>টাস্ক প্রুফ এপ্রুভ হয়েছে!</b>\n+${formatNumber(sub.reward)} Coins একাউন্টে যোগ হয়েছে।`).catch(() => {});
                }

                if (task) {
                    const newComp = Number(task.completed_count || 0) + 1;
                    const isFinished = newComp >= Number(task.total_needed);
                    const taskUpdate = {
                        completed_count: newComp,
                        status: isFinished ? 'completed' : 'active'
                    };
                    firebaseRequest(`tasks/${sub.task_id}`, 'PATCH', taskUpdate).catch(() => {});
                    cache.tasks.set(sub.task_id, { ...task, ...taskUpdate });
                }

                firebaseRequest(`task_completions/${sub.task_id}/${sub.worker_id}`, 'PUT', true).catch(() => {});
                firebaseRequest(`task_submissions/${subId}`, 'PATCH', { status: 'approved', processed_at: now }).catch(() => {});

                editMessageCaption(chatId, messageId, `✅ <b>TASK PROOF APPROVED (+${sub.reward} Coins)</b>`);
                return;
            }

            if (action === 'rej') {
                firebaseRequest(`task_submissions/${subId}`, 'PATCH', { status: 'rejected', processed_at: now }).catch(() => {});
                sendMessage(sub.worker_id, `❌ <b>টাস্ক প্রুফ বাতিল করা হয়েছে!</b>\nকাজটি যথাযথভাবে সম্পন্ন হয়নি।`).catch(() => {});
                editMessageCaption(chatId, messageId, `❌ <b>TASK PROOF REJECTED</b>`);
                return;
            }
        }

        // =========================================================================
        // অ্যাডমিন সেটিংস ও ফোর্স চ্যানেল কলব্যাক
        // =========================================================================
        if (isAdmin(fromId)) {
            if (data === 'admin_set_dep_chan') {
                answerCallback(callback.id);
                cache.adminStates.set(fromId, { action: 'cfg_dep_chan' });
                sendMessage(fromId, "💳 <b>ডিপোজিট চ্যানেল আইডি পাঠান (যেমন: -100...):</b>", getCancelKeyboard());
                return;
            }

            if (data === 'admin_set_proof_chan') {
                answerCallback(callback.id);
                cache.adminStates.set(fromId, { action: 'cfg_proof_chan' });
                sendMessage(fromId, "📸 <b>টাস্ক প্রুফ চ্যানেল আইডি পাঠান (যেমন: -100...):</b>", getCancelKeyboard());
                return;
            }

            if (data === 'admin_set_min_task_reward') {
                answerCallback(callback.id);
                cache.adminStates.set(fromId, { action: 'cfg_min_task_reward' });
                const cur = getSetting('min_task_reward', 1);
                sendMessage(fromId, `🪙 <b>টাস্কের মিনিমাম কয়েন রেট সেট করুন:</b>\nবর্তমান: <b>${cur} Coins</b>\n\nনতুন সংখ্যা পাঠান:`, getCancelKeyboard());
                return;
            }

            // প্যাকেজ রিমুভ কলব্যাক
            const remPkgMatch = data.match(/^rem_pkg_([A-Za-z0-9_-]+)$/);
            if (remPkgMatch) {
                answerCallback(callback.id);
                const pkgId = remPkgMatch[1];
                cache.packages.delete(pkgId);
                firebaseRequest(`packages/${pkgId}`, 'DELETE').catch(() => {});
                sendMessage(fromId, "✅ <b>প্যাকেজটি সফলভাবে মুছে ফেলা হয়েছে!</b>", getAdminMenu());
                return;
            }

            // ফোর্স চ্যানেল কলব্যাকসমূহ
            if (data === 'force_add') {
                answerCallback(callback.id);
                cache.adminStates.set(fromId, { action: 'add_force_channel_input' });
                sendMessage(fromId, "➕ <b>ফোর্স চ্যানেল যোগ করুন</b>\n\nচ্যানেলের <b>ID</b> (যেমন: <code>-100...</code>) অথবা <b>Username</b> (যেমন: <code>@mychannel</code> বা লিংক) পাঠান:", getCancelKeyboard());
                return;
            }

            if (data === 'force_remove') {
                answerCallback(callback.id);
                const channels = cache.forceChannels;
                if (!Object.keys(channels).length) {
                    sendMessage(fromId, "⚠️ <b>কোনো Channel তালিকায় নেই!</b>");
                    return;
                }
                const kb = [];
                for (const [k, c] of Object.entries(channels)) {
                    if (c) kb.push([{ text: `❌ ${c.channel_name || 'Channel'}`, callback_data: `removeforce_${k}`, style: 'danger' }]);
                }
                sendMessage(fromId, "📢 <b>ফোর্স চ্যানেল রিমুভ</b>\n\nChannel নির্বাচন করুন:", { inline_keyboard: kb });
                return;
            }

            const removeForceMatch = data.match(/^removeforce_([A-Za-z0-9_-]+)$/);
            if (removeForceMatch) {
                answerCallback(callback.id);
                delete cache.forceChannels[removeForceMatch[1]];
                cache.userChannels.clear();
                firebaseRequest(`force_channels/${removeForceMatch[1]}`, 'DELETE').catch(() => {});
                sendMessage(fromId, "✅ <b>চ্যানেল সফলভাবে রিমুভ হয়েছে!</b>", getAdminMenu());
                return;
            }

            if (data === 'force_list') {
                answerCallback(callback.id);
                const channels = Object.entries(cache.forceChannels).filter(([_, c]) => c && c.channel_id);
                let list = "📢 <b>ফোর্স চ্যানেল তালিকা ও স্ট্যাটাস</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
                if (!channels.length) {
                    list += "\nকোনো Force Join Channel যুক্ত নেই।";
                } else {
                    const checkedList = await Promise.all(channels.map(async ([key, c], idx) => {
                        const isAdminThere = await isBotAdminInChat(c.channel_id);
                        const statusText = isAdminThere ? "✅ Bot Admin" : "⚠️ Bot Not Admin";
                        let uName = c.channel_username || '';
                        if (!uName && c.channel_link) {
                            uName = normalizeChannelInput(c.channel_link);
                        }
                        if (!uName) uName = `ID: ${c.channel_id}`;
                        return {
                            index: idx + 1,
                            name: c.channel_name || 'Channel',
                            id: c.channel_id,
                            username: uName,
                            statusText: statusText
                        };
                    }));

                    for (const item of checkedList) {
                        list += `\n<b>#${item.index}. ${escapeHtml(item.name)}</b> (${item.statusText})\n` +
                                `🆔 ID: <code>${escapeHtml(item.id)}</code>\n` +
                                `🔗 Username / Link: <code>${escapeHtml(item.username)}</code>\n` +
                                `👮 এডমিন স্ট্যাটাস: <b>${item.statusText}</b>\n`;
                    }
                }
                sendLongMessage(fromId, list);
                return;
            }
        }
    }

    // -------------------------------------------------------------
    // ২. টেক্সট ও ফটো মেসেজ হ্যান্ডলার
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
                total_referrals: 0,
                referred_by: refBy,
                referral_rewarded: false,
                is_verified: isAdm,
                created_at: Math.floor(Date.now() / 1000)
            };
            setUser(fromId, user);
        }

        if (text === '/cancel') {
            cache.userStates.delete(fromId);
            cache.adminStates.delete(fromId);
            sendMessage(chatId, "❌ বর্তমান প্রক্রিয়াটি বাতিল করা হয়েছে।", getUserMenu(fromId));
            return;
        }

        // =========================================================================
        // 🚨 কঠোর রিয়েল-টাইম ফোর্স চ্যানেল গেট (মেসেজ ফিল্টারিং)
        // =========================================================================
        if (!isAdm) {
            const joinedAll = await isUserJoinedAllChannels(fromId);
            if (!joinedAll) {
                if (user.is_verified) {
                    updateUser(fromId, { is_verified: false });
                }
                showForceJoin(chatId, msg.from.first_name);
                return;
            }
        }

        // =========================================================================
        // ডিপোজিট প্রুফ সাবমিশন (কঠোর ইনপুট ভ্যালিডেশন)
        // =========================================================================
        const uState = cache.userStates.get(fromId);

        if (uState?.action === 'dep_step_photo') {
            if (!msg.photo || !msg.photo.length) {
                sendMessage(chatId, "❌ <b>ভুল ইনপুট!</b> দয়া করে পেমেন্টের সঠিক <b>স্ক্রিনশট ছবি (Photo)</b> পাঠান:", getCancelKeyboard());
                return;
            }

            const largestPhoto = msg.photo[msg.photo.length - 1];
            cache.userStates.set(fromId, {
                ...uState,
                action: 'dep_step_trx',
                file_id: largestPhoto.file_id
            });

            sendMessage(chatId,
                `🧾 <b>ধাপ ২: Trx ID পাঠান</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
                `বিকাশ/নগদ পেমেন্টের <b>Trx ID (Transaction ID)</b> লিখে পাঠান:\n` +
                `<i>(উদাহরণ: BLK9827364)</i>`,
                getCancelKeyboard()
            );
            return;
        }

        if (uState?.action === 'dep_step_trx') {
            if (!text || !isValidTrxId(text)) {
                sendMessage(chatId, "❌ <b>ভুল Trx ID!</b> দয়া করে সঠিক Transaction ID লিখে পাঠান:", getCancelKeyboard());
                return;
            }

            const cleanTrx = text.trim().toUpperCase();

            if (cache.usedTrxIds.has(cleanTrx)) {
                sendMessage(chatId, "❌ <b>এই Trx ID পূর্বে একবার ব্যবহার করা হয়েছে!</b>\nঅনুগ্রহ করে সঠিক Trx ID দিন অথবা /cancel লিখুন:", getCancelKeyboard());
                return;
            }

            const trxCheck = await firebaseRequest(`used_trxids/${cleanTrx}`);
            if (trxCheck) {
                cache.usedTrxIds.add(cleanTrx);
                sendMessage(chatId, "❌ <b>এই Trx ID পূর্বে একবার ব্যবহার করা হয়েছে!</b>\nঅনুগ্রহ করে সঠিক Trx ID দিন অথবা /cancel লিখুন:", getCancelKeyboard());
                return;
            }

            cache.userStates.set(fromId, {
                ...uState,
                action: 'dep_step_phone',
                trx_id: cleanTrx
            });

            sendMessage(chatId,
                `📱 <b>ধাপ ৩: প্রেরক নাম্বার পাঠান</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
                `যে বিকাশ বা নগদ নাম্বার থেকে টাকা পাঠিয়েছেন, সেই <b>১১ ডিজিটের মোবাইল নাম্বারটি</b> পাঠান:\n` +
                `<i>(উদাহরণ: 017xxxxxxxx)</i>`,
                getCancelKeyboard()
            );
            return;
        }

        if (uState?.action === 'dep_step_phone') {
            if (!text || !isValidBDPhone(text)) {
                sendMessage(chatId, "❌ <b>ভুল মোবাইল নাম্বার!</b> দয়া করে সঠিক ১১ ডিজিটের বাংলাদেশি মোবাইল নাম্বার লিখুন (যেমন: <code>017xxxxxxxx</code>):", getCancelKeyboard());
                return;
            }

            const senderNumber = text.replace(/[^0-9]/g, '');
            const logChannel = getSetting('deposit_channel_id', DEFAULT_DEPOSIT_LOG_ID);
            const depId = `DEP_${Date.now()}`;

            const depData = {
                dep_id: depId,
                user_id: fromId,
                user_name: msg.from.first_name || 'User',
                user_username: msg.from.username ? `@${msg.from.username}` : '',
                pkg_id: uState.pkgId,
                taka: uState.taka,
                coins: uState.coins,
                file_id: uState.file_id,
                trx_id: uState.trx_id,
                sender_number: senderNumber,
                status: 'pending',
                created_at: Math.floor(Date.now() / 1000)
            };

            cache.usedTrxIds.add(uState.trx_id);
            firebaseRequest(`used_trxids/${uState.trx_id}`, 'PUT', { user_id: fromId, date: Date.now() }).catch(() => {});
            firebaseRequest(`deposits/${depId}`, 'PUT', depData).catch(() => {});

            cache.userStates.delete(fromId);

            const channelCaption =
                `🔔 <b>NEW DEPOSIT SUBMITTED!</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
                `👤 <b>ইউজার:</b> ${escapeHtml(depData.user_name)} (<code>${depData.user_id}</code>)\n` +
                `🔗 <b>ইউজারনেম:</b> ${escapeHtml(depData.user_username || 'N/A')}\n\n` +
                `📦 <b>প্যাকেজ:</b> ${depData.taka}৳ = ${depData.coins} Coins\n` +
                `💵 <b>টাকা:</b> <b>${depData.taka} BDT</b>\n` +
                `🪙 <b>পাবে:</b> <b>${depData.coins} Coins</b>\n\n` +
                `📱 <b>প্রেরক নাম্বার:</b> <code>${escapeHtml(senderNumber)}</code>\n` +
                `🧾 <b>Trx ID:</b> <code>${escapeHtml(depData.trx_id)}</code>\n` +
                `🕒 <b>সময়:</b> ${formatTimestamp(depData.created_at)}`;

            const adminKeyboard = {
                inline_keyboard: [
                    [
                        { text: '✅ Approve', callback_data: `dep_app_${depId}`, style: 'success' },
                        { text: '❌ Reject', callback_data: `dep_rej_${depId}`, style: 'danger' }
                    ]
                ]
            };

            await sendPhoto(logChannel, depData.file_id, channelCaption, adminKeyboard);

            sendMessage(chatId,
                `✅ <b>আপনার পেমেন্ট প্রুফ জমা হয়েছে!</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
                `📦 প্যাকেজ: <b>${depData.taka}৳ = ${depData.coins} Coins</b>\n` +
                `🧾 Trx ID: <code>${depData.trx_id}</code>\n` +
                `📱 প্রেরক নাম্বার: <code>${senderNumber}</code>\n\n` +
                `⏳ আপনার রিকোয়েস্টটি বর্তমানে <b>পেন্ডিং (Pending)</b> রয়েছে। এডমিন ভেরিফাই করে এপ্রুভ করলেই ব্যালেন্সে কয়েন যুক্ত হয়ে যাবে।`,
                getUserMenu(fromId)
            );
            return;
        }

        // =========================================================================
        // টাস্ক তৈরির ফ্লো (Bot Refer ও Poll Vote এর আলাদা নিয়মাবলী প্রম্পট)
        // =========================================================================
        if (uState?.action === 'create_task_link') {
            if (!text || !isValidURL(text)) {
                sendMessage(chatId, "❌ <b>ভুল লিংক!</b> দয়া করে সঠিক লিংক পাঠান (যেমন: <code>https://t.me/...</code>):", getCancelKeyboard());
                return;
            }

            cache.userStates.set(fromId, { ...uState, action: 'create_task_rules', link: text.trim() });

            // টাস্কের ধরন অনুযায়ী আলাদা নিয়ম প্রদর্শন
            if (uState.taskType === 'bot_refer') {
                sendMessage(chatId,
                    `📝 <b>কাজের নিয়মাবলী লিখে পাঠান:</b>\n` +
                    `<i>(যেমন: বটে স্টার্ট দিয়ে চ্যানেল জয়েন করুন)</i>`,
                    getCancelKeyboard()
                );
            } else {
                sendMessage(chatId,
                    `📝 <b>কাজের নিয়মাবলী লিখে পাঠান:</b>\n` +
                    `<i>(যেমন: SΛKIB 〆 DΞVΞLOPΞR কে ভোট দিন)</i>`,
                    getCancelKeyboard()
                );
            }
            return;
        }

        if (uState?.action === 'create_task_rules') {
            if (!text || text.length < 3) {
                sendMessage(chatId, "❌ দয়া করে কাজের নিয়ম স্পষ্টভাবে লিখে পাঠান:", getCancelKeyboard());
                return;
            }

            cache.userStates.set(fromId, { ...uState, action: 'create_task_qty', rules: text.trim() });
            sendMessage(chatId, "🎯 <b>কতটি রেফার বা ভোট প্রয়োজন? সংখ্যা লিখুন:</b>", getCancelKeyboard());
            return;
        }

        if (uState?.action === 'create_task_qty') {
            if (!isPositiveInt(text)) {
                sendMessage(chatId, "❌ <b>ভুল সংখ্যা!</b> দয়া করে সঠিক পূর্ণসংখ্যা লিখুন (যেমন: 10):", getCancelKeyboard());
                return;
            }

            const minReward = Number(getSetting('min_task_reward', 1));
            cache.userStates.set(fromId, { ...uState, action: 'create_task_reward', qty: parseInt(text) });

            sendMessage(chatId,
                `🪙 <b>প্রতি কাজের জন্য কত কয়েন দিতে চান?</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
                `⚠️ <b>মিনিমাম রেট:</b> ${minReward} Coin\n\n` +
                `💡 <i>নোট: আপনি যত বেশি কয়েন অফার করবেন, আপনার কাজটি তত উপরে শো করবে এবং মেম্বাররা সবার আগে আপনার কাজ সম্পন্ন করবে!</i>\n\n` +
                `কয়েনের সংখ্যা লিখুন:`,
                getCancelKeyboard()
            );
            return;
        }

        if (uState?.action === 'create_task_reward') {
            const minReward = Number(getSetting('min_task_reward', 1));
            if (!isPositiveInt(text) || parseInt(text) < minReward) {
                sendMessage(chatId, `❌ প্রতি কাজের জন্য কমপক্ষে <b>${minReward} Coin</b> দিতে হবে। সঠিক সংখ্যা লিখুন:`, getCancelKeyboard());
                return;
            }

            const rewardPerTask = parseInt(text);
            const totalCost = uState.qty * rewardPerTask;
            const u = await getUser(fromId);
            const currentBal = Number(u?.balance || 0);

            if (currentBal < totalCost) {
                cache.userStates.delete(fromId);
                sendMessage(chatId,
                    `⚠️ <b>কয়েন অপর্যাপ্ত!</b>\n\n` +
                    `মোট প্রয়োজন: <b>${totalCost} Coins</b>\n` +
                    `আপনার বর্তমান ব্যালেন্স: <b>${currentBal} Coins</b>\n\n` +
                    `আপনি কাজ করে কয়েন আয় করতে পারেন অথবা চাইলে ডিপোজিট করে ব্যালেন্স বাড়াতে পারেন।`,
                    getUserMenu(fromId)
                );
                return;
            }

            updateUser(fromId, { balance: currentBal - totalCost });

            const taskId = `TSK${Math.floor(1000 + Math.random() * 9000)}`;
            const taskObj = {
                task_id: taskId,
                creator_id: fromId,
                type: uState.taskType,
                link: uState.link,
                instructions: uState.rules,
                total_needed: uState.qty,
                completed_count: 0,
                reward_per_worker: rewardPerTask,
                status: 'active',
                created_at: Math.floor(Date.now() / 1000)
            };

            cache.tasks.set(taskId, taskObj);
            firebaseRequest(`tasks/${taskId}`, 'PUT', taskObj).catch(() => {});
            cache.userStates.delete(fromId);

            sendMessage(chatId,
                `🎉 <b>টাস্ক সফলভাবে পাবলিশ হয়েছে!</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
                `🆔 <b>টাস্ক আইডি:</b> <code>#${taskId}</code>\n` +
                `🎯 <b>টার্গেট:</b> ${uState.qty} টি\n` +
                `💰 <b>প্রতি কাজের রেট:</b> ${rewardPerTask} Coins\n` +
                `💵 <b>মোট খরচ:</b> ${totalCost} Coins\n\n` +
                `টাস্কটি বর্তমানে লাইভ রয়েছে। 'My Tasks' থেকে লাইভ আপডেট দেখতে পারবেন।`,
                getUserMenu(fromId)
            );
            return;
        }

        // =========================================================================
        // টাস্ক প্রুফ স্ক্রিনশট রিসিভ
        // =========================================================================
        if (uState?.action === 'task_step_photo') {
            if (!msg.photo || !msg.photo.length) {
                sendMessage(chatId, "❌ দয়া করে কাজের সফলতার <b>স্ক্রিনশট ছবি (Photo)</b> পাঠান:", getCancelKeyboard());
                return;
            }

            const largestPhoto = msg.photo[msg.photo.length - 1];
            const proofChannel = getSetting('task_proof_channel_id', DEFAULT_TASK_PROOF_LOG_ID);
            const subId = `SUB_${Date.now()}`;

            const subData = {
                sub_id: subId,
                task_id: uState.taskId,
                worker_id: fromId,
                worker_name: msg.from.first_name || 'User',
                reward: uState.reward,
                file_id: largestPhoto.file_id,
                status: 'pending',
                created_at: Math.floor(Date.now() / 1000)
            };

            firebaseRequest(`task_submissions/${subId}`, 'PUT', subData).catch(() => {});
            cache.userStates.delete(fromId);

            const caption =
                `🔔 <b>NEW TASK PROOF!</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
                `👤 <b>ওয়ার্কার:</b> ${escapeHtml(subData.worker_name)} (<code>${fromId}</code>)\n` +
                `📌 <b>টাস্ক আইডি:</b> <code>#${subData.task_id}</code>\n` +
                `💰 <b>রিওয়ার্ড:</b> ${subData.reward} Coins\n\n` +
                `অ্যাডমিন স্ক্রিনশট যাচাই করে সিদ্ধান্ত দিন:`;

            const adminKb = {
                inline_keyboard: [
                    [
                        { text: '✅ Approve', callback_data: `tp_app_${subId}`, style: 'success' },
                        { text: '❌ Reject', callback_data: `tp_rej_${subId}`, style: 'danger' }
                    ]
                ]
            };

            await sendPhoto(proofChannel, largestPhoto.file_id, caption, adminKb);

            sendMessage(chatId, "✅ <b>আপনার কাজের প্রুফ জমা হয়েছে!</b>\nএডমিন ভেরিফাই করে এপ্রুভ করলে কয়েন অ্যাকাউন্টে যোগ হবে।", getUserMenu(fromId));
            return;
        }

        // =========================================================================
        // অ্যাডমিন স্টেটস
        // =========================================================================
        if (isAdm) {
            const aState = cache.adminStates.get(fromId);

            if (aState?.action === 'pkg_add_taka' && text) {
                if (!isPositiveInt(text)) {
                    sendMessage(chatId, "❌ সঠিক টাকার পরিমাণ (সংখ্যা) লিখুন:", getCancelKeyboard());
                    return;
                }
                cache.adminStates.set(fromId, { action: 'pkg_add_coins', taka: parseInt(text) });
                sendMessage(chatId, `💰 <b>${text} টাকায় কত কয়েন দিতে চান? কয়েনের সংখ্যা লিখুন:</b>`, getCancelKeyboard());
                return;
            }

            if (aState?.action === 'pkg_add_coins' && text) {
                if (!isPositiveInt(text)) {
                    sendMessage(chatId, "❌ সঠিক কয়েনের পরিমাণ (সংখ্যা) লিখুন:", getCancelKeyboard());
                    return;
                }
                const coins = parseInt(text);
                const pkgId = `pkg_${Date.now()}`;
                const newPkg = { id: pkgId, taka: aState.taka, coins: coins };

                cache.packages.set(pkgId, newPkg);
                firebaseRequest(`packages/${pkgId}`, 'PUT', newPkg).catch(() => {});
                cache.adminStates.delete(fromId);

                sendMessage(chatId, `✅ <b>নতুন প্যাকেজ সফলভাবে যুক্ত হয়েছে!</b>\n💵 <b>${newPkg.taka}৳ = ${newPkg.coins} Coins</b>`, getAdminMenu());
                return;
            }

            if (aState?.action === 'cfg_dep_chan' && text) {
                setSetting('deposit_channel_id', text.trim());
                cache.adminStates.delete(fromId);
                sendMessage(chatId, `✅ <b>ডিপোজিট চ্যানেল আইডি আপডেট হয়েছে:</b> <code>${text.trim()}</code>`, getAdminMenu());
                return;
            }

            if (aState?.action === 'cfg_proof_chan' && text) {
                setSetting('task_proof_channel_id', text.trim());
                cache.adminStates.delete(fromId);
                sendMessage(chatId, `✅ <b>টাস্ক প্রুফ চ্যানেল আইডি আপডেট হয়েছে:</b> <code>${text.trim()}</code>`, getAdminMenu());
                return;
            }

            if (aState?.action === 'cfg_min_task_reward' && text) {
                if (!isPositiveInt(text)) {
                    sendMessage(chatId, "❌ সঠিক সংখ্যা দিন:", getCancelKeyboard());
                    return;
                }
                setSetting('min_task_reward', parseInt(text));
                cache.adminStates.delete(fromId);
                sendMessage(chatId, `✅ <b>টাস্কের মিনিমাম কয়েন রেট সেট হয়েছে: ${text} Coins</b>`, getAdminMenu());
                return;
            }

            if (aState?.action === 'balance_add_uid' && text) {
                const target = await getUser(text.trim());
                if (!target) {
                    sendMessage(chatId, "❌ ইউজার পাওয়া যায়নি!", getCancelKeyboard());
                    return;
                }
                cache.adminStates.set(fromId, { action: 'balance_add_amt', uid: text.trim() });
                sendMessage(chatId, `👤 <b>ইউজার:</b> ${escapeHtml(target.first_name)}\n💰 বর্তমান ব্যালেন্স: ${target.balance || 0} Coins\n\nকত কয়েন যোগ করতে চান?`, getCancelKeyboard());
                return;
            }

            if (aState?.action === 'balance_add_amt' && text) {
                if (!isPositiveInt(text)) {
                    sendMessage(chatId, "❌ সঠিক সংখ্যা দিন:", getCancelKeyboard());
                    return;
                }
                const amt = parseInt(text);
                const target = await getUser(aState.uid);
                if (target) {
                    const newBal = Number(target.balance || 0) + amt;
                    updateUser(aState.uid, { balance: newBal });
                    cache.adminStates.delete(fromId);
                    sendMessage(chatId, `✅ <b>+${amt} Coins যোগ করা হয়েছে!</b>\nনতুন ব্যালেন্স: ${newBal} Coins`, getAdminMenu());
                    sendMessage(aState.uid, `🎁 <b>এডমিন আপনার একাউন্টে +${amt} Coins যোগ করেছেন!</b>\nবর্তমান ব্যালেন্স: ${newBal} Coins`).catch(() => {});
                }
                return;
            }

            // ফোর্স চ্যানেল ইনপুট
            if (aState?.action === 'add_force_channel_input') {
                sendMessage(chatId, "🔍 চ্যানেল এবং পারমিশন ভেরিফাই করা হচ্ছে...");
                const check = await verifyChannelAndBotAdmin(text);
                if (!check.ok) {
                    sendMessage(chatId, check.error, getCancelKeyboard());
                    return;
                }
                cache.adminStates.set(fromId, {
                    action: 'add_force_channel_confirm',
                    channel_id: check.channel_id,
                    channel_title: check.channel_title,
                    channel_username: check.channel_username,
                    channel_link: check.channel_link
                });
                sendMessage(chatId, `✅ <b>চ্যানেল ভেরিফাইড!</b>\n📢 ${escapeHtml(check.channel_title)}\n\n🔘 বাটনের নাম লিখুন (যেমন: Join):`, getCancelKeyboard());
                return;
            }

            if (aState?.action === 'add_force_channel_confirm') {
                const btnName = text.trim() || aState.channel_title;
                const chObj = {
                    channel_id: aState.channel_id,
                    channel_link: aState.channel_link || `https://t.me/${aState.channel_id}`,
                    channel_name: btnName,
                    channel_username: aState.channel_username || '',
                    added_by: fromId,
                    added_at: Math.floor(Date.now() / 1000)
                };
                const newKey = `fc_${Date.now()}`;
                cache.forceChannels[newKey] = chObj;
                cache.userChannels.clear();
                firebaseRequest(`force_channels/${newKey}`, 'PUT', chObj).catch(() => {});
                cache.adminStates.delete(fromId);
                sendMessage(chatId, `🎉 <b>Force Join Channel Added Successfully!</b>\n\n📢 <b>${escapeHtml(btnName)}</b>`, getAdminMenu());
                return;
            }
        }

        // =========================================================================
        // সাধারণ ইউজার মেনু বাটনসমূহ (ইংলিশ লেবেল)
        // =========================================================================
        if (text === '/start' || text.startsWith('/start')) {
            sendMessage(chatId,
                `👋 <b>Welcome ${escapeHtml(msg.from.first_name || 'User')}!</b>\n\n` +
                `Earn coins by completing simple tasks or promote your own Bot Referrals & Poll Votes.\n` +
                `Use the buttons below to get started:`,
                getUserMenu(fromId)
            );
            return;
        }

        if (text === '💰 Earn Coins') {
            const kb = {
                inline_keyboard: [
                    [
                        { text: '📢 Bot Refer Tasks', callback_data: 'view_cat_refer', style: 'primary' },
                        { text: '📦 Poll Vote Tasks', callback_data: 'view_cat_vote', style: 'success' }
                    ]
                ]
            };
            sendMessage(chatId, "💰 <b>Earn Coins Section</b>\nSelect the task category you want to complete:", kb);
            return;
        }

        if (text === '💳 Deposit') {
            if (!cache.packages.size) {
                sendMessage(chatId, "⚠️ বর্তমানে কোনো ডিপোজিট প্যাকেজ নেই। কিছুক্ষণ পর চেষ্টা করুন।");
                return;
            }
            sendMessage(chatId,
                `💳 <b>কয়েন ডিপোজিট প্যাকেজ</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
                `কয়েন কিনতে নিচের প্যাকেজগুলো থেকে নির্বাচন করুন:`,
                getDepositPackagesKeyboard()
            );
            return;
        }

        if (text === '📢 Bot Refer Buy' || text === '📦 Poll Vote Buy') {
            const isRefer = text.includes('Bot Refer');
            cache.userStates.set(fromId, {
                action: 'create_task_link',
                taskType: isRefer ? 'bot_refer' : 'poll_vote'
            });

            sendMessage(chatId,
                `🚀 <b>${isRefer ? 'Bot Refer' : 'Poll Vote'} অর্ডার</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
                `যে ${isRefer ? 'বটের রেফারেল লিংক' : 'চ্যানেলের পোল পোস্ট লিংক'} প্রচার করতে চান, সেই <b>লিংকটি পাঠান:</b>`,
                getCancelKeyboard()
            );
            return;
        }

        if (text === '📜 My Tasks') {
            sendMessage(chatId, "🔍 <i>Loading your tasks...</i>");
            const all = await firebaseRequest('tasks');
            let out = `📜 <b>YOUR ORDERED TASKS</b>\n━━━━━━━━━━━━━━━━━━━━\n\n`;
            let has = false;

            if (all && typeof all === 'object') {
                for (const t of Object.values(all)) {
                    if (t && String(t.creator_id) === fromId) {
                        has = true;
                        const remaining = Math.max(0, Number(t.total_needed) - Number(t.completed_count || 0));
                        out += `📋 <b>Task ID:</b> <code>#${t.task_id}</code>\n` +
                            `📌 Type: ${t.type === 'bot_refer' ? '📢 Bot Refer' : '📦 Poll Vote'}\n` +
                            `🎯 Target: <b>${t.total_needed}</b>\n` +
                            `✅ Completed: <b>${t.completed_count || 0}</b>\n` +
                            `⏳ Remaining: <b>${remaining}</b>\n` +
                            `💰 Rate: <b>${t.reward_per_worker} Coins/task</b>\n` +
                            `📊 Status: <b>${t.status.toUpperCase()}</b>\n` +
                            `━━━━━━━━━━━━━━━━━━━━\n`;
                    }
                }
            }

            if (!has) out += "❌ You have not created any tasks yet.";
            sendMessage(chatId, out, getUserMenu(fromId));
            return;
        }

        if (text === '👤 Profile') {
            const u = await getUser(fromId);
            const prof =
                `👤 <b>YOUR PROFILE</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
                `🆔 <b>ID:</b> <code>${fromId}</code>\n` +
                `👤 <b>Name:</b> ${escapeHtml(msg.from.first_name || 'User')}\n` +
                `🔗 <b>Username:</b> ${msg.from.username ? `@${msg.from.username}` : 'N/A'}\n\n` +
                `💰 <b>Balance:</b> <b>${formatNumber(u?.balance || 0)} Coins</b>\n` +
                `👥 <b>Total Referrals:</b> ${u?.total_referrals || 0} Users`;
            sendMessage(chatId, prof, getUserMenu(fromId));
            return;
        }

        if (text === '📮 Referral') {
            const link = `https://t.me/${BOT_USERNAME}?start=${fromId}`;
            const bonus = getSetting('referral_bonus', 2);
            const refText =
                `📮 <b>Refer & Earn Program</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
                `Share your invite link with friends and earn free coins!\n\n` +
                `🎁 <b>Reward:</b> ${bonus} Coins per verified referral\n\n` +
                `🔗 <b>Your Referral Link:</b>\n<code>${link}</code>\n\n` +
                `<i>⚠️ Note: Referrals count only after channels are verified!</i>`;
            sendMessage(chatId, refText, getUserMenu(fromId));
            return;
        }

        if (text === '💬 Support') {
            sendMessage(chatId, `💬 <b>Support Center</b>\n\nNeed help? Contact our support administrator:\n👉 ${DEFAULT_SUPPORT_URL}`);
            return;
        }

        // =========================================================================
        // অ্যাডমিন মেনু বাটনসমূহ
        // =========================================================================
        if (text === '🛠 Admin Panel' && isAdm) {
            sendMessage(chatId, "🛠 <b>Admin Control Panel Activated</b>", getAdminMenu());
            return;
        }

        if (text === '➕ Add Package' && isAdm) {
            cache.adminStates.set(fromId, { action: 'pkg_add_taka' });
            sendMessage(chatId, "➕ <b>নতুন প্যাকেজ তৈরি</b>\n\nপ্রথমে টাকার পরিমাণ (BDT) লিখুন:\n<i>(যেমন: 20)</i>", getCancelKeyboard());
            return;
        }

        if (text === '➖ Remove Package' && isAdm) {
            if (!cache.packages.size) {
                sendMessage(chatId, "⚠️ কোনো প্যাকেজ নেই!");
                return;
            }
            const kb = [];
            for (const [id, p] of cache.packages) {
                kb.push([{ text: `❌ ${p.taka}৳ = ${p.coins} Coins`, callback_data: `rem_pkg_${id}`, style: 'danger' }]);
            }
            sendMessage(chatId, "🗑 <b>যে প্যাকেজটি ডিলিট করতে চান নির্বাচন করুন:</b>", { inline_keyboard: kb });
            return;
        }

        if (text === '📋 Package List' && isAdm) {
            let list = "📋 <b>বর্তমান ডিপোজিট প্যাকেজসমূহ:</b>\n━━━━━━━━━━━━━━━━━━━━\n";
            if (!cache.packages.size) list += "কোনো প্যাকেজ নেই।";
            else {
                for (const [, p] of cache.packages) {
                    list += `• <b>${p.taka} BDT = ${p.coins} Coins</b>\n`;
                }
            }
            sendMessage(chatId, list, getAdminMenu());
            return;
        }

        if (text === '📢 Force Channels' && isAdm) {
            const count = Object.keys(cache.forceChannels).length;
            sendMessage(chatId, `📢 <b>FORCE JOIN CHANNELS</b>\n\nমোট চ্যানেল: <b>${count}</b> টি`, forceJoinKeyboard());
            return;
        }

        if (text === '⚙️ Central Settings' && isAdm) {
            const kb = {
                inline_keyboard: [
                    [{ text: '💳 ডিপোজিট চ্যানেল সেট', callback_data: 'admin_set_dep_chan', style: 'primary' }],
                    [{ text: '📸 টাস্ক প্রুফ চ্যানেল সেট', callback_data: 'admin_set_proof_chan', style: 'primary' }],
                    [{ text: '🪙 মিনিমাম টাস্ক কয়েন রেট', callback_data: 'admin_set_min_task_reward', style: 'success' }]
                ]
            };
            sendMessage(chatId, "⚙️ <b>সেন্ট্রাল সেটিংস কনফিগারেশন:</b>", kb);
            return;
        }

        if (text === '👥 Balance Control' && isAdm) {
            cache.adminStates.set(fromId, { action: 'balance_add_uid' });
            sendMessage(chatId, "👥 <b>ব্যালেন্স যোগ করুন</b>\n\nইউজারের Telegram Numeric ID পাঠান:", getCancelKeyboard());
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
| ১১. ক্যাশ প্রি-ওয়ার্মিং (স্টার্টআপে দ্রুত লোড)
|--------------------------------------------------------------------------
*/
async function preloadEngine() {
    console.log(`⚡ Pre-warming Cache for ${BOT_NAME}...`);
    try {
        const [settings, pkgs, trxList, tasksList, forceCh] = await Promise.all([
            firebaseRequest('settings'),
            firebaseRequest('packages'),
            firebaseRequest('used_trxids'),
            firebaseRequest('tasks'),
            firebaseRequest('force_channels')
        ]);

        if (settings && typeof settings === 'object') {
            for (const [k, v] of Object.entries(settings)) cache.settings.set(k, v);
        }

        if (pkgs && typeof pkgs === 'object') {
            for (const [k, v] of Object.entries(pkgs)) cache.packages.set(k, v);
        } else {
            const def1 = { id: 'pkg_1', taka: 5, coins: 10 };
            const def2 = { id: 'pkg_2', taka: 20, coins: 45 };
            cache.packages.set('pkg_1', def1);
            cache.packages.set('pkg_2', def2);
            firebaseRequest('packages/pkg_1', 'PUT', def1).catch(() => {});
            firebaseRequest('packages/pkg_2', 'PUT', def2).catch(() => {});
        }

        if (trxList && typeof trxList === 'object') {
            for (const k of Object.keys(trxList)) cache.usedTrxIds.add(k.toUpperCase());
        }

        if (tasksList && typeof tasksList === 'object') {
            for (const [k, v] of Object.entries(tasksList)) cache.tasks.set(k, v);
        }

        if (forceCh && typeof forceCh === 'object') {
            cache.forceChannels = forceCh;
        }

        console.log(`✅ System connected & Ready! Number: ${PAYMENT_NUMBER}`);
    } catch (e) {
        console.error('Preload Error:', e.message);
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
