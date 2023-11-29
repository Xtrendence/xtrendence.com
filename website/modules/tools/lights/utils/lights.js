import net from 'net';
import { getConfig } from './config.js';

export function sendRequest(method, params, onData, onEnd) {
    try {
        const { ip: host, port } = getConfig();

        const connection = net.createConnection({ host, port });

        connection.write(JSON.stringify({ id: 1, method, params }) + '\r\n');

        connection.on('data', (data) => {
            try {
                if (onData) {
                    onData(data.toString());
                }

                connection.end();
                connection.destroy();
            } catch (error) {
                console.log(error);
            }
        });

        connection.on('end', () => {
            try {
                if (onEnd) {
                    onEnd();
                }

                connection.end();
                connection.destroy();
            } catch (error) {
                console.log(error);
            }
        });
    } catch (error) {
        console.log(error);
    }
}
