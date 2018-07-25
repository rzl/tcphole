const net = require('net');
const sp = require('./stickPackage');

const OUT_SERVER_IP = '127.0.0.1';
const OUT_SERVER_PORT = 8090;
const IN_SERVER_IP = '127.0.0.1';
const IN_SERVER_PORT = 8080;

const outclient = new net.Socket();
const inclientMap = {};

outclient.connect(OUT_SERVER_PORT, OUT_SERVER_IP, function () {
    console.log('outclient is connected.');
});
let halfUint8 = new Uint8Array();
outclient.on('data', (data) => {
    const packs = sp.decode(Uint8Array.of(...halfUint8, ...data));
    halfUint8 = new Uint8Array();
    packs.forEach(pack => {
        if (pack.type === 'full') {
            buildClient(pack.tag);
            inclientMap[pack.tag] && inclientMap[pack.tag].write(Buffer.from(pack.payload));
        } else if (pack.type === 'half') {
            halfUint8 = pack.bytes;
        }
    });
});
outclient.on('close', () => console.log('outclient closed'));
outclient.on('error', console.error);


const buildClient = (addr) => {
    if (!inclientMap[addr]) {
        const inclient = new net.Socket();
        inclientMap[addr] = inclient;

        inclient.connect(IN_SERVER_PORT, IN_SERVER_IP, function () {
            console.log(`inclient ${addr} is connected`);
        });
        inclient.on('data', (data) => {
            outclient.write(Buffer.from(sp.encode(addr, data)));
        });
        inclient.on('close', () => {
            delete inclientMap[addr];
            console.log(`inclient ${addr} closed`);
        });
        inclient.on('error', function (err) {
            console.error(err)
        });
    }
}

