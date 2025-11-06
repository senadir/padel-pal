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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRouter = void 0;
var react_router_1 = require("@tanstack/react-router");
var react_router_ssr_query_1 = require("@tanstack/react-router-ssr-query");
var TanstackQuery = require("./integrations/tanstack-query/root-provider");
var auth_1 = require("./contexts/auth");
// Import the generated route tree
var routeTree_gen_1 = require("./routeTree.gen");
// Create a new router instance
var getRouter = function () {
    var rqContext = TanstackQuery.getContext();
    var router = (0, react_router_1.createRouter)({
        routeTree: routeTree_gen_1.routeTree,
        context: __assign(__assign({}, rqContext), { authData: null }),
        defaultPreload: 'intent',
        Wrap: function (props) {
            return (<TanstackQuery.Provider {...rqContext}>
          <auth_1.AuthProvider>{props.children}</auth_1.AuthProvider>
        </TanstackQuery.Provider>);
        },
        defaultViewTransition: true,
        defaultStructuralSharing: true,
    });
    (0, react_router_ssr_query_1.setupRouterSsrQueryIntegration)({ router: router, queryClient: rqContext.queryClient });
    return router;
};
exports.getRouter = getRouter;
