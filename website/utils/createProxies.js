import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';

const proxies = [
    {
        context: '/tools/lights',
        target: 'http://localhost:3001',
        pathRewrite: { '^/tools/lights': '' },
        changeOrigin: true,
    },
    {
        context: '/auth',
        target: 'http://localhost:3002',
        pathRewrite: { '^/auth': '' },
        changeOrigin: false,
    },
    {
        context: '/tools/finances',
        target: 'http://localhost:3003',
        pathRewrite: { '^/tools/finances': '' },
        changeOrigin: true,
    },
    {
        context: '/bot',
        target: 'http://localhost:3004',
        pathRewrite: { '^/bot': '' },
        changeOrigin: false,
        ws: true,
    },
		{
        context: '/tools/plutus',
        target: 'http://localhost:3005',
        pathRewrite: { '^/tools/plutus': '' },
        changeOrigin: true,
    },
    {
        context: '/tools/cryptoshare',
        target: 'http://localhost:3190',
        pathRewrite: {
            '^/tools/cryptoshare': '',
        },
        changeOrigin: false,
        ws: true,
    },
];

export function createProxies(app, devMode) {
    for (const proxy of proxies) {
        app.use(
            proxy.context,
            createProxyMiddleware({
                target: proxy.target,
                changeOrigin: proxy.changeOrigin,
                ws: proxy?.ws === true ? true : false,
                pathRewrite: proxy?.pathRewrite ? proxy.pathRewrite : {},
                onProxyReq: proxy?.onProxyReq
                    ? proxy.onProxyReq
                    : (proxyReq, req, _) => {
                          proxyReq.setHeader(
                              'local-address',
                              req.socket.localAddress
                          );

                          proxyReq.setHeader(
                              'remote-address',
                              req.socket.remoteAddress
                          );

                          proxyReq.setHeader('dev-mode', devMode);

                          return fixRequestBody(proxyReq, req, _);
                      },
            })
        );
    }
}
