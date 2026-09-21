"use strict";
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
exports.packageRoot = packageRoot;
exports.getPackageDataDir = getPackageDataDir;
exports.getDataDir = getDataDir;
exports.getCacheDir = getCacheDir;
exports.getJobsDir = getJobsDir;
exports.getDownloadsDir = getDownloadsDir;
exports.getConfigPath = getConfigPath;
exports.getSessionsDir = getSessionsDir;
exports.getLibraryDir = getLibraryDir;
exports.getLibraryDbPath = getLibraryDbPath;
exports.getLibraryOriginalsDir = getLibraryOriginalsDir;
exports.getLibraryPreviewsDir = getLibraryPreviewsDir;
exports.getModelsDir = getModelsDir;
exports.ensureDir = ensureDir;
var node_fs_1 = require("node:fs");
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var node_url_1 = require("node:url");
function expandHome(p) {
    return p.startsWith("~") ? node_path_1.default.join(node_os_1.default.homedir(), p.slice(1)) : p;
}
/**
 * Finds the root directory of the nullume package by walking up the tree
 * looking for package.json with name "nullume"
 */
function packageRoot() {
    var dir = node_path_1.default.dirname((0, node_url_1.fileURLToPath)(import.meta.url));
    while (dir !== node_path_1.default.dirname(dir)) {
        var pkgPath = node_path_1.default.join(dir, "package.json");
        if (node_fs_1.default.existsSync(pkgPath)) {
            try {
                var pkg = JSON.parse(node_fs_1.default.readFileSync(pkgPath, "utf-8"));
                if (pkg.name === "nullume") {
                    return dir;
                }
            }
            catch (_a) {
                // continue searching
            }
        }
        dir = node_path_1.default.dirname(dir);
    }
    // Fallback to two levels up from this file (src/core/paths.ts -> ../../)
    return node_path_1.default.join(node_path_1.default.dirname((0, node_url_1.fileURLToPath)(import.meta.url)), "../..");
}
/**
 * Get the data directory path within the package
 */
function getPackageDataDir() {
    return node_path_1.default.join(packageRoot(), "data");
}
function getDataDir() {
    var home = process.env.NULLUME_HOME ? expandHome(process.env.NULLUME_HOME) : node_path_1.default.join(node_os_1.default.homedir(), ".nullume");
    return home;
}
function getCacheDir() {
    return node_path_1.default.join(getDataDir(), "cache");
}
function getJobsDir() {
    return node_path_1.default.join(getDataDir(), "jobs");
}
function getDownloadsDir() {
    return node_path_1.default.join(getDataDir(), "downloads");
}
function getConfigPath() {
    return node_path_1.default.join(getDataDir(), "config.json");
}
function getSessionsDir() {
    return node_path_1.default.join(getDataDir(), "sessions");
}
/**
 * Получить путь к каталогу библиотеки вкуса (~/.nullume/library)
 */
function getLibraryDir() {
    return node_path_1.default.join(getDataDir(), "library");
}
/**
 * Получить путь к БД библиотеки (~/.nullume/library/library.db)
 */
function getLibraryDbPath() {
    return node_path_1.default.join(getLibraryDir(), "library.db");
}
/**
 * Получить путь к каталогу оригиналов референсов (~/.nullume/library/originals)
 */
function getLibraryOriginalsDir() {
    return node_path_1.default.join(getLibraryDir(), "originals");
}
/**
 * Получить путь к каталогу превью (~/.nullume/library/previews)
 */
function getLibraryPreviewsDir() {
    return node_path_1.default.join(getLibraryDir(), "previews");
}
/**
 * Получить путь к каталогу моделей embeddings (~/.nullume/models)
 */
function getModelsDir() {
    return node_path_1.default.join(getDataDir(), "models");
}
function ensureDir(dir) {
    return __awaiter(this, void 0, void 0, function () {
        var e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, node_fs_1.default.promises.mkdir(dir, { recursive: true, mode: 448 })];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    e_1 = _a.sent();
                    if ((e_1 === null || e_1 === void 0 ? void 0 : e_1.code) !== "EEXIST")
                        throw e_1;
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
