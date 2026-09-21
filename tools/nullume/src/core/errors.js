"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitError = exports.NetworkError = exports.TaskNotFound = exports.ProviderError = exports.ConfigError = exports.UsageError = exports.NullumeError = void 0;
var NullumeError = /** @class */ (function (_super) {
    __extends(NullumeError, _super);
    function NullumeError(message, exitCode) {
        if (exitCode === void 0) { exitCode = 1; }
        var _this = _super.call(this, message) || this;
        _this.exitCode = 1;
        _this.name = "NullumeError";
        _this.exitCode = exitCode;
        return _this;
    }
    return NullumeError;
}(Error));
exports.NullumeError = NullumeError;
var UsageError = /** @class */ (function (_super) {
    __extends(UsageError, _super);
    function UsageError(message) {
        var _this = _super.call(this, message, 2) || this;
        _this.name = "UsageError";
        return _this;
    }
    return UsageError;
}(NullumeError));
exports.UsageError = UsageError;
var ConfigError = /** @class */ (function (_super) {
    __extends(ConfigError, _super);
    function ConfigError(message) {
        var _this = _super.call(this, message, 1) || this;
        _this.name = "ConfigError";
        return _this;
    }
    return ConfigError;
}(NullumeError));
exports.ConfigError = ConfigError;
var ProviderError = /** @class */ (function (_super) {
    __extends(ProviderError, _super);
    function ProviderError(message, code) {
        var _this = _super.call(this, message, 1) || this;
        _this.name = "ProviderError";
        _this.code = code;
        return _this;
    }
    return ProviderError;
}(NullumeError));
exports.ProviderError = ProviderError;
var TaskNotFound = /** @class */ (function (_super) {
    __extends(TaskNotFound, _super);
    function TaskNotFound(message, code) {
        var _this = _super.call(this, "\u0417\u0430\u0434\u0430\u0447\u0430 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430: ".concat(message), code) || this;
        _this.name = "TaskNotFound";
        return _this;
    }
    return TaskNotFound;
}(ProviderError));
exports.TaskNotFound = TaskNotFound;
var NetworkError = /** @class */ (function (_super) {
    __extends(NetworkError, _super);
    function NetworkError(message) {
        var _this = _super.call(this, "\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u0435\u0442\u0438: ".concat(message), 1) || this;
        _this.name = "NetworkError";
        return _this;
    }
    return NetworkError;
}(NullumeError));
exports.NetworkError = NetworkError;
var RateLimitError = /** @class */ (function (_super) {
    __extends(RateLimitError, _super);
    function RateLimitError(message) {
        var _this = _super.call(this, "\u041F\u0440\u0435\u0432\u044B\u0448\u0435\u043D \u043B\u0438\u043C\u0438\u0442 \u0437\u0430\u043F\u0440\u043E\u0441\u043E\u0432: ".concat(message), 1) || this;
        _this.name = "RateLimitError";
        return _this;
    }
    return RateLimitError;
}(NullumeError));
exports.RateLimitError = RateLimitError;
