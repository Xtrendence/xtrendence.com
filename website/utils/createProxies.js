import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';

export function createProxies(app) {
    app.use(
        '/tools/lights',
        createProxyMiddleware({
            target: 'http://localhost:3001',
            changeOrigin: true,
            onProxyReq: fixRequestBody,
        })
    );

    app.use(
        '/auth',
        createProxyMiddleware({
            target: 'http://localhost:3002',
            changeOrigin: false,
            onProxyReq: fixRequestBody,
        })
    );
}
