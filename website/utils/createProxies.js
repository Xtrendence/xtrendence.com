import { createProxyMiddleware, fixRequestBody } from "http-proxy-middleware";
import { verifyToken } from "./utils.js";

const proxies = [
	{
		context: "/tools/lights",
		target: "http://localhost:3001",
		pathRewrite: { "^/tools/lights": "" },
		changeOrigin: true,
	},
	{
		context: "/auth",
		target: "http://localhost:3002",
		pathRewrite: { "^/auth": "" },
		changeOrigin: false,
	},
	{
		context: "/bot",
		target: "http://localhost:3004",
		pathRewrite: { "^/bot": "" },
		changeOrigin: false,
		ws: true,
	},
	{
		context: "/tools/plutus",
		target: "http://localhost:3005",
		pathRewrite: { "^/tools/plutus": "" },
		changeOrigin: true,
	},
	{
		context: "/tools/journey",
		target: "http://localhost:3006",
		pathRewrite: { "^/tools/journey": "" },
		changeOrigin: true,
	},
	{
		context: "/tools/smahunter",
		target: "http://localhost:3007",
		pathRewrite: { "^/tools/smahunter": "" },
		changeOrigin: true,
	},
	{
		context: "/tools/cyberchef",
		target: "http://localhost:3008",
		pathRewrite: { "^/tools/cyberchef": "" },
		changeOrigin: true,
		// CyberChef works out where to load its worker modules from by trimming the
		// current URL back to the last slash, so it has to be served from a path that
		// ends in one.
		requiresTrailingSlash: true,
		requiresAuth: true,
	},
];

// Same 401 behaviour as the /tools route, so a proxied tool cannot be reached without a
// valid session even though the proxy runs before the route table.
function requireAuth(req, res, next) {
	verifyToken(req.cookies?.token).then((valid) => {
		if (valid) {
			next();
			return;
		}

		res
			.status(401)
			.send(
				'<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/error/401"></head></html>',
			);
	});
}

export function createProxies(app, devMode) {
	for (const proxy of proxies) {
		if (proxy?.requiresTrailingSlash) {
			app.get(proxy.context, (req, res, next) => {
				if (req.originalUrl.split("?")[0] === proxy.context) {
					res.redirect(301, `${proxy.context}/`);
					return;
				}

				next();
			});
		}

		if (proxy?.requiresAuth) {
			app.use(proxy.context, requireAuth);
		}

		app.use(
			proxy.context,
			createProxyMiddleware({
				target: proxy.target,
				changeOrigin: proxy.changeOrigin,
				ws: proxy?.ws === true,
				pathRewrite: proxy?.pathRewrite ? proxy.pathRewrite : {},
				onProxyReq: proxy?.onProxyReq
					? proxy.onProxyReq
					: (proxyReq, req, _) => {
							proxyReq.setHeader("local-address", req.socket.localAddress);

							proxyReq.setHeader("remote-address", req.socket.remoteAddress);

							proxyReq.setHeader("dev-mode", devMode);

							return fixRequestBody(proxyReq, req, _);
						},
			}),
		);
	}
}
