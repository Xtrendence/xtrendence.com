import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config({
    path: path.join(__dirname, './.env'),
});

try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const log = path.join(__dirname, 'dns.log');

    if (!fs.existsSync(log)) {
        fs.writeFileSync(log, '');
    }

    const headers = {
        'X-Auth-Email': process.env.CLOUDFLARE_EMAIL,
        'X-Auth-Key': process.env.CLOUDFLARE_KEY,
        'Content-Type': 'application/json',
    };

    const domain = 'xtrendence.com';
    const record = 'xtrendence.com';

    (async () => {
        try {
            const { data: ip } = await axios.get('https://api.ipify.org');

            const data = {
                type: 'A',
                name: record,
                content: ip,
                ttl: 1,
                proxied: false,
            };

            const { data: zoneData } = await axios.get(
                `https://api.cloudflare.com/client/v4/zones?name=${domain}`,
                {
                    headers,
                }
            );

            const zone = zoneData.result[0].id;

            const { data: dnsData } = await axios.get(
                `https://api.cloudflare.com/client/v4/zones/${zone}/dns_records?name=${record}`,
                {
                    headers,
                }
            );

            const dns = dnsData.result[0].id;

            const prevIp = dnsData.result[0].content;

            if (prevIp !== ip) {
                await axios.put(
                    `https://api.cloudflare.com/client/v4/zones/${zone}/dns_records/${dns}`,
                    data,
                    {
                        headers,
                    }
                );
            }

            // Clear log if it's over 2MB
            if (fs.statSync(log).size > 2000000) {
                fs.writeFileSync(log, '');
            }

            fs.appendFileSync(
                log,
                `${new Date().toLocaleString()} - ${prevIp} - ${ip}\n`
            );
        } catch (error) {
            console.error(error);
        }
    })();
} catch (error) {
    console.error(error);
}
