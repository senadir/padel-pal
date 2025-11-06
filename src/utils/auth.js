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
exports.logout = exports.linkPlaytomicProfile = exports.verifyOtp = exports.signInWithPhone = exports.fetchUser = void 0;
exports.getLoginRedirectPath = getLoginRedirectPath;
var supabase_1 = require("./supabase");
var react_start_1 = require("@tanstack/react-start");
exports.fetchUser = (0, react_start_1.createServerFn)({ method: 'GET' }).handler(function () { return __awaiter(void 0, void 0, void 0, function () {
    var supabase, data, isPhoneVerified, userPhone, player, _a, newPlayer, upsertError, updatedPlayer, userRoles, role;
    var _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                supabase = (0, supabase_1.getSupabaseServerClient)();
                return [4 /*yield*/, supabase.auth.getUser()];
            case 1:
                data = (_e.sent()).data;
                if (!((_b = data.user) === null || _b === void 0 ? void 0 : _b.id)) {
                    return [2 /*return*/, null];
                }
                isPhoneVerified = !!data.user.phone_confirmed_at;
                userPhone = data.user.phone
                    ? data.user.phone.startsWith('+')
                        ? data.user.phone
                        : "+".concat(data.user.phone)
                    : null;
                return [4 /*yield*/, supabase
                        .from('players')
                        .select('*')
                        .eq('id', data.user.id)
                        .single()
                    // If player doesn't exist, create one
                ];
            case 2:
                player = (_e.sent()).data;
                if (!(!player && userPhone)) return [3 /*break*/, 4];
                return [4 /*yield*/, supabase
                        .from('players')
                        .insert({
                        id: data.user.id,
                        phone: userPhone,
                    })
                        .select()
                        .single()];
            case 3:
                _a = _e.sent(), newPlayer = _a.data, upsertError = _a.error;
                if (upsertError) {
                    console.error('Error creating player:', upsertError);
                }
                else {
                    player = newPlayer;
                }
                _e.label = 4;
            case 4:
                if (!(player && userPhone && player.phone !== userPhone)) return [3 /*break*/, 6];
                return [4 /*yield*/, supabase
                        .from('players')
                        .update({ phone: userPhone })
                        .eq('id', player.id)
                        .select()
                        .single()];
            case 5:
                updatedPlayer = (_e.sent()).data;
                if (updatedPlayer) {
                    player = updatedPlayer;
                }
                _e.label = 6;
            case 6: return [4 /*yield*/, supabase
                    .from('user_roles')
                    .select('role')
                    .eq('user_id', data.user.id)
                    .order('role', { ascending: true })
                // Get the highest privilege role (organizer > player)
            ]; // organizer comes before player alphabetically
            case 7:
                userRoles = (_e.sent()) // organizer comes before player alphabetically
                .data;
                role = ((_c = userRoles === null || userRoles === void 0 ? void 0 : userRoles.find(function (r) { return r.role === 'organizer'; })) === null || _c === void 0 ? void 0 : _c.role) || ((_d = userRoles === null || userRoles === void 0 ? void 0 : userRoles[0]) === null || _d === void 0 ? void 0 : _d.role) || 'player';
                return [2 /*return*/, {
                        user: data.user,
                        player: player,
                        isPhoneVerified: isPhoneVerified,
                        hasPlaytomicProfile: !!(player === null || player === void 0 ? void 0 : player.playtomic_id),
                        role: role,
                    }];
        }
    });
}); });
exports.signInWithPhone = (0, react_start_1.createServerFn)({ method: 'POST' })
    .inputValidator(function (d) { return d; })
    .handler(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var supabase, _c, response, error;
    var data = _b.data;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                supabase = (0, supabase_1.getSupabaseServerClient)();
                return [4 /*yield*/, supabase.auth.signInWithOtp({
                        phone: data.phone,
                        options: {
                            channel: 'whatsapp',
                            shouldCreateUser: true,
                        },
                    })];
            case 1:
                _c = _d.sent(), response = _c.data, error = _c.error;
                if (error) {
                    throw new Error(error.message);
                }
                // For OTP sign in, user will be null until they verify
                // Just check that we got a response (messageId indicates OTP was sent)
                if (!response) {
                    throw new Error('Failed to send OTP');
                }
                return [2 /*return*/, response];
        }
    });
}); });
exports.verifyOtp = (0, react_start_1.createServerFn)({ method: 'POST' })
    .inputValidator(function (d) { return d; })
    .handler(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var supabase, _c, response, error, phone, _d, player, playerError;
    var data = _b.data;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                supabase = (0, supabase_1.getSupabaseServerClient)();
                return [4 /*yield*/, supabase.auth.verifyOtp({
                        phone: data.phone,
                        token: data.token,
                        type: 'sms',
                    })];
            case 1:
                _c = _e.sent(), response = _c.data, error = _c.error;
                if (error) {
                    throw new Error(error.message);
                }
                if (!response.user) {
                    throw new Error('Failed to verify OTP');
                }
                phone = data.phone.startsWith('+') ? data.phone : "+".concat(data.phone);
                return [4 /*yield*/, supabase
                        .from('players')
                        .upsert({
                        id: response.user.id,
                        phone: phone,
                    }, {
                        onConflict: 'id', // Conflict on primary key (user ID)
                        ignoreDuplicates: false, // Update the record if it exists
                    })
                        .select()
                        .single()];
            case 2:
                _d = _e.sent(), player = _d.data, playerError = _d.error;
                if (playerError) {
                    console.error('Error upserting player in verifyOtp:', playerError);
                    throw new Error('Failed to create or update player profile');
                }
                return [2 /*return*/, player];
        }
    });
}); });
exports.linkPlaytomicProfile = (0, react_start_1.createServerFn)({ method: 'POST' })
    .inputValidator(function (d) { return d; })
    .handler(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var supabase, user, playtomicIdNumber, _c, player, error;
    var data = _b.data;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                supabase = (0, supabase_1.getSupabaseServerClient)();
                return [4 /*yield*/, supabase.auth.getUser()];
            case 1:
                user = (_d.sent()).data.user;
                if (!user) {
                    throw new Error('Not authenticated');
                }
                playtomicIdNumber = parseInt(data.playtomicId, 10);
                if (isNaN(playtomicIdNumber)) {
                    throw new Error('Invalid Playtomic ID');
                }
                return [4 /*yield*/, supabase
                        .from('players')
                        .update({
                        playtomic_id: playtomicIdNumber,
                        name: data.name,
                        avatar: data.avatar,
                    })
                        .eq('id', user.id)
                        .select()
                        .single()];
            case 2:
                _c = _d.sent(), player = _c.data, error = _c.error;
                if (error) {
                    console.error('Error linking Playtomic profile:', error);
                    throw new Error('Failed to link Playtomic profile');
                }
                return [2 /*return*/, player];
        }
    });
}); });
exports.logout = (0, react_start_1.createServerFn)({ method: 'POST' }).handler(function () { return __awaiter(void 0, void 0, void 0, function () {
    var supabase, error;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                supabase = (0, supabase_1.getSupabaseServerClient)();
                return [4 /*yield*/, supabase.auth.signOut()];
            case 1:
                error = (_a.sent()).error;
                if (error) {
                    throw new Error(error.message);
                }
                return [2 /*return*/, { success: true }];
        }
    });
}); });
// Utility function to determine redirect path based on user status
function getLoginRedirectPath(authData) {
    if (!authData) {
        return null; // User not logged in, stay on current login step
    }
    var isPhoneVerified = authData.isPhoneVerified, hasPlaytomicProfile = authData.hasPlaytomicProfile;
    // If user is fully set up, redirect to home
    if (isPhoneVerified && hasPlaytomicProfile) {
        return '/';
    }
    // If user is logged in but not verified, go to OTP
    if (!isPhoneVerified) {
        return '/login/otp';
    }
    // If user is verified but no Playtomic profile, go to Playtomic
    if (isPhoneVerified && !hasPlaytomicProfile) {
        return '/login/playtomic';
    }
    return null;
}
