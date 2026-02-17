"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CryptoNewsService = void 0;
const axios_1 = __importDefault(require("axios"));
const AlertService_1 = require("./AlertService");
const RSS_FEEDS = [
    { url: 'https://cointelegraph.com/rss', source: 'CoinTelegraph' },
    { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', source: 'CoinDesk' },
    { url: 'https://decrypt.co/feed', source: 'Decrypt' },
];
// 15-minute poll interval
const POLL_INTERVAL_MS = 15 * 60 * 1000;
// Keep track of seen article URLs to avoid duplicate alerts
const seenArticles = new Set();
const latestNews = [];
let isFirstRun = true;
/**
 * Parse RSS XML and extract items using regex (lightweight, no dependency needed)
 */
function parseRSSItems(xml, source) {
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
        const block = match[1];
        const title = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/)?.[1] || block.match(/<title>(.*?)<\/title>/)?.[1] || '';
        const link = block.match(/<link>(.*?)<\/link>/)?.[1] || '';
        const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
        if (title && link) {
            items.push({
                title: title.trim(),
                link: link.trim(),
                pubDate: pubDate.trim(),
                source,
            });
        }
    }
    return items;
}
/**
 * Fetch and parse a single RSS feed
 */
async function fetchFeed(feedUrl, source) {
    try {
        const { data } = await axios_1.default.get(feedUrl, {
            timeout: 10000,
            headers: { 'User-Agent': 'Aibo/1.0' },
            responseType: 'text',
        });
        return parseRSSItems(data, source);
    }
    catch (err) {
        console.warn(`[News] Failed to fetch ${source}: ${err.message}`);
        return [];
    }
}
/**
 * Poll all feeds and create alerts for new articles
 */
async function pollNews() {
    const allItems = [];
    // Fetch all feeds in parallel
    const results = await Promise.allSettled(RSS_FEEDS.map(f => fetchFeed(f.url, f.source)));
    for (const result of results) {
        if (result.status === 'fulfilled') {
            allItems.push(...result.value);
        }
    }
    if (allItems.length === 0)
        return;
    // On first run, seed the seen set without creating alerts
    if (isFirstRun) {
        for (const item of allItems) {
            seenArticles.add(item.link);
        }
        isFirstRun = false;
        console.log(`[News] Seeded ${seenArticles.size} existing articles across ${RSS_FEEDS.length} feeds`);
        return;
    }
    // Create alerts for new articles (max 5 per poll to avoid spam)
    let newCount = 0;
    for (const item of allItems) {
        if (seenArticles.has(item.link))
            continue;
        seenArticles.add(item.link);
        newCount++;
        if (newCount > 5)
            break; // Cap at 5 new alerts per poll
        await AlertService_1.AlertService.createAlert('news', 'info', item.title, `via ${item.source}`, { link: item.link, source: item.source, pubDate: item.pubDate });
    }
    // Keep the most recent 10 items globally for the AI agent context
    latestNews.length = 0;
    latestNews.push(...allItems.slice(0, 10));
    if (newCount > 0) {
        console.log(`[News] Created ${Math.min(newCount, 5)} news alerts`);
    }
    // Cap seen set to prevent memory growth (keep last 500)
    if (seenArticles.size > 500) {
        const arr = Array.from(seenArticles);
        seenArticles.clear();
        for (const url of arr.slice(-300)) {
            seenArticles.add(url);
        }
    }
}
class CryptoNewsService {
    static interval = null;
    /**
     * Start polling RSS feeds for crypto news
     */
    static start() {
        console.log(`[News] Starting crypto news monitor (every ${POLL_INTERVAL_MS / 60000} minutes)`);
        // Delay initial poll by 30s to let other services initialize
        setTimeout(() => pollNews(), 30000);
        this.interval = setInterval(() => pollNews(), POLL_INTERVAL_MS);
    }
    static stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
    static getLatestNews() {
        return latestNews;
    }
}
exports.CryptoNewsService = CryptoNewsService;
