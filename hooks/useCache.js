const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// 使用json进行缓存
let root = process.cwd();

const cachePath = path.join(root, "../tinypng-cache.json");
let cache = [];

function loadCache() {
    try {
        const cacheData = fs.readFileSync(cachePath, 'utf8');
        return JSON.parse(cacheData);
    } catch (err) {
        return [];
    }
}

cache = loadCache();

function saveCache() {
    // 这里cache去重
    cache = Array.from(new Set(cache));
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), 'utf8');
}

function calculateMD5(filePath) {
    const buffer = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(buffer).digest('hex');
}

exports.calculateMD5 = calculateMD5;
exports.cache = cache;
exports.saveCache = saveCache;
