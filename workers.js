// ============================================
// Stalker-Portal To M3U Generator Script v3.0
// Created by: @rkdyiptv 
// Telegram: https://t.me/rkdyiptv
// ============================================

// ============ CONFIGURATION ============
const config = {
    host: 'portal.airtel4k.co', // Replace with your Stalker-Portal host
    mac_address: '00:1A:79:00:2D:6A',
    serial_number: '7D051746180ABD8E70AA3C6E23ADBC8D',
    device_id: 'FC21220582688F2AA17265FAC3C00AD4C8467372CB70D79278F6CAD53AFDB7D7',
    device_id_2: 'FC21220582688F2AA17265FAC3C00AD4C8467372CB70D79278F6CAD53AFDB7D7',
    stb_type: 'MAG250',
    api_signature: '263',
};

// ============ TOKEN CONFIGURATION ============
const STATIC_KEY = typeof STATIC_KEY !== 'undefined' ? STATIC_KEY : 'join-tg-rkdyiptv'; // Static key (required)
const TOKEN_REQUIRED = typeof REQUIRE_TOKEN !== 'undefined' ? REQUIRE_TOKEN === 'true' : true;
const TELEGRAM_CHANNEL = '@RKDYIPTV';
const TELEGRAM_URL = 'https://t.me/RKDYIPTV';

// Dynamic token settings
const DYNAMIC_TOKEN_ENABLED = true;
const DYNAMIC_TOKEN_EXPIRY = 1800; // 30 minutes in seconds
const DYNAMIC_TOKEN_LENGTH = 32; // Length of random token

// ============ DYNAMIC TOKEN MANAGER ============
class DynamicTokenManager {
    constructor() {
        this.tokens = new Map();
        this.cleanupInterval = 60000; // Cleanup every 1 minute
        this.startCleanup();
    }
    
    generateToken() {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let token = '';
        const array = new Uint8Array(DYNAMIC_TOKEN_LENGTH);
        crypto.getRandomValues(array);
        
        for (let i = 0; i < DYNAMIC_TOKEN_LENGTH; i++) {
            token += chars[array[i] % chars.length];
        }
        
        return token;
    }
    
    createToken() {
        const token = this.generateToken();
        const expiry = Date.now() + (DYNAMIC_TOKEN_EXPIRY * 1000);
        
        this.tokens.set(token, {
            created: Date.now(),
            expiry: expiry,
            expiryDate: new Date(expiry).toISOString()
        });
        
        logDebug(`🔑 New dynamic token created: ${token.substring(0, 8)}... (expires in ${DYNAMIC_TOKEN_EXPIRY / 60} mins)`);
        return token;
    }
    
    validateToken(token) {
        const tokenData = this.tokens.get(token);
        
        if (!tokenData) {
            logDebug(`❌ Token not found: ${token ? token.substring(0, 8) + '...' : 'null'}`);
            return false;
        }
        
        if (Date.now() > tokenData.expiry) {
            logDebug(`❌ Token expired: ${token.substring(0, 8)}...`);
            this.tokens.delete(token);
            return false;
        }
        
        logDebug(`✅ Dynamic token validated: ${token.substring(0, 8)}...`);
        return true;
    }
    
    cleanup() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [token, data] of this.tokens.entries()) {
            if (now > data.expiry) {
                this.tokens.delete(token);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            logDebug(`🧹 Cleaned up ${cleaned} expired tokens`);
        }
    }
    
    startCleanup() {
        if (typeof setInterval !== 'undefined') {
            setInterval(() => this.cleanup(), this.cleanupInterval);
        }
    }
    
    getActiveTokensCount() {
        return this.tokens.size;
    }
    
    getAllTokens() {
        const tokens = [];
        for (const [token, data] of this.tokens.entries()) {
            tokens.push({
                token: token.substring(0, 8) + '...',
                created: new Date(data.created).toISOString(),
                expiry: data.expiryDate,
                remainingSeconds: Math.max(0, Math.floor((data.expiry - Date.now()) / 1000))
            });
        }
        return tokens;
    }
}

const tokenManager = new DynamicTokenManager();

// ============ CACHING SYSTEM ============
class SimpleCache {
    constructor() {
        this.data = new Map();
    }
    
