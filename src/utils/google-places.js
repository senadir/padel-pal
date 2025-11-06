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
exports.searchGooglePlaces = searchGooglePlaces;
exports.getGooglePlaceDetails = getGooglePlaceDetails;
/**
 * Get the Google Places API key from environment variables
 * Throws an error if the key is not configured
 */
function getApiKey() {
    var apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
        throw new Error('Google Places API key not configured');
    }
    return apiKey;
}
/**
 * Search Google Places Autocomplete API (direct client-side call)
 * Uses the new Places API (New) with REST endpoint
 * Docs: https://developers.google.com/maps/documentation/places/web-service/autocomplete
 */
function searchGooglePlaces(query, location) {
    return __awaiter(this, void 0, void 0, function () {
        var apiKey, url, requestBody, response, errorText, data, results, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!query || query.length < 3) {
                        return [2 /*return*/, []];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, , 7]);
                    apiKey = getApiKey();
                    url = 'https://places.googleapis.com/v1/places:autocomplete';
                    requestBody = {
                        input: query,
                        includedPrimaryTypes: ['gym', 'sports_complex', 'sports_club'],
                    };
                    // Add location bias if provided
                    if (location) {
                        requestBody.locationBias = {
                            circle: {
                                center: {
                                    latitude: location.lat,
                                    longitude: location.lng,
                                },
                                radius: 50000, // 50km
                            },
                        };
                    }
                    return [4 /*yield*/, fetch(url, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Goog-Api-Key': apiKey,
                            },
                            body: JSON.stringify(requestBody),
                        })];
                case 2:
                    response = _a.sent();
                    if (!!response.ok) return [3 /*break*/, 4];
                    return [4 /*yield*/, response.text()];
                case 3:
                    errorText = _a.sent();
                    console.error('Google Places API error:', errorText);
                    throw new Error("Google Places API error: ".concat(response.status));
                case 4: return [4 /*yield*/, response.json()];
                case 5:
                    data = (_a.sent());
                    results = (data.suggestions || [])
                        .filter(function (suggestion) { return !!(suggestion === null || suggestion === void 0 ? void 0 : suggestion.placePrediction); })
                        .map(function (suggestion) {
                        var _a, _b, _c, _d, _e, _f;
                        // TypeScript now knows placePrediction exists due to filter
                        var placePrediction = suggestion.placePrediction;
                        var mainText = ((_b = (_a = placePrediction.structuredFormat) === null || _a === void 0 ? void 0 : _a.mainText) === null || _b === void 0 ? void 0 : _b.text) ||
                            ((_c = placePrediction.text) === null || _c === void 0 ? void 0 : _c.text) ||
                            '';
                        var secondaryText = ((_e = (_d = placePrediction.structuredFormat) === null || _d === void 0 ? void 0 : _d.secondaryText) === null || _e === void 0 ? void 0 : _e.text) || '';
                        return {
                            place_id: placePrediction.placeId,
                            description: ((_f = placePrediction.text) === null || _f === void 0 ? void 0 : _f.text) || '',
                            structured_formatting: {
                                main_text: mainText,
                                secondary_text: secondaryText,
                            },
                        };
                    });
                    return [2 /*return*/, results];
                case 6:
                    error_1 = _a.sent();
                    console.error('Error searching Google Places:', error_1);
                    throw error_1;
                case 7: return [2 /*return*/];
            }
        });
    });
}
/**
 * Fetch detailed information about a place using Places API (New)
 * Docs: https://developers.google.com/maps/documentation/places/web-service/place-details
 */
function getGooglePlaceDetails(placeId) {
    return __awaiter(this, void 0, void 0, function () {
        var apiKey, url, response, errorText, data, lat, lng, mapsUrl, error_2;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    if (!placeId) {
                        throw new Error('Place ID is required');
                    }
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 6, , 7]);
                    apiKey = getApiKey();
                    url = "https://places.googleapis.com/v1/places/".concat(placeId);
                    return [4 /*yield*/, fetch(url, {
                            method: 'GET',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Goog-Api-Key': apiKey,
                                'X-Goog-FieldMask': 'id,displayName,formattedAddress,googleMapsUri,location',
                            },
                        })];
                case 2:
                    response = _d.sent();
                    if (!!response.ok) return [3 /*break*/, 4];
                    return [4 /*yield*/, response.text()];
                case 3:
                    errorText = _d.sent();
                    throw new Error("Failed to fetch place details: ".concat(errorText));
                case 4: return [4 /*yield*/, response.json()];
                case 5:
                    data = (_d.sent());
                    lat = ((_a = data.location) === null || _a === void 0 ? void 0 : _a.latitude) || 0;
                    lng = ((_b = data.location) === null || _b === void 0 ? void 0 : _b.longitude) || 0;
                    mapsUrl = data.googleMapsUri ||
                        "https://www.google.com/maps/search/?api=1&query=".concat(lat, ",").concat(lng);
                    return [2 /*return*/, {
                            place_id: data.id,
                            name: ((_c = data.displayName) === null || _c === void 0 ? void 0 : _c.text) || '',
                            formatted_address: data.formattedAddress || '',
                            url: mapsUrl,
                            geometry: {
                                location: {
                                    lat: lat,
                                    lng: lng,
                                },
                            },
                        }];
                case 6:
                    error_2 = _d.sent();
                    console.error('Error fetching place details:', error_2);
                    throw error_2;
                case 7: return [2 /*return*/];
            }
        });
    });
}
