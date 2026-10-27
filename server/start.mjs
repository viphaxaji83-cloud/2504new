import {createApp} from './app.mjs';
const port = Number(process.env.PORT || 4173), host = process.env.HOST || '127.0.0.1';
const {server} = await createApp();
server.listen(port, host, () => console.log(`Site: http://${host}:${port}`));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => {server.close(); server.closeIdleConnections(); setTimeout(() => process.exit(0), 5000).unref();});
