"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
exports.saveConfig = saveConfig;
exports.mergeConfig = mergeConfig;
exports.getApiKey = getApiKey;
exports.getImporterSetting = getImporterSetting;
var node_fs_1 = require("node:fs");
var errors_js_1 = require("./errors.js");
var paths_js_1 = require("./paths.js");
function loadConfig() {
    return __awaiter(this, void 0, void 0, function () {
        var configPath, content, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    configPath = (0, paths_js_1.getConfigPath)();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    if (!node_fs_1.default.existsSync(configPath))
                        return [2 /*return*/, {}];
                    return [4 /*yield*/, node_fs_1.default.promises.readFile(configPath, "utf-8")];
                case 2:
                    content = _a.sent();
                    return [2 /*return*/, JSON.parse(content)];
                case 3:
                    e_1 = _a.sent();
                    if ((e_1 === null || e_1 === void 0 ? void 0 : e_1.code) === "ENOENT")
                        return [2 /*return*/, {}];
                    throw new errors_js_1.ConfigError("\u041E\u0448\u0438\u0431\u043A\u0430 \u0447\u0442\u0435\u043D\u0438\u044F \u043A\u043E\u043D\u0444\u0438\u0433\u0430: ".concat(e_1.message));
                case 4: return [2 /*return*/];
            }
        });
    });
}
function saveConfig(config) {
    return __awaiter(this, void 0, void 0, function () {
        var configPath, tmpPath;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    configPath = (0, paths_js_1.getConfigPath)();
                    return [4 /*yield*/, (0, paths_js_1.ensureDir)((0, paths_js_1.getDataDir)())];
                case 1:
                    _a.sent();
                    tmpPath = configPath + ".tmp";
                    return [4 /*yield*/, node_fs_1.default.promises.writeFile(tmpPath, JSON.stringify(config, null, 2), {
                            encoding: "utf-8",
                            mode: 384,
                        })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, node_fs_1.default.promises.chmod(tmpPath, 384)];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, node_fs_1.default.promises.rename(tmpPath, configPath)];
                case 4:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function mergeConfig(updates) {
    return __awaiter(this, void 0, void 0, function () {
        var config, merged;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, loadConfig()];
                case 1:
                    config = _a.sent();
                    merged = __assign(__assign({}, config), updates);
                    return [4 /*yield*/, saveConfig(merged)];
                case 2:
                    _a.sent();
                    return [2 /*return*/, merged];
            }
        });
    });
}
function getApiKey() {
    return __awaiter(this, void 0, void 0, function () {
        var key, config;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    key = process.env.KIE_API_KEY;
                    if (key)
                        return [2 /*return*/, key];
                    return [4 /*yield*/, loadConfig()];
                case 1:
                    config = _a.sent();
                    if (config.apiKey)
                        return [2 /*return*/, config.apiKey];
                    throw new errors_js_1.ConfigError("API-ключ kie.ai не задан. Выполни `nullume setup --key YOUR_KEY` или установи переменную KIE_API_KEY.");
            }
        });
    });
}
/**
 * Получить значение из конфига импортёра с fallback на переменную окружения
 * @param config Конфиг nullume
 * @param importerId ID импортёра (например 'pexels')
 * @param key Название поля (например 'token')
 * @param envName Опциональное имя переменной окружения (по умолчанию NULLUME_<IMPORTER>_<KEY> в верхнем регистре)
 * @returns Значение из config/env или undefined
 */
function getImporterSetting(config, importerId, key, envName) {
    var _a, _b;
    // config.importers[importerId][key] первым приоритетом
    if ((_b = (_a = config.importers) === null || _a === void 0 ? void 0 : _a[importerId]) === null || _b === void 0 ? void 0 : _b[key]) {
        return config.importers[importerId][key];
    }
    // Затем env переменная
    var envKey = envName || "NULLUME_".concat(importerId.toUpperCase(), "_").concat(key.toUpperCase());
    return process.env[envKey];
}
