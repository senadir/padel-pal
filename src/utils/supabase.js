"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupabaseServerClient = getSupabaseServerClient;
var server_1 = require("@tanstack/react-start/server");
var ssr_1 = require("@supabase/ssr");
// Server-side Supabase client
function getSupabaseServerClient() {
    return (0, ssr_1.createServerClient)(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLIC_KEY, {
        cookies: {
            getAll: function () {
                return Object.entries((0, server_1.getCookies)()).map(function (_a) {
                    var name = _a[0], value = _a[1];
                    return ({
                        name: name,
                        value: value,
                    });
                });
            },
            setAll: function (cookies) {
                cookies.forEach(function (cookie) {
                    (0, server_1.setCookie)(cookie.name, cookie.value);
                });
            },
        },
    });
}
