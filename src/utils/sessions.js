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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSession = exports.updateSessionStatus = exports.fetchSessionTemplates = exports.saveSessionTemplate = exports.createSession = exports.createSessionValidator = exports.useMatchActions = exports.useVoteForSession = exports.generateMatches = exports.unjoinMatch = exports.joinMatch = exports.unvoteForOption = exports.voteForOption = exports.matchQueryOptions = exports.sessionQueryOptions = exports.fetchMatches = exports.fetchSession = exports.sessionsQueryOptions = exports.fetchSessions = void 0;
var react_query_1 = require("@tanstack/react-query");
var react_router_1 = require("@tanstack/react-router");
var react_start_1 = require("@tanstack/react-start");
var zod_adapter_1 = require("@tanstack/zod-adapter");
var zod_1 = require("zod");
var sonner_1 = require("sonner");
var short_unique_id_1 = require("short-unique-id");
var date_fns_1 = require("date-fns");
var supabase_1 = require("./supabase");
var venues_1 = require("./venues");
exports.fetchSessions = (0, react_start_1.createServerFn)({ method: 'GET' }).handler(function () { return __awaiter(void 0, void 0, void 0, function () {
    var supabase, _a, sessionsData, error, sessionIds, _b, matchesData, matchesError, matchCountMap_1, sessions, err_1;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 3, , 4]);
                supabase = (0, supabase_1.getSupabaseServerClient)();
                return [4 /*yield*/, supabase
                        .from('sessions')
                        .select('*')
                        .order('date', { ascending: false })];
            case 1:
                _a = _c.sent(), sessionsData = _a.data, error = _a.error;
                if (error) {
                    console.error('Error fetching sessions:', error);
                    throw new Error("Failed to fetch sessions: ".concat(error.message));
                }
                if (!sessionsData || sessionsData.length === 0) {
                    return [2 /*return*/, []];
                }
                sessionIds = sessionsData.map(function (s) { return s.id; });
                return [4 /*yield*/, supabase
                        .from('matches')
                        .select('session_id, id')
                        .in('session_id', sessionIds)];
            case 2:
                _b = _c.sent(), matchesData = _b.data, matchesError = _b.error;
                if (matchesError) {
                    console.error('Error fetching matches:', matchesError);
                }
                matchCountMap_1 = new Map();
                matchesData === null || matchesData === void 0 ? void 0 : matchesData.forEach(function (match) {
                    var count = matchCountMap_1.get(match.session_id) || 0;
                    matchCountMap_1.set(match.session_id, count + 1);
                });
                sessions = sessionsData.map(function (sessionRow) {
                    var sessionDate = sessionRow.date
                        ? new Date(sessionRow.date)
                        : new Date();
                    var hasMatches = (matchCountMap_1.get(sessionRow.id) || 0) > 0;
                    return {
                        id: sessionRow.public_id,
                        venueName: sessionRow.venue_name || '',
                        venueLocation: sessionRow.venue_location || '',
                        date: sessionDate,
                        levels: sessionRow.levels || [],
                        hasMatches: hasMatches,
                        status: sessionRow.status,
                        votingClosesAt: sessionRow.voting_closes_at
                            ? new Date(sessionRow.voting_closes_at)
                            : null,
                    };
                });
                return [2 /*return*/, sessions];
            case 3:
                err_1 = _c.sent();
                console.error('Error in fetchSessions:', err_1);
                throw err_1;
            case 4: return [2 /*return*/];
        }
    });
}); });
var sessionsQueryOptions = function () {
    return (0, react_query_1.queryOptions)({
        queryKey: ['sessions'],
        queryFn: function () { return (0, exports.fetchSessions)(); },
    });
};
exports.sessionsQueryOptions = sessionsQueryOptions;
exports.fetchSession = (0, react_start_1.createServerFn)({ method: 'GET' })
    .inputValidator(function (d) { return d; })
    .handler(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var supabase, _c, sessionRow, error, _d, votesData_1, votesError, sessionDate, timeSlotsRaw, timeSlots, session, err_2;
    var data = _b.data;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _e.trys.push([0, 3, , 4]);
                supabase = (0, supabase_1.getSupabaseServerClient)();
                return [4 /*yield*/, supabase
                        .from('sessions')
                        .select('*')
                        .eq('public_id', data)
                        .single()];
            case 1:
                _c = _e.sent(), sessionRow = _c.data, error = _c.error;
                if (error) {
                    console.error('Supabase error:', error);
                    if (error.code === 'PGRST116') {
                        throw (0, react_router_1.notFound)();
                    }
                    throw new Error("Failed to fetch session: ".concat(error.message));
                }
                if (!sessionRow) {
                    throw (0, react_router_1.notFound)();
                }
                return [4 /*yield*/, supabase
                        .from('session_votes')
                        .select('*, players(*)')
                        .eq('session_id', sessionRow.id)];
            case 2:
                _d = _e.sent(), votesData_1 = _d.data, votesError = _d.error;
                if (votesError) {
                    console.error('Error fetching votes:', votesError);
                }
                sessionDate = sessionRow.date
                    ? new Date(sessionRow.date)
                    : new Date();
                timeSlotsRaw = sessionRow.time_slots
                    ? typeof sessionRow.time_slots === 'string'
                        ? JSON.parse(sessionRow.time_slots)
                        : sessionRow.time_slots
                    : [];
                timeSlots = timeSlotsRaw
                    .map(function (slot) { return ({
                    id: slot.id,
                    range: [new Date(slot.range[0]), new Date(slot.range[1])],
                    options: slot.options.map(function (option) {
                        // Find all votes for this option
                        var votesForOption = votesData_1 === null || votesData_1 === void 0 ? void 0 : votesData_1.filter(function (vote) { return vote.option_id === option.id; });
                        // Transform votes to players with votedAt timestamp
                        var players = (votesForOption === null || votesForOption === void 0 ? void 0 : votesForOption.map(function (vote) { return (__assign(__assign({}, vote.players), { votedAt: new Date(vote.voted_at) })); })) || [];
                        return {
                            id: option.id,
                            slot: {
                                id: slot.id,
                                range: [new Date(slot.range[0]), new Date(slot.range[1])],
                            },
                            level: option.level,
                            players: players,
                        };
                    }),
                }); })
                    .sort(function (a, b) {
                    // Sort time slots by start time
                    var aTime = new Date(a.range[0]).getTime();
                    var bTime = new Date(b.range[0]).getTime();
                    return aTime - bTime;
                });
                session = {
                    id: sessionRow.public_id,
                    venueName: sessionRow.venue_name || '',
                    venueLocation: sessionRow.venue_location || '',
                    date: sessionDate,
                    levels: (sessionRow.levels || []).map(function (level) { return ({
                        level: level,
                        timeSlots: [],
                    }); }),
                    timeSlots: timeSlots,
                    limitPlayers: sessionRow.limit_players || false,
                    playersPerSlot: sessionRow.players_per_slot || undefined,
                    status: sessionRow.status,
                };
                return [2 /*return*/, session];
            case 3:
                err_2 = _e.sent();
                console.error('Error fetching session:', err_2);
                if (err_2 instanceof Error && err_2.message.includes('404')) {
                    throw (0, react_router_1.notFound)();
                }
                throw err_2;
            case 4: return [2 /*return*/];
        }
    });
}); });
exports.fetchMatches = (0, react_start_1.createServerFn)({ method: 'GET' })
    .inputValidator(function (sessionId) { return sessionId; })
    .handler(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var supabase, _c, sessionRow, sessionError, _d, matchesData, matchesError, matches, err_3;
    var sessionPublicId = _b.data;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _e.trys.push([0, 3, , 4]);
                supabase = (0, supabase_1.getSupabaseServerClient)();
                return [4 /*yield*/, supabase
                        .from('sessions')
                        .select('id')
                        .eq('public_id', sessionPublicId)
                        .single()];
            case 1:
                _c = _e.sent(), sessionRow = _c.data, sessionError = _c.error;
                if (sessionError || !sessionRow) {
                    console.error('Session not found:', sessionError);
                    return [2 /*return*/, []];
                }
                return [4 /*yield*/, supabase
                        .from('matches')
                        .select("\n          *,\n          match_participants (\n            *,\n            players (*)\n          )\n        ")
                        .eq('session_id', sessionRow.id)
                        .order('start_time', { ascending: true })];
            case 2:
                _d = _e.sent(), matchesData = _d.data, matchesError = _d.error;
                if (matchesError) {
                    console.error('Error fetching matches:', matchesError);
                    return [2 /*return*/, []];
                }
                if (!matchesData || matchesData.length === 0) {
                    // No matches generated yet
                    return [2 /*return*/, []];
                }
                matches = matchesData.map(function (match) {
                    var participants = match.match_participants || [];
                    var players = participants.map(function (p) { return (__assign(__assign({}, p.players), { status: 'draft' })); });
                    return {
                        id: match.public_id,
                        sessionId: sessionPublicId,
                        slot: {
                            id: match.time_slot_id,
                            range: [new Date(match.start_time), new Date(match.end_time)],
                        },
                        level: match.level,
                        players: players,
                        playtomicMatch: null, // No Playtomic integration yet
                        status: 'draft', // Default status
                    };
                });
                return [2 /*return*/, matches];
            case 3:
                err_3 = _e.sent();
                console.error('Error in fetchMatches:', err_3);
                return [2 /*return*/, []];
            case 4: return [2 /*return*/];
        }
    });
}); });
var sessionQueryOptions = function (sessionId) {
    return (0, react_query_1.queryOptions)({
        queryKey: ['session', sessionId],
        queryFn: function () { return (0, exports.fetchSession)({ data: sessionId }); },
    });
};
exports.sessionQueryOptions = sessionQueryOptions;
var matchQueryOptions = function (sessionId) {
    return (0, react_query_1.queryOptions)({
        queryKey: ['matches', sessionId],
        queryFn: function () { return (0, exports.fetchMatches)({ data: sessionId }); },
    });
};
exports.matchQueryOptions = matchQueryOptions;
// Vote for an option (time slot + level combination)
exports.voteForOption = (0, react_start_1.createServerFn)({ method: 'POST' })
    .inputValidator((0, zod_adapter_1.zodValidator)(zod_1.z.object({
    sessionPublicId: zod_1.z.string(),
    optionId: zod_1.z.string(),
    playerId: zod_1.z.string(),
})))
    .handler(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var supabase, _c, sessionRow, sessionError, error;
    var data = _b.data;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                supabase = (0, supabase_1.getSupabaseServerClient)();
                return [4 /*yield*/, supabase
                        .from('sessions')
                        .select('id')
                        .eq('public_id', data.sessionPublicId)
                        .single()];
            case 1:
                _c = _d.sent(), sessionRow = _c.data, sessionError = _c.error;
                if (sessionError || !sessionRow) {
                    throw new Error('Session not found');
                }
                return [4 /*yield*/, supabase.from('session_votes').upsert({
                        player_id: data.playerId,
                        session_id: sessionRow.id,
                        option_id: data.optionId,
                    }, {
                        onConflict: 'player_id,session_id,option_id',
                    })];
            case 2:
                error = (_d.sent()).error;
                if (error) {
                    console.error('Error voting:', error);
                    throw new Error("Failed to vote: ".concat(error.message));
                }
                return [2 /*return*/, { success: true }];
        }
    });
}); });
// Remove vote for an option
exports.unvoteForOption = (0, react_start_1.createServerFn)({ method: 'POST' })
    .inputValidator((0, zod_adapter_1.zodValidator)(zod_1.z.object({
    sessionPublicId: zod_1.z.string(),
    optionId: zod_1.z.string(),
    playerId: zod_1.z.string(),
})))
    .handler(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var supabase, _c, sessionRow, sessionError, error;
    var data = _b.data;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                supabase = (0, supabase_1.getSupabaseServerClient)();
                return [4 /*yield*/, supabase
                        .from('sessions')
                        .select('id')
                        .eq('public_id', data.sessionPublicId)
                        .single()];
            case 1:
                _c = _d.sent(), sessionRow = _c.data, sessionError = _c.error;
                if (sessionError || !sessionRow) {
                    throw new Error('Session not found');
                }
                return [4 /*yield*/, supabase
                        .from('session_votes')
                        .delete()
                        .eq('player_id', data.playerId)
                        .eq('session_id', sessionRow.id)
                        .eq('option_id', data.optionId)];
            case 2:
                error = (_d.sent()).error;
                if (error) {
                    console.error('Error unvoting:', error);
                    throw new Error("Failed to remove vote: ".concat(error.message));
                }
                return [2 /*return*/, { success: true }];
        }
    });
}); });
// Join a match
exports.joinMatch = (0, react_start_1.createServerFn)({ method: 'POST' })
    .inputValidator((0, zod_adapter_1.zodValidator)(zod_1.z.object({
    matchPublicId: zod_1.z.string(),
    playerId: zod_1.z.string(),
    source: zod_1.z.enum(['vote', 'manual']).default('manual'),
})))
    .handler(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var supabase, _c, matchRow, matchError, _d, count, countError, error;
    var data = _b.data;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                supabase = (0, supabase_1.getSupabaseServerClient)();
                return [4 /*yield*/, supabase
                        .from('matches')
                        .select('id, max_players, start_time, end_time, session_id')
                        .eq('public_id', data.matchPublicId)
                        .single()];
            case 1:
                _c = _e.sent(), matchRow = _c.data, matchError = _c.error;
                if (matchError || !matchRow) {
                    throw new Error('Match not found');
                }
                return [4 /*yield*/, supabase
                        .from('match_participants')
                        .select('*', { count: 'exact', head: true })
                        .eq('match_id', matchRow.id)];
            case 2:
                _d = _e.sent(), count = _d.count, countError = _d.error;
                if (countError) {
                    throw new Error("Failed to check match capacity: ".concat(countError.message));
                }
                if (count !== null && count >= matchRow.max_players) {
                    throw new Error('Match is full');
                }
                return [4 /*yield*/, supabase.from('match_participants').insert({
                        match_id: matchRow.id,
                        player_id: data.playerId,
                        source: data.source,
                    })];
            case 3:
                error = (_e.sent()).error;
                if (error) {
                    console.error('Error joining match:', error);
                    // Check if it's a time overlap error from the trigger
                    if (error.message.includes('already in a match during this time slot')) {
                        throw new Error('You are already in a match during this time slot');
                    }
                    throw new Error("Failed to join match: ".concat(error.message));
                }
                return [2 /*return*/, { success: true }];
        }
    });
}); });
// Leave a match (unjoin)
exports.unjoinMatch = (0, react_start_1.createServerFn)({ method: 'POST' })
    .inputValidator((0, zod_adapter_1.zodValidator)(zod_1.z.object({
    matchPublicId: zod_1.z.string(),
    playerId: zod_1.z.string(),
})))
    .handler(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var supabase, _c, matchRow, matchError, error;
    var data = _b.data;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                supabase = (0, supabase_1.getSupabaseServerClient)();
                return [4 /*yield*/, supabase
                        .from('matches')
                        .select('id')
                        .eq('public_id', data.matchPublicId)
                        .single()];
            case 1:
                _c = _d.sent(), matchRow = _c.data, matchError = _c.error;
                if (matchError || !matchRow) {
                    throw new Error('Match not found');
                }
                return [4 /*yield*/, supabase
                        .from('match_participants')
                        .delete()
                        .eq('match_id', matchRow.id)
                        .eq('player_id', data.playerId)];
            case 2:
                error = (_d.sent()).error;
                if (error) {
                    console.error('Error leaving match:', error);
                    throw new Error("Failed to leave match: ".concat(error.message));
                }
                return [2 /*return*/, { success: true }];
        }
    });
}); });
// Helper function to generate matches from voting results
function generateMatchesHelper(sessionPublicId) {
    return __awaiter(this, void 0, void 0, function () {
        var supabase, uid, _a, sessionRow, sessionError, _b, votes, votesError, timeSlots, matchesToCreate, participantsToCreate, _i, timeSlots_1, timeSlot, _loop_1, _c, _d, option, _e, insertedMatches, matchesError, matchIdMap, participantsWithIds, participantsError;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    supabase = (0, supabase_1.getSupabaseServerClient)();
                    uid = new short_unique_id_1.default({ length: 8 });
                    return [4 /*yield*/, supabase
                            .from('sessions')
                            .select('*')
                            .eq('public_id', sessionPublicId)
                            .single()];
                case 1:
                    _a = _f.sent(), sessionRow = _a.data, sessionError = _a.error;
                    if (sessionError || !sessionRow) {
                        throw new Error('Session not found');
                    }
                    return [4 /*yield*/, supabase
                            .from('session_votes')
                            .select('*, players(*)')
                            .eq('session_id', sessionRow.id)];
                case 2:
                    _b = _f.sent(), votes = _b.data, votesError = _b.error;
                    if (votesError) {
                        throw new Error("Failed to fetch votes: ".concat(votesError.message));
                    }
                    timeSlots = typeof sessionRow.time_slots === 'string'
                        ? JSON.parse(sessionRow.time_slots)
                        : sessionRow.time_slots;
                    matchesToCreate = [];
                    participantsToCreate = [];
                    // Group votes by time slot and level
                    for (_i = 0, timeSlots_1 = timeSlots; _i < timeSlots_1.length; _i++) {
                        timeSlot = timeSlots_1[_i];
                        _loop_1 = function (option) {
                            var votersForOption = votes === null || votes === void 0 ? void 0 : votes.filter(function (vote) { return vote.option_id === option.id; });
                            if (!votersForOption || votersForOption.length === 0) {
                                // No votes for this option, create empty match slots
                                var matchId = uid.rnd();
                                matchesToCreate.push({
                                    session_id: sessionRow.id,
                                    public_id: matchId,
                                    time_slot_id: timeSlot.id,
                                    level: option.level,
                                    start_time: timeSlot.range[0],
                                    end_time: timeSlot.range[1],
                                    max_players: 4, // Matches always have 4 players
                                });
                            }
                            else {
                                // Create matches based on votes (always 4 players per match)
                                var playersPerMatch = 4;
                                var matchesNeeded = Math.ceil(votersForOption.length / playersPerMatch);
                                for (var i = 0; i < matchesNeeded; i++) {
                                    var matchId = uid.rnd();
                                    matchesToCreate.push({
                                        session_id: sessionRow.id,
                                        public_id: matchId,
                                        time_slot_id: timeSlot.id,
                                        level: option.level,
                                        start_time: timeSlot.range[0],
                                        end_time: timeSlot.range[1],
                                        max_players: playersPerMatch,
                                    });
                                    // Assign players to this match
                                    var playersForThisMatch = votersForOption.slice(i * playersPerMatch, (i + 1) * playersPerMatch);
                                    for (var _g = 0, playersForThisMatch_1 = playersForThisMatch; _g < playersForThisMatch_1.length; _g++) {
                                        var vote = playersForThisMatch_1[_g];
                                        participantsToCreate.push({
                                            match_public_id: matchId,
                                            player_id: vote.player_id,
                                            source: 'vote',
                                        });
                                    }
                                }
                                // If last match isn't full, it has open slots for manual joining
                            }
                        };
                        for (_c = 0, _d = timeSlot.options; _c < _d.length; _c++) {
                            option = _d[_c];
                            _loop_1(option);
                        }
                    }
                    return [4 /*yield*/, supabase
                            .from('matches')
                            .insert(matchesToCreate)
                            .select()];
                case 3:
                    _e = _f.sent(), insertedMatches = _e.data, matchesError = _e.error;
                    if (matchesError) {
                        console.error('Error creating matches:', matchesError);
                        throw new Error("Failed to create matches: ".concat(matchesError.message));
                    }
                    matchIdMap = new Map(insertedMatches.map(function (match) { return [match.public_id, match.id]; }));
                    participantsWithIds = participantsToCreate
                        .map(function (p) { return ({
                        match_id: matchIdMap.get(p.match_public_id),
                        player_id: p.player_id,
                        source: p.source,
                    }); })
                        .filter(function (p) { return p.match_id !== undefined; });
                    if (!(participantsWithIds.length > 0)) return [3 /*break*/, 5];
                    return [4 /*yield*/, supabase
                            .from('match_participants')
                            .insert(participantsWithIds)];
                case 4:
                    participantsError = (_f.sent()).error;
                    if (participantsError) {
                        console.error('Error creating participants:', participantsError);
                        throw new Error("Failed to add players to matches: ".concat(participantsError.message));
                    }
                    _f.label = 5;
                case 5: return [2 /*return*/, { success: true, matchesCreated: insertedMatches.length }];
            }
        });
    });
}
// Generate matches from voting results (hybrid approach)
exports.generateMatches = (0, react_start_1.createServerFn)({ method: 'POST' })
    .inputValidator((0, zod_adapter_1.zodValidator)(zod_1.z.object({ sessionPublicId: zod_1.z.string() })))
    .handler(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var supabase, uid, _c, sessionRow, sessionError, _d, votes, votesError, timeSlots, matchesToCreate, participantsToCreate, _i, timeSlots_2, timeSlot, _loop_2, _e, _f, option, _g, insertedMatches, matchesError, matchIdMap, participantsWithIds, participantsError;
    var data = _b.data;
    return __generator(this, function (_h) {
        switch (_h.label) {
            case 0:
                supabase = (0, supabase_1.getSupabaseServerClient)();
                uid = new short_unique_id_1.default({ length: 8 });
                return [4 /*yield*/, supabase
                        .from('sessions')
                        .select('*')
                        .eq('public_id', data.sessionPublicId)
                        .single()];
            case 1:
                _c = _h.sent(), sessionRow = _c.data, sessionError = _c.error;
                if (sessionError || !sessionRow) {
                    throw new Error('Session not found');
                }
                return [4 /*yield*/, supabase
                        .from('session_votes')
                        .select('*, players(*)')
                        .eq('session_id', sessionRow.id)];
            case 2:
                _d = _h.sent(), votes = _d.data, votesError = _d.error;
                if (votesError) {
                    throw new Error("Failed to fetch votes: ".concat(votesError.message));
                }
                timeSlots = typeof sessionRow.time_slots === 'string'
                    ? JSON.parse(sessionRow.time_slots)
                    : sessionRow.time_slots;
                matchesToCreate = [];
                participantsToCreate = [];
                // Group votes by time slot and level
                for (_i = 0, timeSlots_2 = timeSlots; _i < timeSlots_2.length; _i++) {
                    timeSlot = timeSlots_2[_i];
                    _loop_2 = function (option) {
                        var votersForOption = votes === null || votes === void 0 ? void 0 : votes.filter(function (vote) { return vote.option_id === option.id; });
                        if (!votersForOption || votersForOption.length === 0) {
                            // No votes for this option, create empty match slots
                            var matchId = uid.rnd();
                            matchesToCreate.push({
                                session_id: sessionRow.id,
                                public_id: matchId,
                                time_slot_id: timeSlot.id,
                                level: option.level,
                                start_time: timeSlot.range[0],
                                end_time: timeSlot.range[1],
                                max_players: sessionRow.limit_players
                                    ? sessionRow.players_per_slot || 4
                                    : 4,
                            });
                        }
                        else {
                            // Create matches based on votes (4 players per match)
                            var playersPerMatch = sessionRow.limit_players
                                ? sessionRow.players_per_slot || 4
                                : 4;
                            var matchesNeeded = Math.ceil(votersForOption.length / playersPerMatch);
                            for (var i = 0; i < matchesNeeded; i++) {
                                var matchId = uid.rnd();
                                matchesToCreate.push({
                                    session_id: sessionRow.id,
                                    public_id: matchId,
                                    time_slot_id: timeSlot.id,
                                    level: option.level,
                                    start_time: timeSlot.range[0],
                                    end_time: timeSlot.range[1],
                                    max_players: playersPerMatch,
                                });
                                // Assign players to this match
                                var playersForThisMatch = votersForOption.slice(i * playersPerMatch, (i + 1) * playersPerMatch);
                                for (var _j = 0, playersForThisMatch_2 = playersForThisMatch; _j < playersForThisMatch_2.length; _j++) {
                                    var vote = playersForThisMatch_2[_j];
                                    participantsToCreate.push({
                                        match_public_id: matchId,
                                        player_id: vote.player_id,
                                        source: 'vote',
                                    });
                                }
                            }
                            // If last match isn't full, it has open slots for manual joining
                        }
                    };
                    for (_e = 0, _f = timeSlot.options; _e < _f.length; _e++) {
                        option = _f[_e];
                        _loop_2(option);
                    }
                }
                return [4 /*yield*/, supabase
                        .from('matches')
                        .insert(matchesToCreate)
                        .select()];
            case 3:
                _g = _h.sent(), insertedMatches = _g.data, matchesError = _g.error;
                if (matchesError) {
                    console.error('Error creating matches:', matchesError);
                    throw new Error("Failed to create matches: ".concat(matchesError.message));
                }
                matchIdMap = new Map(insertedMatches.map(function (match) { return [match.public_id, match.id]; }));
                participantsWithIds = participantsToCreate
                    .map(function (p) { return ({
                    match_id: matchIdMap.get(p.match_public_id),
                    player_id: p.player_id,
                    source: p.source,
                }); })
                    .filter(function (p) { return p.match_id !== undefined; });
                if (!(participantsWithIds.length > 0)) return [3 /*break*/, 5];
                return [4 /*yield*/, supabase
                        .from('match_participants')
                        .insert(participantsWithIds)];
            case 4:
                participantsError = (_h.sent()).error;
                if (participantsError) {
                    console.error('Error creating participants:', participantsError);
                    throw new Error("Failed to add players to matches: ".concat(participantsError.message));
                }
                _h.label = 5;
            case 5: return [2 /*return*/, { success: true, matchesCreated: insertedMatches.length }];
        }
    });
}); });
var useVoteForSession = function (_a) {
    var sessionId = _a.sessionId, currentUser = _a.currentUser;
    var queryClient = (0, react_query_1.useQueryClient)();
    var voteForSession = (0, react_query_1.useMutation)({
        mutationFn: function (variables) { return __awaiter(void 0, void 0, void 0, function () {
            var slot, option, alreadyVoted, otherOptionsInSlot, unvotePromises;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        slot = variables.session.timeSlots.find(function (ts) { return ts.id === variables.timeSlot; });
                        option = slot === null || slot === void 0 ? void 0 : slot.options.find(function (o) { return o.level === variables.level; });
                        if (!option) {
                            throw new Error('Option not found');
                        }
                        alreadyVoted = option.players.some(function (player) { return player.id === currentUser.id; });
                        if (!alreadyVoted) return [3 /*break*/, 2];
                        // Unvote
                        return [4 /*yield*/, (0, exports.unvoteForOption)({
                                data: {
                                    sessionPublicId: sessionId,
                                    optionId: option.id,
                                    playerId: currentUser.id,
                                },
                            })];
                    case 1:
                        // Unvote
                        _a.sent();
                        return [3 /*break*/, 5];
                    case 2:
                        otherOptionsInSlot = (slot === null || slot === void 0 ? void 0 : slot.options.filter(function (o) { return o.level !== variables.level; })) || [];
                        unvotePromises = otherOptionsInSlot
                            .filter(function (otherOption) {
                            return otherOption.players.some(function (p) { return p.id === currentUser.id; });
                        })
                            .map(function (otherOption) {
                            return (0, exports.unvoteForOption)({
                                data: {
                                    sessionPublicId: sessionId,
                                    optionId: otherOption.id,
                                    playerId: currentUser.id,
                                },
                            });
                        });
                        return [4 /*yield*/, Promise.all(unvotePromises)
                            // Vote for the new option
                        ];
                    case 3:
                        _a.sent();
                        // Vote for the new option
                        return [4 /*yield*/, (0, exports.voteForOption)({
                                data: {
                                    sessionPublicId: sessionId,
                                    optionId: option.id,
                                    playerId: currentUser.id,
                                },
                            })];
                    case 4:
                        // Vote for the new option
                        _a.sent();
                        _a.label = 5;
                    case 5: return [2 /*return*/];
                }
            });
        }); },
        // Optimistic update BEFORE mutation
        onMutate: function (variables) { return __awaiter(void 0, void 0, void 0, function () {
            var previousSession, slot, option, isUnvoting;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: 
                    // Cancel any outgoing refetches to avoid overwriting optimistic update
                    return [4 /*yield*/, queryClient.cancelQueries({ queryKey: ['session', sessionId] })
                        // Snapshot the previous value
                    ];
                    case 1:
                        // Cancel any outgoing refetches to avoid overwriting optimistic update
                        _b.sent();
                        previousSession = queryClient.getQueryData([
                            'session',
                            sessionId,
                        ]);
                        slot = variables.session.timeSlots.find(function (ts) { return ts.id === variables.timeSlot; });
                        option = slot === null || slot === void 0 ? void 0 : slot.options.find(function (o) { return o.level === variables.level; });
                        isUnvoting = (_a = option === null || option === void 0 ? void 0 : option.players.some(function (player) { return player.id === currentUser.id; })) !== null && _a !== void 0 ? _a : false;
                        // Optimistically update to the new value
                        queryClient.setQueryData(['session', sessionId], function (old) {
                            var _a;
                            if (!old)
                                return old;
                            var optionsInSlot = (_a = old.timeSlots.find(function (timeSlot) { return timeSlot.id === variables.timeSlot; })) === null || _a === void 0 ? void 0 : _a.options;
                            if (!optionsInSlot) {
                                return old;
                            }
                            var updatedGamesInSlot = optionsInSlot.map(function (option) {
                                // If the currently selected level is the same as the one we are voting for, we should remove the vote.
                                if (option.level === variables.level &&
                                    option.players.some(function (player) { return player.id === currentUser.id; })) {
                                    return __assign(__assign({}, option), { players: option.players.filter(function (player) { return player.id !== currentUser.id; }) });
                                }
                                // Remove the current user from all levels in this time slot first
                                var playersWithoutCurrentUser = option.players.filter(function (player) { return player.id !== currentUser.id; });
                                // Add the user only to the selected level
                                if (option.level === variables.level) {
                                    return __assign(__assign({}, option), { players: __spreadArray([
                                            __assign(__assign({}, currentUser), { votedAt: new Date() })
                                        ], playersWithoutCurrentUser, true) });
                                }
                                return __assign(__assign({}, option), { players: playersWithoutCurrentUser });
                            });
                            return __assign(__assign({}, old), { timeSlots: old.timeSlots.map(function (timeSlot) {
                                    if (timeSlot.id === variables.timeSlot) {
                                        return __assign(__assign({}, timeSlot), { options: updatedGamesInSlot });
                                    }
                                    return timeSlot;
                                }) });
                        });
                        // Return context with the snapshot and whether this is unvoting
                        return [2 /*return*/, { previousSession: previousSession, isUnvoting: isUnvoting }];
                }
            });
        }); },
        onError: function (error, _variables, context) {
            // Rollback to previous value on error
            if (context === null || context === void 0 ? void 0 : context.previousSession) {
                queryClient.setQueryData(['session', sessionId], context.previousSession);
            }
            console.error('Error voting for session:', error);
            var errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
            sonner_1.toast.error('Failed to vote for session', {
                description: errorMessage,
            });
        },
        onSuccess: function (_data, variables, context) {
            // Find the time slot to get the start time
            var slot = variables.session.timeSlots.find(function (ts) { return ts.id === variables.timeSlot; });
            var timeSlotStart = (slot === null || slot === void 0 ? void 0 : slot.range[0]) ? (0, date_fns_1.format)(slot.range[0], 'HH:mm') : '';
            var level = variables.level.toLowerCase();
            if (context === null || context === void 0 ? void 0 : context.isUnvoting) {
                sonner_1.toast.success("You removed your vote from the ".concat(timeSlotStart, " ").concat(level, " slot"));
            }
            else {
                sonner_1.toast.success("You voted for the ".concat(timeSlotStart, " ").concat(level, " slot"));
            }
        },
        // Always refetch after error or success to sync with server
        onSettled: function () {
            queryClient.invalidateQueries({ queryKey: ['session', sessionId] });
        },
    }).mutate;
    return { voteForSession: voteForSession };
};
exports.useVoteForSession = useVoteForSession;
// Hook for joining/unjoining matches
var useMatchActions = function (_a) {
    var sessionId = _a.sessionId, currentUserId = _a.currentUserId;
    var queryClient = (0, react_query_1.useQueryClient)();
    var _b = (0, react_query_1.useMutation)({
        mutationFn: function (matchPublicId) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, exports.joinMatch)({
                            data: {
                                matchPublicId: matchPublicId,
                                playerId: currentUserId,
                                source: 'manual',
                            },
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); },
        onError: function (error) {
            console.error('Error joining match:', error);
            var errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
            sonner_1.toast.error('Failed to join match', {
                description: errorMessage,
            });
        },
        onSuccess: function (_data, matchPublicId) {
            // Get match data from query cache
            var matches = queryClient.getQueryData([
                'matches',
                sessionId,
            ]);
            var match = matches === null || matches === void 0 ? void 0 : matches.find(function (m) { return m.id === matchPublicId; });
            if (match) {
                var timeSlotStart = match.slot.range[0]
                    ? (0, date_fns_1.format)(match.slot.range[0], 'HH:mm')
                    : '';
                var level = match.level.toLowerCase();
                sonner_1.toast.success("You joined the ".concat(timeSlotStart, " ").concat(level, " match"));
            }
            else {
                sonner_1.toast.success('Successfully joined match!');
            }
            // Refetch matches to get updated data
            queryClient.invalidateQueries({ queryKey: ['matches', sessionId] });
        },
    }), joinMatchMutation = _b.mutate, isJoining = _b.isPending;
    var _c = (0, react_query_1.useMutation)({
        mutationFn: function (matchPublicId) { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, exports.unjoinMatch)({
                            data: {
                                matchPublicId: matchPublicId,
                                playerId: currentUserId,
                            },
                        })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); },
        onError: function (error) {
            console.error('Error leaving match:', error);
            var errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
            sonner_1.toast.error('Failed to leave match', {
                description: errorMessage,
            });
        },
        onSuccess: function (_data, matchPublicId) {
            // Get match data from query cache
            var matches = queryClient.getQueryData([
                'matches',
                sessionId,
            ]);
            var match = matches === null || matches === void 0 ? void 0 : matches.find(function (m) { return m.id === matchPublicId; });
            if (match) {
                var timeSlotStart = match.slot.range[0]
                    ? (0, date_fns_1.format)(match.slot.range[0], 'HH:mm')
                    : '';
                var level = match.level.toLowerCase();
                sonner_1.toast.success("You left the ".concat(timeSlotStart, " ").concat(level, " match"));
            }
            else {
                sonner_1.toast.success('Successfully left match!');
            }
            // Refetch matches to get updated data
            queryClient.invalidateQueries({ queryKey: ['matches', sessionId] });
        },
    }), unjoinMatchMutation = _c.mutate, isUnjoining = _c.isPending;
    var toggleMatchParticipation = function (matchPublicId, isCurrentlyJoined) {
        if (isCurrentlyJoined) {
            unjoinMatchMutation(matchPublicId);
        }
        else {
            joinMatchMutation(matchPublicId);
        }
    };
    return {
        joinMatch: joinMatchMutation,
        unjoinMatch: unjoinMatchMutation,
        toggleMatchParticipation: toggleMatchParticipation,
        isLoading: isJoining || isUnjoining,
    };
};
exports.useMatchActions = useMatchActions;
exports.createSessionValidator = zod_1.z.object({
    venueName: zod_1.z.string().min(1, { message: 'Venue name is required' }),
    venueLocation: zod_1.z
        .string()
        .url({ message: 'Please enter a valid URL for the venue' }),
    venuePlaceId: zod_1.z.string().min(1, { message: 'Venue Place ID is required' }),
    date: zod_1.z.date(),
    levels: zod_1.z
        .array(zod_1.z.object({
        level: zod_1.z.string(),
        timeSlots: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string(), range: zod_1.z.tuple([zod_1.z.date(), zod_1.z.date()]) })),
    }))
        .min(1, { message: 'At least one level must be selected' })
        .refine(function (levels) { return levels.some(function (level) { return level.timeSlots.length > 0; }); }, {
        message: 'At least one time slot must be selected for at least one level',
    }),
    timeBlocks: zod_1.z.enum(['60', '90']),
    limitPlayers: zod_1.z.boolean(),
    playersPerSlot: zod_1.z
        .number()
        .min(4, { message: 'Players per slot must be at least 4' })
        .multipleOf(4, { message: 'Players per slot must be a multiple of 4' })
        .optional(),
    votingClosesAt: zod_1.z.date().optional(),
});
exports.createSession = (0, react_start_1.createServerFn)({ method: 'POST' })
    .inputValidator((0, zod_adapter_1.zodValidator)(exports.createSessionValidator.extend({
    status: zod_1.z
        .enum(['draft', 'voting', 'open', 'cancelled', 'closed'])
        .default('voting'),
})))
    .handler(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var supabase, venueName, venueLocation, venuePlaceId, error_1, uid_1, allTimeSlotsMap_1, timeSlots, sessionData, _c, session, error, error_2;
    var data = _b.data;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _d.trys.push([0, 6, , 7]);
                supabase = (0, supabase_1.getSupabaseServerClient)();
                venueName = data.venueName, venueLocation = data.venueLocation, venuePlaceId = data.venuePlaceId;
                if (!(venueName && venueLocation && venuePlaceId)) return [3 /*break*/, 4];
                _d.label = 1;
            case 1:
                _d.trys.push([1, 3, , 4]);
                return [4 /*yield*/, (0, venues_1.upsertVenue)({
                        data: {
                            label: venueName,
                            mapsUrl: venueLocation,
                            placeId: venuePlaceId,
                        },
                    })];
            case 2:
                _d.sent();
                return [3 /*break*/, 4];
            case 3:
                error_1 = _d.sent();
                // Log error but don't fail session creation
                console.error('Error saving venue:', error_1);
                return [3 /*break*/, 4];
            case 4:
                uid_1 = new short_unique_id_1.default({ length: 8 });
                allTimeSlotsMap_1 = new Map();
                data.levels.forEach(function (levelData) {
                    levelData.timeSlots.forEach(function (timeSlot) {
                        if (!allTimeSlotsMap_1.has(timeSlot.id)) {
                            allTimeSlotsMap_1.set(timeSlot.id, timeSlot);
                        }
                    });
                });
                timeSlots = Array.from(allTimeSlotsMap_1.values()).map(function (timeSlot) {
                    // For each time slot, find which levels have it
                    var options = data.levels
                        .filter(function (levelData) {
                        return levelData.timeSlots.some(function (ts) { return ts.id === timeSlot.id; });
                    })
                        .map(function (levelData) { return ({
                        id: uid_1.rnd(),
                        slot: timeSlot,
                        level: levelData.level,
                        players: [],
                    }); });
                    return {
                        id: timeSlot.id,
                        range: timeSlot.range,
                        options: options,
                    };
                });
                sessionData = {
                    public_id: uid_1.rnd(),
                    venue_name: data.venueName,
                    venue_location: data.venueLocation,
                    // Combine session.date and session.time into a single ISO datetime string for the "date" field.
                    date: (0, date_fns_1.formatISO)(data.date),
                    levels: data.levels.map(function (l) { return l.level; }),
                    time_blocks: parseInt(data.timeBlocks),
                    time_slots: JSON.stringify(timeSlots),
                    limit_players: data.limitPlayers,
                    players_per_slot: data.playersPerSlot,
                    status: data.status || 'voting',
                    voting_closes_at: data.votingClosesAt
                        ? (0, date_fns_1.formatISO)(data.votingClosesAt)
                        : null,
                };
                return [4 /*yield*/, supabase
                        .from('sessions')
                        .insert(sessionData)
                        .select()
                        .single()];
            case 5:
                _c = _d.sent(), session = _c.data, error = _c.error;
                if (error) {
                    throw new Error("Failed to create session: ".concat(error.message));
                }
                return [2 /*return*/, session.public_id];
            case 6:
                error_2 = _d.sent();
                console.error('Error in createSession:', error_2);
                throw error_2;
            case 7: return [2 /*return*/];
        }
    });
}); });
// Save session as template
exports.saveSessionTemplate = (0, react_start_1.createServerFn)({ method: 'POST' })
    .inputValidator((0, zod_adapter_1.zodValidator)(zod_1.z.object({
    name: zod_1.z.string().min(1, { message: 'Template name is required' }),
    templateData: zod_1.z.object({
        venueName: zod_1.z.string().optional(),
        venueLocation: zod_1.z.string().optional(),
        venuePlaceId: zod_1.z.string().optional(),
        levels: zod_1.z.array(zod_1.z.string()),
        timeBlocks: zod_1.z.enum(['60', '90']),
        timeSlots: zod_1.z.array(zod_1.z.object({ id: zod_1.z.string() })).optional(),
        limitPlayers: zod_1.z.boolean(),
        playersPerSlot: zod_1.z.number().optional(),
    }),
})))
    .handler(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var supabase, user, _c, template, error, error_3;
    var data = _b.data;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _d.trys.push([0, 3, , 4]);
                supabase = (0, supabase_1.getSupabaseServerClient)();
                return [4 /*yield*/, supabase.auth.getUser()];
            case 1:
                user = (_d.sent()).data.user;
                if (!user) {
                    throw new Error('User not authenticated');
                }
                return [4 /*yield*/, supabase
                        .from('session_templates')
                        .insert({
                        name: data.name,
                        created_by: user.id,
                        template_data: data.templateData,
                    })
                        .select()
                        .single()];
            case 2:
                _c = _d.sent(), template = _c.data, error = _c.error;
                if (error) {
                    throw new Error("Failed to save template: ".concat(error.message));
                }
                return [2 /*return*/, { success: true, templateId: template.id }];
            case 3:
                error_3 = _d.sent();
                console.error('Error in saveSessionTemplate:', error_3);
                throw error_3;
            case 4: return [2 /*return*/];
        }
    });
}); });
// Fetch all templates
exports.fetchSessionTemplates = (0, react_start_1.createServerFn)({ method: 'GET' }).handler(function () { return __awaiter(void 0, void 0, void 0, function () {
    var supabase, _a, templates, error, error_4;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                supabase = (0, supabase_1.getSupabaseServerClient)();
                return [4 /*yield*/, supabase
                        .from('session_templates')
                        .select('*')
                        .order('created_at', { ascending: false })];
            case 1:
                _a = _b.sent(), templates = _a.data, error = _a.error;
                if (error) {
                    throw new Error("Failed to fetch templates: ".concat(error.message));
                }
                return [2 /*return*/, templates];
            case 2:
                error_4 = _b.sent();
                console.error('Error in fetchSessionTemplates:', error_4);
                throw error_4;
            case 3: return [2 /*return*/];
        }
    });
}); });
// Update session status
exports.updateSessionStatus = (0, react_start_1.createServerFn)({ method: 'POST' })
    .inputValidator((0, zod_adapter_1.zodValidator)(zod_1.z.object({
    sessionPublicId: zod_1.z.string(),
    status: zod_1.z.enum(['draft', 'voting', 'open', 'cancelled', 'closed']),
})))
    .handler(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var supabase, _c, sessionRow, sessionError, previousStatus, updateError, _d, matchesCount, matchesCheckError, generateError_1, error_5;
    var data = _b.data;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _e.trys.push([0, 8, , 9]);
                supabase = (0, supabase_1.getSupabaseServerClient)();
                return [4 /*yield*/, supabase
                        .from('sessions')
                        .select('id, status')
                        .eq('public_id', data.sessionPublicId)
                        .single()];
            case 1:
                _c = _e.sent(), sessionRow = _c.data, sessionError = _c.error;
                if (sessionError || !sessionRow) {
                    throw new Error('Session not found');
                }
                previousStatus = sessionRow.status;
                return [4 /*yield*/, supabase
                        .from('sessions')
                        .update({ status: data.status })
                        .eq('id', sessionRow.id)];
            case 2:
                updateError = (_e.sent()).error;
                if (updateError) {
                    throw new Error("Failed to update session status: ".concat(updateError.message));
                }
                if (!(previousStatus === 'voting' && data.status === 'open')) return [3 /*break*/, 7];
                return [4 /*yield*/, supabase
                        .from('matches')
                        .select('*', { count: 'exact', head: true })
                        .eq('session_id', sessionRow.id)];
            case 3:
                _d = _e.sent(), matchesCount = _d.count, matchesCheckError = _d.error;
                if (matchesCheckError) {
                    console.error('Error checking existing matches:', matchesCheckError);
                    // Continue anyway - matches generation might still work
                }
                if (!(!matchesCount || matchesCount === 0)) return [3 /*break*/, 7];
                _e.label = 4;
            case 4:
                _e.trys.push([4, 6, , 7]);
                return [4 /*yield*/, generateMatchesHelper(data.sessionPublicId)];
            case 5:
                _e.sent();
                return [3 /*break*/, 7];
            case 6:
                generateError_1 = _e.sent();
                console.error('Error generating matches:', generateError_1);
                return [3 /*break*/, 7];
            case 7: return [2 /*return*/, { success: true }];
            case 8:
                error_5 = _e.sent();
                console.error('Error in updateSessionStatus:', error_5);
                throw error_5;
            case 9: return [2 /*return*/];
        }
    });
}); });
// Delete session
exports.deleteSession = (0, react_start_1.createServerFn)({ method: 'POST' })
    .inputValidator((0, zod_adapter_1.zodValidator)(zod_1.z.object({ sessionPublicId: zod_1.z.string() })))
    .handler(function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
    var supabase, _c, sessionRow, sessionError, deleteError, error_6;
    var data = _b.data;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _d.trys.push([0, 3, , 4]);
                supabase = (0, supabase_1.getSupabaseServerClient)();
                return [4 /*yield*/, supabase
                        .from('sessions')
                        .select('id')
                        .eq('public_id', data.sessionPublicId)
                        .single()];
            case 1:
                _c = _d.sent(), sessionRow = _c.data, sessionError = _c.error;
                if (sessionError || !sessionRow) {
                    throw new Error('Session not found');
                }
                return [4 /*yield*/, supabase
                        .from('sessions')
                        .delete()
                        .eq('id', sessionRow.id)];
            case 2:
                deleteError = (_d.sent()).error;
                if (deleteError) {
                    throw new Error("Failed to delete session: ".concat(deleteError.message));
                }
                return [2 /*return*/, { success: true }];
            case 3:
                error_6 = _d.sent();
                console.error('Error in deleteSession:', error_6);
                throw error_6;
            case 4: return [2 /*return*/];
        }
    });
}); });