    get(key) {
        const item = this.data.get(key);
        if (!item) return null;
        
        if (Date.now() > item.expiry) {
            this.data.delete(key);
            return null;
        }
        
        logDebug(`✅ Cache HIT: ${key}`);
        return item.value;
    }
    
    set(key, value, ttlSeconds) {
        const expiry = Date.now() + (ttlSeconds * 1000);
        this.data.set(key, { value, expiry });
        logDebug(`💾 Cache SET: ${key} (TTL: ${ttlSeconds}s)`);
    }
    
    delete(key) {
        this.data.delete(key);
    }
    
    clear() {
        this.data.clear();
    }
}

const cache = new SimpleCache();

// Cache TTL settings
const CACHE_TTL = {
    TOKEN: 3600,
    CHANNELS: 1800,
    GENRES: 3600,
    PROFILE: 7200,
};

// ============ RATE LIMITING ============
class RateLimiter {
    constructor(maxRequests = 100, windowMs = 60000) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
        this.requests = new Map();
    }
    
    isAllowed(identifier) {
        const now = Date.now();
        const userRequests = this.requests.get(identifier) || [];
        
        const validRequests = userRequests.filter(time => now - time < this.windowMs);
        
        if (validRequests.length >= this.maxRequests) {
            logDebug(`🚫 Rate limit exceeded for: ${identifier}`);
            return false;
        }
        
        validRequests.push(now);
        this.requests.set(identifier, validRequests);
        
        return true;
    }
}

const rateLimiter = new RateLimiter(100, 60000);

// ============ AUTO-GENERATE HARDWARE VERSIONS ============
async function generateHardwareVersions() {
    config.hw_version = '1.7-BD-' + (await hash(config.mac_address)).substring(0, 2).toUpperCase();
    config.hw_version_2 = await hash(config.serial_number.toLowerCase() + config.mac_address.toLowerCase());
}

async function hash(str) {
    const data = new TextEncoder().encode(str);
    const digest = await crypto.subtle.digest('MD5', data);
    return Array.from(new Uint8Array(digest)).map(x => x.toString(16).padStart(2, '0')).join('');
}

function logDebug(message) {
    console.log(`${new Date().toISOString()} - ${message}`);
}

// ============ DUAL TOKEN VALIDATION (KEY + TOKEN) ============
async function validateAccess(request) {
    if (!TOKEN_REQUIRED) {
        logDebug('🔓 Token validation disabled');
        return { valid: true, key: '', token: '' };
    }
    
    const url = new URL(request.url);
    const key = url.searchParams.get('key');
    const token = url.searchParams.get('token');
    
    // Check static key
    if (!key || key !== STATIC_KEY) {
        logDebug(`❌ Invalid or missing key. Received: ${key || 'none'}`);
        return { valid: false, error: 'invalid_key', key, token };
    }
    
    logDebug(`✅ Static key validated`);
    
    // Check dynamic token
    if (!DYNAMIC_TOKEN_ENABLED) {
        return { valid: true, key, token };
    }
    
    if (!token) {
        logDebug('❌ No dynamic token provided');
        return { valid: false, error: 'missing_token', key, token };
    }
    
    if (!tokenManager.validateToken(token)) {
        return { valid: false, error: 'invalid_token', key, token };
    }
    
    logDebug('✅ Full access validated (key + token)');
    return { valid: true, key, token };
}

// ============ API HEADERS ============
function getHeaders(token = '') {
    const headers = {
        'Cookie': `mac=${config.mac_address}; stb_lang=en; timezone=GMT`,
        'Referer': `http://${config.host}/stalker_portal/c/`,
        'User-Agent': 'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
        'X-User-Agent': `Model: ${config.stb_type}; Link: WiFi`
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
}

// ============ RETRY LOGIC ============
async function fetchWithRetry(url, options, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);
            
            if (response.ok) {
                return response;
            }
            
            logDebug(`⚠️ Attempt ${attempt}/${maxRetries} failed: ${response.status}`);
            
            if (response.status >= 400 && response.status < 500) {
                return response;
            }
            
        } catch (error) {
            logDebug(`⚠️ Attempt ${attempt}/${maxRetries} error: ${error.message}`);
            
            if (attempt === maxRetries) {
                throw error;
            }
        }
        
        if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt - 1) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw new Error('Max retries exceeded');
}

