/*
|--------------------------------------------------------------------------
| 𝐀𝐔𝐑𝐀 𝐓𝐀𝐒𝐊 & 𝐄𝐀𝐑𝐍 (TURBO SPEED ENGINE ⚡)
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

// ডিফল্ট চ্যানেল ও লিংক
const DEFAULT_DEPOSIT_LOG_ID = '-1003945593094';
const DEFAULT_TASK_PROOF_LOG_ID = '-1003945593094';
const DEFAULT_SUPPORT_URL = 'https://t.me/Sakib_Developer1';

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
    admins: {},
    adminStates: new Map(),
    userStates: new Map()
};

/*
|--------------------------------------------------------------------------
| ৪. ফরম্যাটিং হেল্পার ফাংশন
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
    return str !== '' && !isNaN(Number(str)) && isFinite(Number(str)) && Number(str) > 0;
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

/*
|--------------------------------------------------------------------------
| ৫. ফায়ারবেস ক্লায়েন্ট (REST API)
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
| ৬. টেলিগ্রাম API ক্লায়েন্ট
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
| ৮. কীবোর্ড ও মেনুসমূহ
|--------------------------------------------------------------------------
*/
function getUserMenu(userId) {
    const keyboard = [
        [{ text: '📢 Bot Refer Buy' }, { text: '📦 Poll Vote Buy' }],
        [{ text: '💰 আর্ন কয়েন' }, { text: '📜 আমার কাজ' }],
        [{ text: '💳 Deposit' }, { text: '👤 প্রোফাইল' }],
        [{ text: '🎯 Refer & Earn' }, { text: '💬 Support' }]
    ];
    if (isAdmin(userId)) {
        keyboard.push([{ text: '🛠 Admin Panel' }]);
    }
    return { keyboard, resize_keyboard: true };
}

function getAdminMenu() {
    return {
        keyboard: [
            [{ text: '➕ প্যাকেজ যোগ করুন' }, { text: '📋 প্যাকেজ তালিকা' }],
            [{ text: '⚙️ সেন্ট্রাল সেটিংস' }, { text: '👥 ব্যালেন্স কন্ট্রোল' }],
            [{ text: '🔙 Back to User Panel' }]
        ],
        resize_keyboard: true
    };
}

function getCancelKeyboard() {
    return { keyboard: [[{ text: '/cancel' }]], resize_keyboard: true, one_time_keyboard: true };
}

// ডিপোজিট প্যাকেজ বাটন জেনারেটর
function getDepositPackagesKeyboard() {
    const buttons = [];
    const pkgs = Array.from(cache.packages.entries());

    // ২ কলাম করে বাটন সাজানো
    for (let i = 0; i < pkgs.length; i += 2) {
        const row = [];
        const [id1, p1] = pkgs[i];
        row.push({ text: `💵 ${p1.taka}৳ = ${p1.coins} Coin`, callback_data: `dep_pkg_${id1}` });

        if (i + 1 < pkgs.length) {
            const [id2, p2] = pkgs[i + 1];
            row.push({ text: `💵 ${p2.taka}৳ = ${p2.coins} Coin`, callback_data: `dep_pkg_${id2}` });
        }
        buttons.push(row);
    }
    return { inline_keyboard: buttons };
}

