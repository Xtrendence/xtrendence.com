import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';

const proxies = [
    {
        context: '/tools/lights',
        target: 'http://localhost:3001',
        changeOrigin: true,
    },
    {
        context: '/auth',
        target: 'http://localhost:3002',
        changeOrigin: false,
    },
    {
        context: '/tools/finances',
        target: 'http://localhost:3003',
        changeOrigin: true,
    },
    {
        context: '/tools/cryptoshare',
        target: 'http://localhost:3190',
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
                onProxyReq: (proxyReq, req, res) => {
                    proxyReq.setHeader(
                        'local-address',
                        req.socket.localAddress
                    );

                    proxyReq.setHeader(
                        'remote-address',
                        req.socket.remoteAddress
                    );

                    proxyReq.setHeader('dev-mode', devMode);

                    return fixRequestBody;
                },
            })
        );
    }
}