// ============ STALKER API FUNCTIONS ============
async function getToken() {
    const cacheKey = 'api_token';
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    
    const url = `http://${config.host}/stalker_portal/server/load.php?type=stb&action=handshake&token=&JsHttpRequest=1-xml`;
    try {
        logDebug(`🔑 Fetching API token`);
        const response = await fetchWithRetry(url, { headers: getHeaders() });
        
        if (!response.ok) {
            logDebug(`❌ getToken failed: ${response.status}`);
            return '';
        }
        
        const text = await response.text();
        const data = JSON.parse(text);
        const token = data.js?.token || '';
        
        if (token) {
            cache.set(cacheKey, token, CACHE_TTL.TOKEN);
            logDebug('✅ API token cached');
        }
        
        return token;
    } catch (e) {
        logDebug(`❌ Error in getToken: ${e.message}`);
        return '';
    }
}

async function auth(token) {
    const cacheKey = 'profile_data';
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    
    const metrics = {
        mac: config.mac_address,
        model: '',
        type: 'STB',
        uid: '',
        device: '',
        random: ''
    };
    const metricsEncoded = encodeURIComponent(JSON.stringify(metrics));

    const url = `http://${config.host}/stalker_portal/server/load.php?type=stb&action=get_profile`
        + `&hd=1&ver=ImageDescription:%200.2.18-r14-pub-250;`
        + `%20PORTAL%20version:%205.5.0;%20API%20Version:%20328;`
        + `&num_banks=2&sn=${config.serial_number}`
        + `&stb_type=${config.stb_type}&client_type=STB&image_version=218&video_out=hdmi`
        + `&device_id=${config.device_id}&device_id2=${config.device_id_2}`
        + `&signature=&auth_second_step=1&hw_version=${config.hw_version}`
        + `&not_valid_token=0&metrics=${metricsEncoded}`
        + `&hw_version_2=${config.hw_version_2}&api_signature=${config.api_signature}`
        + `&prehash=&JsHttpRequest=1-xml`;

    try {
        logDebug(`👤 Authenticating with portal`);
        const response = await fetchWithRetry(url, { headers: getHeaders(token) });
        
        if (!response.ok) {
            logDebug(`❌ auth failed: ${response.status}`);
            return [];
        }
        
        const text = await response.text();
        const data = JSON.parse(text);
        const profile = data.js || [];
        
        if (profile) {
            cache.set(cacheKey, profile, CACHE_TTL.PROFILE);
            logDebug('✅ Profile cached');
        }
        
        return profile;
    } catch (e) {
        logDebug(`❌ Error in auth: ${e.message}`);
        return [];
    }
}

async function handShake(token) {
    const url = `http://${config.host}/stalker_portal/server/load.php?type=stb&action=handshake&token=${token}&JsHttpRequest=1-xml`;
    try {
        logDebug(`🤝 Performing handshake`);
        const response = await fetchWithRetry(url, { headers: getHeaders() });
        
        if (!response.ok) {
            logDebug(`❌ handShake failed: ${response.status}`);
            return '';
        }
        
        const text = await response.text();
        const data = JSON.parse(text);
        const newToken = data.js?.token || '';
        
        logDebug(newToken ? '✅ Handshake successful' : '❌ No token in handshake');
        return newToken;
    } catch (e) {
        logDebug(`❌ Error in handShake: ${e.message}`);
        return '';
    }
}

async function getAccountInfo(token) {
    const cacheKey = 'account_info';
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    
    const url = `http://${config.host}/stalker_portal/server/load.php?type=account_info&action=get_main_info&JsHttpRequest=1-xml`;
    try {
        logDebug(`📊 Fetching account info`);
        const response = await fetchWithRetry(url, { headers: getHeaders(token) });
        
        if (!response.ok) {
            logDebug(`❌ getAccountInfo failed: ${response.status}`);
            return [];
        }
        
        const text = await response.text();
        const data = JSON.parse(text);
        const accountInfo = data.js || [];
        
        if (accountInfo) {
            cache.set(cacheKey, accountInfo, CACHE_TTL.PROFILE);
            logDebug('✅ Account info cached');
        }
        
        return accountInfo;
    } catch (e) {
        logDebug(`❌ Error in getAccountInfo: ${e.message}`);
        return [];
    }
}