/*
|--------------------------------------------------------------------------
| ৯. আপডেট প্রসেসর
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
                `📦 <b>সিলেক্টেড প্যাকেজ:</b> ${formatNumber(pkg.taka)}৳ = ${formatNumber(pkg.coins)} Coins\n` +
                `💵 <b>পাঠাতে হবে:</b> <b>${formatNumber(pkg.taka)} টাকা</b>\n\n` +
                `📱 <b>বিকাশ ও নগদ (Personal):</b>\n` +
                `👉 <code>${PAYMENT_NUMBER}</code> <i>(ক্লিক করলে কপি হবে)</i>\n\n` +
                `⚠️ <b>সতর্কতা:</b>\n` +
                `• শুধুমাত্র <b>Send Money</b> করবেন।\n` +
                `• কম বা বেশি টাকা পাঠাবেন না, হুবহু <b>${formatNumber(pkg.taka)} টাকা</b> পাঠাবেন।\n` +
                `• টাকা পাঠানো শেষে নিচে থাকা <b>"পেমেন্ট প্রুফ জমা দিন"</b> বাটনে ক্লিক করুন।`;

            const keyboard = {
                inline_keyboard: [
                    [{ text: '📥 পেমেন্ট প্রুফ জমা দিন', callback_data: `start_dep_proof_${pkgId}` }]
                ]
            };

            sendMessage(fromId, depositInstructions, keyboard);
            return;
        }

        // --- পেমেন্ট প্রুফ সাবমিট শুরু (ধাপ ১: স্ক্রিনশট চাওয়া) ---
        if (data.startsWith('start_dep_proof_')) {
            answerCallback(callback.id);
            const pkgId = data.replace('start_dep_proof_', '');
            const pkg = cache.packages.get(pkgId);

            if (!pkg) {
                sendMessage(fromId, "❌ প্যাকেজটি পাওয়া যায়নি!");
                return;
            }

            // ইউজারের স্টেট সেট
            cache.userStates.set(fromId, {
                action: 'dep_step_photo',
                pkgId: pkgId,
                taka: pkg.taka,
                coins: pkg.coins
            });

            sendMessage(fromId,
                `📸 <b>ধাপ ১: স্ক্রিনশট পাঠান</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
                `প্যাকেজ: <b>${pkg.taka}৳ = ${pkg.coins} Coin</b>\n\n` +
                `টাকা পাঠানোর সফল স্ক্রিনশটটি ছবি (Photo) হিসেবে ইনবক্সে পাঠান:\n` +
                `<i>(বাতিল করতে /cancel লিখুন)</i>`,
                getCancelKeyboard()
            );
            return;
        }

        // --- টাস্ক কাজ শুরু (আর্ন কয়েন সেকশন থেকে) ---
        if (data.startsWith('do_task_')) {
            answerCallback(callback.id);
            const taskId = data.replace('do_task_', '');
            const task = cache.tasks.get(taskId);

            if (!task || task.status !== 'active') {
                sendMessage(fromId, "⚠️ এই কাজটি ইতিমধ্যে শেষ হয়ে গেছে!");
                return;
            }

            // চেক: ইউজার পূর্বে করেছে কি না
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
                `📝 <b>নিয়ম:</b> ${escapeHtml(task.instructions)}\n\n` +
                `👉 লিংকে গিয়ে কাজ শেষ করে প্রুফ হিসেবে <b>স্ক্রিনশট (Photo)</b> পাঠান:`;

            sendMessage(fromId, taskDetailText, getCancelKeyboard());
            return;
        }

        // =========================================================================
        // অ্যাডমিন একশন: ডিপোজিট অ্যাপ্রুভ / রিজেক্ট (লগ চ্যানেলে)
        // =========================================================================
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
                // কয়েন যোগ
                const targetUser = await getUser(dep.user_id);
                if (targetUser) {
                    const newBal = Number(targetUser.balance || 0) + Number(dep.coins);
                    updateUser(dep.user_id, { balance: newBal });

                    // ইউজারকে মেসেজ
                    sendMessage(dep.user_id,
                        `🎉 <b>পেমেন্ট প্রুফ এপ্রুভ হয়েছে!</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
                        `✅ আপনার ডিপোজিট সফলভাবে ভেরিফাই করা হয়েছে।\n` +
                        `💰 যুক্ত হয়েছে: <b>+${formatNumber(dep.coins)} Coins</b>\n` +
                        `💳 বর্তমান ব্যালেন্স: <b>${formatNumber(newBal)} Coins</b>\n\n` +
                        `ধন্যবাদ আমাদের সাথে থাকার জন্য!`
                    ).catch(() => {});
                }

                // স্ট্যাটাস আপডেট
                firebaseRequest(`deposits/${depId}`, 'PATCH', { status: 'approved', processed_by: fromId, processed_at: now }).catch(() => {});

                // ক্যাপশন আপডেট
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
                // রিজেক্ট স্ট্যাটাস
                firebaseRequest(`deposits/${depId}`, 'PATCH', { status: 'rejected', processed_by: fromId, processed_at: now }).catch(() => {});

                sendMessage(dep.user_id,
                    `❌ <b>পেমেন্ট প্রুফ বাতিল করা হয়েছে!</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
                    `আপনার প্রেরিত Trx ID বা তথ্যের সাথে পেমেন্টের মিল পাওয়া যায়নি।\n` +
                    `প্রয়োজনে সাপোর্টে যোগাযোগ করুন।`
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

        // =========================================================================
        // অ্যাডমিন একশন: টাস্ক প্রুফ অ্যাপ্রুভ / রিজেক্ট
        // =========================================================================
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
                    sendMessage(sub.worker_id, `🎉 <b>টাস্ক প্রুফ এপ্রুভ হয়েছে!</b>\n+${formatNumber(sub.reward)} Coins যোগ হয়েছে।`).catch(() => {});
                }

                // টাস্ক কাউন্ট বৃদ্ধি
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

                // সম্পন্ন হিসেবে রেকর্ড
                firebaseRequest(`task_completions/${sub.task_id}/${sub.worker_id}`, 'PUT', true).catch(() => {});
                firebaseRequest(`task_submissions/${subId}`, 'PATCH', { status: 'approved', processed_at: now }).catch(() => {});

                editMessageCaption(chatId, messageId, `✅ <b>TASK PROOF APPROVED (+${sub.reward} Coins)</b>`);
                return;
            }

            if (action === 'rej') {
                firebaseRequest(`task_submissions/${subId}`, 'PATCH', { status: 'rejected', processed_at: now }).catch(() => {});
                sendMessage(sub.worker_id, `❌ <b>টাস্ক প্রুফ বাতিল হয়েছে!</b>\nসঠিকভাবে কাজ সম্পন্ন করে পুনরায় চেষ্টা করুন।`).catch(() => {});
                editMessageCaption(chatId, messageId, `❌ <b>TASK PROOF REJECTED</b>`);
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
                created_at: Math.floor(Date.now() / 1000)
            };
            cache.users.set(fromId, user);
            firebaseRequest(`users/${fromId}`, 'PUT', user).catch(() => {});

            if (refBy) {
                const refUser = await getUser(refBy);
                if (refUser) {
                    const refBonus = Number(getSetting('referral_bonus', 2));
                    updateUser(refBy, {
                        balance: Number(refUser.balance || 0) + refBonus,
                        total_referrals: Number(refUser.total_referrals || 0) + 1
                    });
                    sendMessage(refBy, `🎉 <b>নতুন রেফারেল যুক্ত হয়েছে!</b> +${refBonus} Coins যোগ হয়েছে।`).catch(() => {});
                }
            }
        }

        if (text === '/cancel') {
            cache.userStates.delete(fromId);
            cache.adminStates.delete(fromId);
            sendMessage(chatId, "❌ বাতিল করা হয়েছে।", getUserMenu(fromId));
            return;
        }

        // =========================================================================
        // ডিপোজিট প্রুফ সাবমিশন (ধাপে ধাপে সিকোয়েন্সিয়াল ফ্লো)
        // =========================================================================
        const uState = cache.userStates.get(fromId);

        // --- ধাপ ১: স্ক্রিনশট ফটো রিসিভ ---
        if (uState?.action === 'dep_step_photo') {
            if (!msg.photo || !msg.photo.length) {
                sendMessage(chatId, "❌ দয়া করে শুধুমাত্র পেমেন্টের <b>স্ক্রিনশট ছবি (Photo)</b> পাঠান:", getCancelKeyboard());
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
                `আপনার বিকাশ/নগদ পেমেন্টের <b>Trx ID (Transaction ID)</b> লিখে পাঠান:\n` +
                `<i>(যেমন: BLK9827364)</i>`,
                getCancelKeyboard()
            );
            return;
        }

        // --- ধাপ ২: Trx ID রিসিভ ও ডুপ্লিকেট চেক ---
        if (uState?.action === 'dep_step_trx' && text) {
            const cleanTrx = text.trim().toUpperCase();

            // ডুপ্লিকেট TrxID প্রিভেনশন চেক
            if (cache.usedTrxIds.has(cleanTrx)) {
                sendMessage(chatId, "❌ <b>এই Trx ID পূর্বে একবার ব্যবহার করা হয়েছে!</b>\nনতুন ও সঠিক Trx ID দিন অথবা /cancel লিখুন:", getCancelKeyboard());
                return;
            }

            // ডাটাবেজ থেকেও কনফার্ম চেক
            const trxCheck = await firebaseRequest(`used_trxids/${cleanTrx}`);
            if (trxCheck) {
                cache.usedTrxIds.add(cleanTrx);
                sendMessage(chatId, "❌ <b>এই Trx ID পূর্বে একবার ব্যবহার করা হয়েছে!</b>\nনতুন ও সঠিক Trx ID দিন অথবা /cancel লিখুন:", getCancelKeyboard());
                return;
            }

            cache.userStates.set(fromId, {
                ...uState,
                action: 'dep_step_phone',
                trx_id: cleanTrx
            });

            sendMessage(chatId,
                `📱 <b>ধাপ ৩: প্রেরক নাম্বার পাঠান</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
                `আপনি যে বিকাশ বা নগদ নাম্বার থেকে টাকা পাঠিয়েছেন, সেই <b>মোবাইল নাম্বারটি</b> লিখে পাঠান:`,
                getCancelKeyboard()
            );
            return;
        }

        // --- ধাপ ৩: প্রেরক নাম্বার রিসিভ ও চ্যানেলে প্রুফ সেন্ড ---
        if (uState?.action === 'dep_step_phone' && text) {
            const senderNumber = text.trim();
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

            // ক্যাশ ও ডাটাবেজে TrxID ব্লক
            cache.usedTrxIds.add(uState.trx_id);
            firebaseRequest(`used_trxids/${uState.trx_id}`, 'PUT', { user_id: fromId, date: Date.now() }).catch(() => {});
            firebaseRequest(`deposits/${depId}`, 'PUT', depData).catch(() => {});

            cache.userStates.delete(fromId);

            // ডিপোজিট লগ চ্যানেলে ছবি সহ মেসেজ পাঠানো
            const channelCaption =
                `🔔 <b>NEW DEPOSIT SUBMITTED!</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
                `👤 <b>ইউজার:</b> ${escapeHtml(depData.user_name)} (<code>${depData.user_id}</code>)\n` +
                `🔗 <b>ইউজারনেম:</b> ${escapeHtml(depData.user_username || 'N/A')}\n\n` +
                `📦 <b>সিলেক্টেড প্যাকেজ:</b> ${depData.taka}৳ = ${depData.coins} Coins\n` +
                `💵 <b>টাকা:</b> <b>${depData.taka} BDT</b>\n` +
                `🪙 <b>পাবে:</b> <b>${depData.coins} Coins</b>\n\n` +
                `📱 <b>টাকা পাঠানো নাম্বার:</b> <code>${escapeHtml(senderNumber)}</code>\n` +
                `🧾 <b>Trx ID:</b> <code>${escapeHtml(depData.trx_id)}</code>\n` +
                `🕒 <b>সময়:</b> ${formatTimestamp(depData.created_at)}\n\n` +
                `⚠️ <i>দয়া করে ট্রানজেকশন চেক করে নিচে সিদ্ধান্ত নিন:</i>`;

            const adminKeyboard = {
                inline_keyboard: [
                    [
                        { text: '✅ Approve', callback_data: `dep_app_${depId}` },
                        { text: '❌ Reject', callback_data: `dep_rej_${depId}` }
                    ]
                ]
            };

            await sendPhoto(logChannel, depData.file_id, channelCaption, adminKeyboard);

            sendMessage(chatId,
                `✅ <b>আপনার পেমেন্ট প্রুফ জমা হয়েছে!</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
                `📦 প্যাকেজ: <b>${depData.taka}৳ = ${depData.coins} Coins</b>\n` +
                `🧾 Trx ID: <code>${depData.trx_id}</code>\n` +
                `📱 প্রেরক নাম্বার: <code>${senderNumber}</code>\n\n` +
                `⏳ আপনার রিকোয়েস্টটি বর্তমানে <b>পেন্ডিং (Pending)</b> রয়েছে। এডমিন ভেরিফাই করে এপ্রুভ করলেই আপনার একাউন্টে কয়েন যুক্ত হয়ে যাবে।`,
                getUserMenu(fromId)
            );
            return;
        }

        // =========================================================================
        // টাস্ক প্রুফ স্ক্রিনশট রিসিভ (আর্ন কয়েন)
        // =========================================================================
        if (uState?.action === 'task_step_photo') {
            if (!msg.photo || !msg.photo.length) {
                sendMessage(chatId, "❌ দয়া করে কাজের <b>স্ক্রিনশট ছবি (Photo)</b> পাঠান:", getCancelKeyboard());
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
                `📌 <b>টাস্ক আইডি:</b> <code>${subData.task_id}</code>\n` +
                `💰 <b>রিওয়ার্ড:</b> ${subData.reward} Coins\n\n` +
                `এডমিন স্ক্রিনশট যাচাই করে সিদ্ধান্ত দিন:`;

            const adminKb = {
                inline_keyboard: [
                    [
                        { text: '✅ Approve', callback_data: `tp_app_${subId}` },
                        { text: '❌ Reject', callback_data: `tp_rej_${subId}` }
                    ]
                ]
            };

            await sendPhoto(proofChannel, largestPhoto.file_id, caption, adminKb);

            sendMessage(chatId, "✅ <b>আপনার কাজের প্রুফ জমা হয়েছে!</b>\nএডমিন চেক করে এপ্রুভ করলে কয়েন যোগ হবে।", getUserMenu(fromId));
            return;
        }

        // =========================================================================
        // টাস্ক তৈরি ফ্লো (বায়ার: Bot Refer / Poll Vote)
        // =========================================================================
        if (uState?.action === 'create_task_link' && text) {
            cache.userStates.set(fromId, { ...uState, action: 'create_task_rules', link: text.trim() });
            sendMessage(chatId, "📝 <b>কাজের নিয়মাবলী বা ইনস্ট্রাকশন লিখে পাঠান:</b>\n<i>(যেমন: বটে স্টার্ট দিয়ে ফোন নাম্বার দিন / ৩ নম্বর অপশনে ভোট দিন)</i>", getCancelKeyboard());
            return;
        }

        if (uState?.action === 'create_task_rules' && text) {
            cache.userStates.set(fromId, { ...uState, action: 'create_task_qty', rules: text.trim() });
            sendMessage(chatId, "🎯 <b>কতটি রেফার বা ভোট নিতে চান? সংখ্যা লিখুন:</b>", getCancelKeyboard());
            return;
        }

        if (uState?.action === 'create_task_qty' && text) {
            if (!isNumericAmount(text)) {
                sendMessage(chatId, "❌ সঠিক সংখ্যা লিখুন:", getCancelKeyboard());
                return;
            }

            const qty = parseInt(text);
            const costPerTask = Number(getSetting('cost_per_task', 3));
            const workerReward = Number(getSetting('worker_reward', 2));
            const totalCost = qty * costPerTask;

            const u = await getUser(fromId);
            if (Number(u?.balance || 0) < totalCost) {
                cache.userStates.delete(fromId);
                sendMessage(chatId, `⚠️ <b>অপর্যাপ্ত ব্যালেন্স!</b>\nমোট প্রয়োজন: <b>${totalCost} Coins</b>\nআপনার ব্যালেন্স: <b>${u?.balance || 0} Coins</b>\nদয়া করে ডিপোজিট করুন।`, getUserMenu(fromId));
                return;
            }

            // ব্যালেন্স কাটা
            updateUser(fromId, { balance: Number(u.balance) - totalCost });

            const taskId = `TSK${Math.floor(1000 + Math.random() * 9000)}`;
            const taskObj = {
                task_id: taskId,
                creator_id: fromId,
                type: uState.taskType,
                link: uState.link,
                instructions: uState.rules,
                total_needed: qty,
                completed_count: 0,
                cost_per_task: costPerTask,
                reward_per_worker: workerReward,
                status: 'active',
                created_at: Math.floor(Date.now() / 1000)
            };

            cache.tasks.set(taskId, taskObj);
            firebaseRequest(`tasks/${taskId}`, 'PUT', taskObj).catch(() => {});
            cache.userStates.delete(fromId);

            sendMessage(chatId,
                `🎉 <b>টাস্ক সফলভাবে তৈরি হয়েছে!</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
                `🆔 টাস্ক আইডি: <code>${taskId}</code>\n` +
                `🎯 টার্গেট: <b>${qty} টি</b>\n` +
                `💰 খরচ হয়েছে: <b>${totalCost} Coins</b>\n\n` +
                `টাস্কটি এখন 'আর্ন কয়েন' লিস্টে লাইভ রয়েছে। 'আমার কাজ' থেকে প্রগ্রেস দেখতে পারবেন।`,
                getUserMenu(fromId)
            );
            return;
        }

        // =========================================================================
        // অ্যাডমিন স্টেটস (প্যাকেজ অ্যাড ও সেটিংস - ধাপে ধাপে)
        // =========================================================================
        if (isAdm) {
            const aState = cache.adminStates.get(fromId);

            // প্যাকেজ অ্যাড: ধাপ ১ -> টাকা রিসিভ
            if (aState?.action === 'pkg_add_taka' && text) {
                if (!isNumericAmount(text)) {
                    sendMessage(chatId, "❌ সঠিক টাকার পরিমাণ (সংখ্যা) লিখুন:", getCancelKeyboard());
                    return;
                }
                cache.adminStates.set(fromId, { action: 'pkg_add_coins', taka: Number(text) });
                sendMessage(chatId, `💰 <b>${text} টাকায় কত কয়েন দিতে চান? কয়েনের সংখ্যা লিখুন:</b>`, getCancelKeyboard());
                return;
            }

            // প্যাকেজ অ্যাড: ধাপ ২ -> কয়েন রিসিভ ও সেভ
            if (aState?.action === 'pkg_add_coins' && text) {
                if (!isNumericAmount(text)) {
                    sendMessage(chatId, "❌ সঠিক কয়েনের পরিমাণ (সংখ্যা) লিখুন:", getCancelKeyboard());
                    return;
                }
                const coins = Number(text);
                const pkgId = `pkg_${Date.now()}`;
                const newPkg = { id: pkgId, taka: aState.taka, coins: coins };

                cache.packages.set(pkgId, newPkg);
                firebaseRequest(`packages/${pkgId}`, 'PUT', newPkg).catch(() => {});
                cache.adminStates.delete(fromId);

                sendMessage(chatId, `✅ <b>প্যাকেজ যুক্ত হয়েছে!</b>\n💵 <b>${newPkg.taka}৳ = ${newPkg.coins} Coins</b>`, getAdminMenu());
                return;
            }

            // সেন্ট্রাল সেটিংস ইনপুট
            if (aState?.action === 'cfg_dep_chan' && text) {
                setSetting('deposit_channel_id', text.trim());
                cache.adminStates.delete(fromId);
                sendMessage(chatId, `✅ <b>ডিপোজিট চ্যানেল সেট করা হয়েছে:</b> <code>${text.trim()}</code>`, getAdminMenu());
                return;
            }

            if (aState?.action === 'cfg_proof_chan' && text) {
                setSetting('task_proof_channel_id', text.trim());
                cache.adminStates.delete(fromId);
                sendMessage(chatId, `✅ <b>টাস্ক প্রুফ চ্যানেল সেট করা হয়েছে:</b> <code>${text.trim()}</code>`, getAdminMenu());
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
                if (!isNumericAmount(text)) {
                    sendMessage(chatId, "❌ সঠিক সংখ্যা দিন:", getCancelKeyboard());
                    return;
                }
                const amt = Number(text);
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
        }

        // =========================================================================
        // ইউজার মেনু কমান্ডসমূহ
        // =========================================================================
        if (text === '/start' || text.startsWith('/start')) {
            sendMessage(chatId,
                `👋 <b>স্বাগতম ${escapeHtml(msg.from.first_name || 'User')}!</b>\n\n` +
                `এখানে আপনি অন্য বটের জন্য রিয়েল রেফারেল ও পোল ভোট কিনতে পারবেন অথবা নিজে কাজ করে কয়েন আয় করতে পারবেন।\n` +
                `নিচের বাটনগুলো ব্যবহার করে শুরু করুন:`,
                getUserMenu(fromId)
            );
            return;
        }

        if (text === '💳 Deposit') {
            if (!cache.packages.size) {
                sendMessage(chatId, "⚠️ বর্তমানে কোনো ডিপোজিট প্যাকেজ উপলব্ধ নেই। দয়া করে কিছুক্ষণ পর চেষ্টা করুন।");
                return;
            }
            sendMessage(chatId,
                `💳 <b>কয়েন ডিপোজিট প্যাকেজ</b>\n━━━━━━━━━━━━━━━━━━━━\n` +
                `কয়েন কিনতে নিচের প্যাকেজগুলো থেকে আপনার পছন্দেরটি বেছে নিন:`,
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

        if (text === '💰 আর্ন কয়েন') {
            const activeTasks = Array.from(cache.tasks.values()).filter(t => t.status === 'active');
            if (!activeTasks.length) {
                sendMessage(chatId, "❌ বর্তমানে কোনো কাজ খালি নেই। নতুন কাজ আসা মাত্র নোটিফিকেশন পাবেন!");
                return;
            }

            const buttons = [];
            for (const t of activeTasks.slice(0, 10)) {
                const label = `${t.type === 'bot_refer' ? '📢 Refer' : '📦 Vote'} - টার্গেট: ${t.completed_count}/${t.total_needed} (+${t.reward_per_worker} Coin)`;
                buttons.push([{ text: label, callback_data: `do_task_${t.task_id}` }]);
            }

            sendMessage(chatId, "💰 <b>বর্তমানে উপলব্ধ কাজসমূহ:</b>\nক্লিক করে কাজটি সম্পন্ন করুন:", { inline_keyboard: buttons });
            return;
        }

        if (text === '📜 আমার কাজ') {
            sendMessage(chatId, "🔍 <i>আপনার টাস্ক লোড হচ্ছে...</i>");
            const all = await firebaseRequest('tasks');
            let out = `📜 <b>আপনার অর্ডার করা কাজের তালিকা</b>\n━━━━━━━━━━━━━━━━━━━━\n\n`;
            let has = false;

            if (all && typeof all === 'object') {
                for (const t of Object.values(all)) {
                    if (t && String(t.creator_id) === fromId) {
                        has = true;
                        const remaining = Math.max(0, Number(t.total_needed) - Number(t.completed_count || 0));
                        out += `📋 <b>টাস্ক আইডি:</b> <code>#${t.task_id}</code>\n` +
                            `📌 ধরন: ${t.type === 'bot_refer' ? '📢 Bot Refer' : '📦 Poll Vote'}\n` +
                            `🎯 টার্গেট: <b>${t.total_needed} টি</b>\n` +
                            `✅ পূরণ হয়েছে: <b>${t.completed_count || 0} টি</b>\n` +
                            `⏳ বাকি আছে: <b>${remaining} টি</b>\n` +
                            `📊 স্ট্যাটাস: <b>${t.status.toUpperCase()}</b>\n` +
                            `━━━━━━━━━━━━━━━━━━━━\n`;
                    }
                }
            }

            if (!has) out += "❌ আপনি এখনো কোনো অর্ডার করেননি।";
            sendMessage(chatId, out, getUserMenu(fromId));
            return;
        }

        if (text === '👤 প্রোফাইল') {
            const u = await getUser(fromId);
            const prof =
                `👤 <b>আপনার প্রোফাইল</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
                `🆔 <b>ID:</b> <code>${fromId}</code>\n` +
                `👤 <b>নাম:</b> ${escapeHtml(msg.from.first_name || 'User')}\n` +
                `🔗 <b>Username:</b> ${msg.from.username ? `@${msg.from.username}` : 'N/A'}\n\n` +
                `💰 <b>Balance:</b> <b>${formatNumber(u?.balance || 0)} Coins</b>\n` +
                `👥 <b>Total Referrals:</b> ${u?.total_referrals || 0} জন`;
            sendMessage(chatId, prof, getUserMenu(fromId));
            return;
        }

        if (text === '🎯 Refer & Earn') {
            const link = `https://t.me/${BOT_USERNAME}?start=${fromId}`;
            const bonus = getSetting('referral_bonus', 2);
            const refText =
                `🎯 <b>Refer & Earn</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
                `আপনার রেফারেল লিংক ব্যবহার করে বন্ধুদের জয়েন করিয়ে ফ্রি কয়েন আর্ন করুন!\n\n` +
                `🎁 <b>১ রেফার = ${bonus} Coins</b>\n\n` +
                `🔗 <b>আপনার রেফারেল লিংক:</b>\n<code>${link}</code>`;
            sendMessage(chatId, refText, getUserMenu(fromId));
            return;
        }

        if (text === '💬 Support') {
            sendMessage(chatId, `💬 <b>সাপোর্ট সেন্টার</b>\n\nযেকোনো সমস্যায় আমাদের সাপোর্ট এডমিনের সাথে যোগাযোগ করুন:\n👉 ${DEFAULT_SUPPORT_URL}`);
            return;
        }

        // =========================================================================
        // অ্যাডমিন মেনু বাটন
        // =========================================================================
        if (text === '🛠 Admin Panel' && isAdm) {
            sendMessage(chatId, "🛠 <b>এডমিন প্যানেল চালু হয়েছে</b>", getAdminMenu());
            return;
        }

        if (text === '➕ প্যাকেজ যোগ করুন' && isAdm) {
            cache.adminStates.set(fromId, { action: 'pkg_add_taka' });
            sendMessage(chatId, "➕ <b>নতুন প্যাকেজ তৈরি</b>\n\nপ্রথমে টাকার পরিমাণ (BDT) লিখুন:\n<i>(যেমন: 20)</i>", getCancelKeyboard());
            return;
        }

        if (text === '📋 প্যাকেজ তালিকা' && isAdm) {
            let list = "📋 <b>বর্তমান ডিপোজিট প্যাকেজসমূহ:</b>\n━━━━━━━━━━━━━━━━━━━━\n";
            if (!cache.packages.size) list += "কোনো প্যাকেজ নেই।";
            else {
                for (const [, p] of cache.packages) {
                    list += `• <b>${p.taka} BDT = ${p.coins} Coins</b> (ID: <code>${p.id}</code>)\n`;
                }
            }
            sendMessage(chatId, list, getAdminMenu());
            return;
        }

        if (text === '⚙️ সেন্ট্রাল সেটিংস' && isAdm) {
            const kb = {
                inline_keyboard: [
                    [{ text: '💳 ডিপোজিট চ্যানেল সেট', callback_data: 'admin_set_dep_chan' }],
                    [{ text: '📸 টাস্ক প্রুফ চ্যানেল সেট', callback_data: 'admin_set_proof_chan' }]
                ]
            };
            sendMessage(chatId, "⚙️ <b>সেন্ট্রাল সেটিংস:</b>", kb);
            return;
        }

        if (text === '👥 ব্যালেন্স কন্ট্রোল' && isAdm) {
            cache.adminStates.set(fromId, { action: 'balance_add_uid' });
            sendMessage(chatId, "👥 <b>ব্যালেন্স যোগ করুন</b>\n\nইউজারের Telegram ID পাঠান:", getCancelKeyboard());
            return;
        }

        if (text === '🔙 Back to User Panel') {
            sendMessage(chatId, "👤 <b>ইউজার প্যানেল</b>", getUserMenu(fromId));
            return;
        }
    }
}

/*
|--------------------------------------------------------------------------
| ১০. ক্যাশ প্রি-ওয়ার্মিং (স্টার্টআপেই ডাটা লোড)
|--------------------------------------------------------------------------
*/
async function preloadEngine() {
    console.log(`⚡ Pre-warming Cache for ${BOT_NAME}...`);
    try {
        const [settings, pkgs, trxList, tasksList] = await Promise.all([
            firebaseRequest('settings'),
            firebaseRequest('packages'),
            firebaseRequest('used_trxids'),
            firebaseRequest('tasks')
        ]);

        if (settings && typeof settings === 'object') {
            for (const [k, v] of Object.entries(settings)) cache.settings.set(k, v);
        }

        if (pkgs && typeof pkgs === 'object') {
            for (const [k, v] of Object.entries(pkgs)) cache.packages.set(k, v);
        } else {
            // ইনিশিয়াল ডিফল্ট প্যাকেজ
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

        console.log(`✅ System connected & Ready! Number: ${PAYMENT_NUMBER}`);
    } catch (e) {
        console.error('Preload Error:', e.message);
    }
}

/*
|--------------------------------------------------------------------------
| ১১. এক্সপ্রেস সার্ভার ও রেন্ডার কিপ-এলাইভ পিং
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
