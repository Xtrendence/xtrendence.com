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
		// CyberChef finds its workers relative to the last slash in the URL
		requiresTrailingSlash: true,
		requiresAuth: true,
		openOnLan: true,
	},
];

// Same 401 as /tools, since proxies run before the route table
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

// Cloudflared connects from loopback, so only direct private addresses count
const PRIVATE_ADDRESS = /^(?:::ffff:)?(?:10\.|192\.168\.)|^f[cd]|^fe80:/i;

function isLanRequest(req) {
	if (req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"]) {
		return false;
	}
	return PRIVATE_ADDRESS.test(String(req.socket.remoteAddress ?? ""));
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
			app.use(proxy.context, (req, res, next) => {
				if (proxy?.openOnLan && isLanRequest(req)) {
					next();
					return;
				}

				requireAuth(req, res, next);
			});
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

							// Always set, so a client cannot send its own
							proxyReq.setHeader("lan-request", String(isLanRequest(req)));

							return fixRequestBody(proxyReq, req, _);
						},
			}),
		);
	}
}