async function getGenres(token) {
    const cacheKey = 'genres_data';
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    
    const url = `http://${config.host}/stalker_portal/server/load.php?type=itv&action=get_genres&JsHttpRequest=1-xml`;
    try {
        logDebug(`📋 Fetching genres`);
        const response = await fetchWithRetry(url, { headers: getHeaders(token) });
        
        if (!response.ok) {
            logDebug(`❌ getGenres failed: ${response.status}`);
            return [];
        }
        
        const text = await response.text();
        const data = JSON.parse(text);
        const genres = data.js || [];
        
        if (genres) {
            cache.set(cacheKey, genres, CACHE_TTL.GENRES);
            logDebug('✅ Genres cached');
        }
        
        return genres;
    } catch (e) {
        logDebug(`❌ Error in getGenres: ${e.message}`);
        return [];
    }
}

async function getStreamURL(id, token) {
    const url = `http://${config.host}/stalker_portal/server/load.php?type=itv&action=create_link&cmd=ffrt%20http://localhost/ch/${id}&JsHttpRequest=1-xml`;
    try {
        logDebug(`📺 Fetching stream URL for: ${id}`);
        const response = await fetchWithRetry(url, { headers: getHeaders(token) });
        
        if (!response.ok) {
            logDebug(`❌ getStreamURL failed: ${response.status}`);
            return '';
        }
        
        const text = await response.text();
        const data = JSON.parse(text);
        const stream = data.js?.cmd || '';
        
        logDebug(stream ? '✅ Stream URL received' : '❌ No stream URL');
        return stream;
    } catch (e) {
        logDebug(`❌ Error in getStreamURL: ${e.message}`);
        return '';
    }
}

async function genToken() {
    await generateHardwareVersions();
    
    const token = await getToken();
    if (!token) {
        logDebug('❌ Failed to retrieve initial token');
        return { token: '', profile: [], account_info: [] };
    }
    
    const profile = await auth(token);
    const newToken = await handShake(token);
    
    if (!newToken) {
        logDebug('❌ Failed to retrieve new token');
        return { token: '', profile, account_info: [] };
    }
    
    const account_info = await getAccountInfo(newToken);
    return { token: newToken, profile, account_info };
}

// ============ M3U GENERATION WITH DUAL TOKEN ============
async function convertJsonToM3U(channels, profile, account_info, request, userKey, userToken) {
    let m3u = [
        '#EXTM3U',
        `# Generated: ${new Date().toISOString()}`,
        `# Total Channels: ${channels.length}`,
        `# Script: ${TELEGRAM_CHANNEL}`,
        `# Telegram: ${TELEGRAM_URL}`,
        `# Authentication: Key + Token (Dual Layer)`,
        `# Static Key: ${userKey}`,
        `# Dynamic Token: ${userToken}`,
        `# Token Expiry: ${DYNAMIC_TOKEN_EXPIRY / 60} minutes`,
        ''
    ].filter(Boolean);

    const origin = new URL(request.url).origin;

    // Info channels
    const infoChannels = [
        {
            name: `📱 Telegram • ${TELEGRAM_CHANNEL}`,
            logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/1024px-Telegram_logo.svg.png',
            group: 'Portal | Info',
            url: TELEGRAM_URL
        },
        {
            name: `🔑 Static Key • ${userKey}`,
            logo: 'https://cdn-icons-png.flaticon.com/512/2889/2889676.png',
            group: 'Portal | Info',
            url: TELEGRAM_URL
        },
        {
            name: `⏱️ Token • Expires in ${DYNAMIC_TOKEN_EXPIRY / 60} mins`,
            logo: 'https://cdn-icons-png.flaticon.com/512/3652/3652191.png',
            group: 'Portal | Info',
            url: TELEGRAM_URL
        },
        {
            name: `🌐 Portal IP • ${profile.ip || 'Unknown'}`,
            logo: 'https://img.icons8.com/?size=160&id=OWj5Eo00EaDP&format=png',
            group: 'Portal | Info',
            url: TELEGRAM_URL
        },
        {
            name: `👤 User IP • ${request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'Unknown'}`,
            logo: 'https://uxwing.com/wp-content/themes/uxwing/download/location-travel-map/ip-location-color-icon.svg',
            group: 'Portal | Info',
            url: TELEGRAM_URL
        },
        {
            name: `🏠 Portal • ${config.host}`,
            logo: 'https://upload.wikimedia.org/wikipedia/commons/6/6f/IPTV.png',
            group: 'Portal | Info',
            url: TELEGRAM_URL
        },
        {
            name: `📅 Created • ${profile.created || 'Unknown'}`,
            logo: 'https://cdn-icons-png.flaticon.com/128/1048/1048953.png',
            group: 'Portal | Info',
            url: TELEGRAM_URL
        },
        {
            name: `⏰ Expire • ${account_info.end_date || 'Unknown'}`,
            logo: 'https://www.citypng.com/public/uploads/preview/hand-drawing-clipart-14-feb-calendar-icon-701751694973910ds70zl0u9u.png',
            group: 'Portal | Info',
            url: TELEGRAM_URL
        },
        {
            name: `💎 Plan • ${account_info.tariff_plan || 'Unknown'}`,
            logo: 'https://img.lovepik.com/element/45004/5139.png_300.png',
            group: 'Portal | Info',
            url: TELEGRAM_URL
        },
        {
            name: `👥 Max Connection • ${profile.storages ? Object.values(profile.storages)[0]?.max_online || 'Unknown' : 'Unknown'}`,
            logo: 'https://thumbs.dreamstime.com/b/people-vector-icon-group-symbol-illustration-businessman-logo-multiple-users-silhouette-153484048.jpg',
            group: 'Portal | Info',
            url: TELEGRAM_URL
        }
    ];

    infoChannels.forEach(channel => {
        m3u.push(`#EXTINF:-1 tvg-name="${channel.name}" tvg-logo="${channel.logo}" group-title="${channel.group}",${channel.name}`);
        m3u.push(channel.url);
    });

    // Live channels
    if (!channels.length) {
        logDebug('⚠️ No channels found');
    } else {
        logDebug(`📺 Processing ${channels.length} channels`);
        
        channels.forEach((channel, index) => {
            let cmd = channel.cmd || '';
            let real_cmd = cmd.replace('ffrt http://localhost/ch/', '');
            
            if (!real_cmd) {
                real_cmd = 'unknown';
            }
            
            const logo_url = channel.logo ? `http://${config.host}/stalker_portal/misc/logos/320/${channel.logo}` : '';
            const cleanName = (channel.name || 'Unknown').replace(/["\n\r]/g, '');
            
            m3u.push(`#EXTINF:-1 tvg-id="${channel.tvgid}" tvg-name="${cleanName}" tvg-logo="${logo_url}" group-title="${channel.title}",${cleanName}`);
            
            // Dual token URL format: key + token
            const channel_stream_url = `${origin}/${real_cmd}.m3u8?key=${userKey}&token=${userToken}`;
            
            m3u.push(channel_stream_url);
            
            if (index < 3) {
                logDebug(`📺 Channel #${index}: ${cleanName}`);
            }
        });
    }

    return m3u.join('\n');
}

// ============ TELEGRAM REDIRECT PAGE ============
function generateTelegramRedirectPage() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="refresh" content="3;url=${TELEGRAM_URL}">
    <title>Redirecting to Telegram</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            color: white;
        }
        .container {
            text-align: center;
            padding: 40px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
            border: 1px solid rgba(255, 255, 255, 0.18);
            max-width: 500px;
        }
        .telegram-icon {
            width: 100px;
            height: 100px;
            margin: 0 auto 30px;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }
        h1 {
            font-size: 32px;
            margin-bottom: 20px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }
        p {
            font-size: 18px;
            margin-bottom: 15px;
            opacity: 0.9;
        }
        .channel {
            font-size: 24px;
            font-weight: bold;
            background: rgba(255, 255, 255, 0.2);
            padding: 15px 30px;
            border-radius: 50px;
            display: inline-block;
            margin: 20px 0;
        }
        .btn {
            display: inline-block;
            padding: 15px 40px;
            background: #0088cc;
            color: white;
            text-decoration: none;
            border-radius: 50px;
            font-size: 18px;
            font-weight: bold;
            margin-top: 20px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0, 136, 204, 0.4);
        }
        .btn:hover {
            background: #006699;
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0, 136, 204, 0.6);
        }
        .spinner {
            border: 4px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top: 4px solid white;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 30px auto 0;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="telegram-icon">
            <svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:#2AABEE;stop-opacity:1" />
                        <stop offset="100%" style="stop-color:#229ED9;stop-opacity:1" />
                    </linearGradient>
                </defs>
                <circle cx="120" cy="120" r="120" fill="url(#gradient)"/>
                <path fill="#ffffff" d="M81.229 128.772l14.237 39.406s1.78 3.687 3.686 3.687 30.255-29.492 30.255-29.492l31.525-60.89L81.737 118.6z"/>
                <path fill="#d2e5f1" d="M100.106 138.878l-2.733 29.046s-1.144 8.9 7.754 0 17.415-15.763 17.415-15.763"/>
                <path fill="#b5cfe4" d="M81.486 130.178l-17.8-5.467s-2.006-.801-1.38-2.602c.138-.396.396-.771.99-1.174 4.866-3.293 96.787-36.666 96.787-36.666s1.794-.893 3.140-.84c.817.031 1.668.29 2.09 1.322.164.403.24.808.24 1.21l-.013.481v.046c-.013.303-.033.606-.053.909a28.89 28.89 0 0 1-.139 1.554c-.184 1.454-.515 3.564-.978 6.238a2141.917 2141.917 0 0 1-12.643 56.926c-.45 1.846-1.333 2.602-2.219 2.668a5.33 5.33 0 0 1-1.203-.105c-.908-.192-2.054-.65-3.186-1.107a503.063 503.063 0 0 1-5.467-2.272c-9.99-4.222-20.9-8.844-23.91-10.247-.394-.184-.79-.368-1.106-.514a2.658 2.658 0 0 1-.698-.396c-.658-.461-1.057-1.107-.553-1.874.132-.2.264-.382.396-.553 2.602-2.602 29.492-26.653 40.264-36.903.553-.527.105-1.265-.61-.738l-49.866 32.768c-.197.132-.395.263-.592.382a9.613 9.613 0 0 1-2.324 1.015c-.908.264-1.874.396-2.815.396h-.066c-1.322 0-2.617-.304-3.859-.817z"/>
            </svg>
        </div>
        <h1>🚀 Redirecting to Telegram</h1>
        <p>You will be redirected to our Telegram channel</p>
        <div class="channel">${TELEGRAM_CHANNEL}</div>
        <p>For support, updates & more!</p>
        <a href="${TELEGRAM_URL}" class="btn">Join Now</a>
        <div class="spinner"></div>
    </div>
    <script>
        setTimeout(() => {
            window.location.href = '${TELEGRAM_URL}';
        }, 3000);
    </script>
</body>
</html>
    `.trim();
}

// ============ MAIN REQUEST HANDLER ============
addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const lastPart = pathParts[pathParts.length - 1];
    
    const clientIP = request.headers.get('CF-Connecting-IP') || 
                     request.headers.get('X-Forwarded-For') || 
                     'unknown';

    try {
        // ============ TELEGRAM REDIRECT ============
        if (url.pathname === '/telegram' || url.pathname === '/tg') {
            return new Response(generateTelegramRedirectPage(), {
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
        }

        // ============ GENERATE NEW TOKEN ENDPOINT ============
        if (url.pathname === '/generate-token') {
            if (!DYNAMIC_TOKEN_ENABLED) {
                return new Response('Dynamic tokens are disabled', { status: 400 });
            }
            
            const newToken = tokenManager.createToken();
            const origin = url.origin;
            
            return new Response(JSON.stringify({
                success: true,
                static_key: STATIC_KEY,
                dynamic_token: newToken,
                expiry_seconds: DYNAMIC_TOKEN_EXPIRY,
                expiry_minutes: DYNAMIC_TOKEN_EXPIRY / 60,
                playlist_url: `${origin}/playlist.m3u8?key=${STATIC_KEY}&token=${newToken}`,
                example_stream_url: `${origin}/{channel_id}.m3u8?key=${STATIC_KEY}&token=${newToken}`,
                telegram: TELEGRAM_URL,
                usage: {
                    description: "Use both 'key' and 'token' parameters in all requests",
                    key: "Static key (never changes): " + STATIC_KEY,
                    token: "Dynamic token (expires in " + (DYNAMIC_TOKEN_EXPIRY / 60) + " minutes)"
                },
                message: `Token expires in ${DYNAMIC_TOKEN_EXPIRY / 60} minutes. After expiry, generate a new token.`
            }, null, 2), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // ============ HEALTH CHECK ============
        if (url.pathname === '/health' || url.pathname === '/') {
            const origin = url.origin;
            return new Response(JSON.stringify({
                status: 'OK',
                version: '3.0 (Dual Auth)',
                timestamp: new Date().toISOString(),
                telegram: TELEGRAM_URL,
                authentication: {
                    type: "Dual Layer",
                    static_key: STATIC_KEY,
                    dynamic_tokens_enabled: DYNAMIC_TOKEN_ENABLED,
                    token_expiry_minutes: DYNAMIC_TOKEN_EXPIRY / 60
                },
                active_tokens: tokenManager.getActiveTokensCount(),
                endpoints: {
                    generate_token: `${origin}/generate-token`,
                    playlist: `${origin}/playlist.m3u8?key=${STATIC_KEY}&token=<get-from-generate-token>`,
                    stream: `${origin}/{channel_id}.m3u8?key=${STATIC_KEY}&token=<your-token>`,
                    telegram: `${origin}/telegram`,
                    health: `${origin}/health`,
                    stats: `${origin}/stats`,
                    tokens: `${origin}/tokens`
                }
            }, null, 2), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // ============ STATS ============
        if (url.pathname === '/stats') {
            return new Response(JSON.stringify({
                cache_size: cache.data.size,
                rate_limiter_size: rateLimiter.requests.size,
                active_tokens: tokenManager.getActiveTokensCount(),
                telegram: TELEGRAM_URL,
                timestamp: new Date().toISOString()
            }, null, 2), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // ============ ACTIVE TOKENS LIST ============
        if (url.pathname === '/tokens') {
            return new Response(JSON.stringify({
                active_tokens: tokenManager.getActiveTokensCount(),
                tokens: tokenManager.getAllTokens(),
                telegram: TELEGRAM_URL,
                timestamp: new Date().toISOString()
            }, null, 2), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // ============ RATE LIMITING ============
        if (!rateLimiter.isAllowed(clientIP)) {
            return new Response(
                `⚠️ Rate limit exceeded\n\n` +
                `Please try again later.\n` +
                `Join our Telegram: ${TELEGRAM_CHANNEL}\n` +
                `${TELEGRAM_URL}`,
                { 
                    status: 429,
                    headers: {
                        'Content-Type': 'text/plain',
                        'Retry-After': '60'
                    }
                }
            );
        }

        // ============ PLAYLIST REQUEST ============
        if (url.pathname === '/playlist.m3u8') {
            const access = await validateAccess(request);
            
            if (!access.valid) {
                let errorMessage = '❌ Unauthorized Access\n\n';
                
                if (access.error === 'invalid_key') {
                    errorMessage += `Invalid or missing static key!\n\n`;
                    errorMessage += `Required format:\n`;
                    errorMessage += `?key=${STATIC_KEY}&token=<your-dynamic-token>\n\n`;
                } else if (access.error === 'missing_token') {
                    errorMessage += `Missing dynamic token!\n\n`;
                    errorMessage += `Get a new token from: ${url.origin}/generate-token\n\n`;
                } else if (access.error === 'invalid_token') {
                    errorMessage += `Invalid or expired dynamic token!\n\n`;
                    errorMessage += `Get a new token from: ${url.origin}/generate-token\n`;
                    errorMessage += `Tokens expire in ${DYNAMIC_TOKEN_EXPIRY / 60} minutes\n\n`;
                }
                
                errorMessage += `Join Telegram: ${TELEGRAM_CHANNEL}\n${TELEGRAM_URL}`;
                
                return new Response(errorMessage, { 
                    status: 401,
                    headers: { 'Content-Type': 'text/plain' }
                });
            }

            const cacheKey = `playlist_${access.token}`;
            const cachedPlaylist = cache.get(cacheKey);
            
            if (cachedPlaylist) {
                logDebug('✅ Returning cached playlist');
                return new Response(cachedPlaylist, {
                    headers: {
                        'Content-Type': 'application/vnd.apple.mpegurl',
                        'X-Cache': 'HIT'
                    }
                });
            }

            logDebug('🔄 Starting token generation');
            const { token, profile, account_info } = await genToken();
            
            if (!token) {
                logDebug('❌ Token generation failed');
                return new Response('Token generation failed', { status: 500 });
            }
            
            logDebug('✅ Token generation successful');

            const channelsUrl = `http://${config.host}/stalker_portal/server/load.php?type=itv&action=get_all_channels&JsHttpRequest=1-xml`;
            let channelsData;
            
            try {
                logDebug(`📡 Fetching channels from portal`);
                const response = await fetchWithRetry(channelsUrl, { headers: getHeaders(token) });
                
                if (!response.ok) {
                    logDebug(`❌ Failed to fetch channels: ${response.status}`);
                    return new Response(`Failed to fetch channels: ${response.status}`, { status: 500 });
                }
                
                const text = await response.text();
                channelsData = JSON.parse(text);
                
            } catch (e) {
                logDebug(`❌ Error fetching channels: ${e.message}`);
                return new Response(`Error fetching channels: ${e.message}`, { status: 500 });
            }

            logDebug('📋 Fetching genres');
            const genres = await getGenres(token);

            let channels = [];
            if (channelsData.js?.data) {
                logDebug(`✅ Found ${channelsData.js.data.length} channels`);
                channels = channelsData.js.data.map(item => ({
                    name: item.name || 'Unknown',
                    cmd: item.cmd || '',
                    tvgid: item.xmltv_id || '',
                    id: item.tv_genre_id || '',
                    logo: item.logo || ''
                }));
            } else {
                logDebug('⚠️ No channel data found');
            }

            const groupTitleMap = {};
            genres.forEach(group => {
                groupTitleMap[group.id] = group.title || 'Other';
            });

            channels = channels.map(channel => ({
                ...channel,
                title: groupTitleMap[channel.id] || 'Other'
            }));

            logDebug('📝 Generating M3U content');
            const m3uContent = await convertJsonToM3U(channels, profile, account_info, request, access.key, access.token);

            cache.set(cacheKey, m3uContent, CACHE_TTL.CHANNELS);

            logDebug('✅ Returning M3U response');
            return new Response(m3uContent, {
                headers: {
                    'Content-Type': 'application/vnd.apple.mpegurl',
                    'X-Cache': 'MISS'
                }
            });
        }

        // ============ STREAM REQUEST ============
        if (lastPart.endsWith('.m3u8') && lastPart !== 'playlist.m3u8') {
            const access = await validateAccess(request);
            
            if (!access.valid) {
                let errorMessage = '❌ Unauthorized Access\n\n';
                
                if (access.error === 'invalid_key') {
                    errorMessage += `Invalid or missing static key!\n\n`;
                    errorMessage += `Required: ?key=${STATIC_KEY}&token=<your-token>\n\n`;
                } else if (access.error === 'missing_token' || access.error === 'invalid_token') {
                    errorMessage += `Get a new token from: ${url.origin}/generate-token\n\n`;
                }
                
                errorMessage += `Join Telegram: ${TELEGRAM_CHANNEL}\n${TELEGRAM_URL}`;
                
                return new Response(errorMessage, { 
                    status: 401,
                    headers: { 'Content-Type': 'text/plain' }
                });
            }

            const id = lastPart.replace(/\.m3u8$/, '');
            
            if (!id) {
                logDebug('❌ Missing channel ID');
                return new Response('❌ Missing channel ID in URL', { status: 400 });
            }

            const streamCacheKey = `stream_${id}`;
            const cachedStream = cache.get(streamCacheKey);
            
            if (cachedStream) {
                logDebug(`✅ Returning cached stream for: ${id}`);
                return Response.redirect(cachedStream, 302);
            }

            logDebug(`🔄 Fetching stream for channel: ${id}`);
            const { token } = await genToken();
            
            if (!token) {
                logDebug('❌ Token generation failed');
                return new Response('Token generation failed', { status: 500 });
            }

            const stream = await getStreamURL(id, token);
            
            if (!stream) {
                logDebug('❌ No stream URL received');
                return new Response('No stream URL received', { status: 500 });
            }

            cache.set(streamCacheKey, stream, 300);

            logDebug(`✅ Redirecting to stream: ${id}`);
            return Response.redirect(stream, 302);
        }

        // ============ INVALID PATH - REDIRECT TO TELEGRAM ============
        logDebug(`❌ Invalid path: ${url.pathname}`);
        return Response.redirect(TELEGRAM_URL, 302);

    } catch (e) {
        logDebug(`❌ Unexpected error: ${e.message}`);
        return new Response(
            `Internal Server Error: ${e.message}\n\n` +
            `Join our Telegram for support: ${TELEGRAM_CHANNEL}\n${TELEGRAM_URL}`,
            { status: 500 }
        );
    }
}

// ========================================== { THE END } ================================================================================
