const net = require('net');
const sp = require('./stickPackage');
var argv = process.argv.splice(2);
console.log(argv)
var OUT_SERVER_IP = '127.0.0.1';
var OUT_SERVER_PORT = 8071;
var IN_SERVER_IP = '127.0.0.1';
var IN_SERVER_PORT = 8090;
var i = 0
if (argv[0] !== undefined && argv[0] !== "" && parseInt(argv[0])) {
    IN_SERVER_IP = argv[0]
}
if (argv[1] !== undefined && argv[1] !== "" && parseInt(argv[1])) {
    IN_SERVER_PORT = parseInt(argv[1])
}
if (argv[2] !== undefined && argv[2] !== "" && parseInt(argv[2])) {
    OUT_SERVER_IP = argv[2]
}
if (argv[3] !== undefined && argv[3] !== "" && parseInt(argv[3])) {
    OUT_SERVER_PORT = parseInt(argv[3])
}
console.log(IN_SERVER_IP)
console.log('usage: [被代理的服务器IP] [被代理的服务端口] [管道服务器IP] [管道服务端口] \n');
console.log('default: 127.0.0.1 8090 127.0.0.1 8071 \n');
console.log('被代理的服务: ' + IN_SERVER_IP +':'+ IN_SERVER_PORT);
console.log('管道服务: ' + OUT_SERVER_IP + ':' + OUT_SERVER_PORT);

const outclient = new net.Socket();
outclient.setTimeout(3000);
var timeout
const inclientMap = {};
var chunkRevNum = 0
var chunkSendNum = 0

outclient.connect(OUT_SERVER_PORT, OUT_SERVER_IP, function () {
    console.log('管道已连接.');
});
let halfUint8 = new Uint8Array();
outclient.on('data', (data) => {
    const packs = sp.decode(Uint8Array.of(...halfUint8, ...data));
    halfUint8 = new Uint8Array();
    packs.forEach(pack => {
        if (pack.type === 'full') {
            console.log(`代理连接 ${pack.tag} 发送数据 ${++chunkSendNum}` );
            buildClient(pack.tag);
            inclientMap[pack.tag] && inclientMap[pack.tag].write(Buffer.from(pack.payload));
        } else if (pack.type === 'half') {
            halfUint8 = pack.bytes;
        }
    });
});

outclient.on('close', () => {
    clearTimeout(timeout)
    timeout = setTimeout(() => {
        console.log('管道连接断开\n')
        outclient.connect(OUT_SERVER_PORT, OUT_SERVER_IP);
    }, 5000)
});
outclient.on('connect', function() {
    console.log('管道连接/重连')
});
outclient.on('error', (err) => console.log(err));
outclient.on('timeout', () => {
    outclient.write('w')
    console.log('管道连接超时')
});
setInterval(() => {
    outclient.write('w')
},3000)
const buildClient = (addr) => {
    if (!inclientMap[addr]) {
        const inclient = new net.Socket();
        console.log(`创建代理连接 ${addr}`);
        inclientMap[addr] = inclient;

        inclient.connect(IN_SERVER_PORT, IN_SERVER_IP, function () {
            console.log(`代理连接 ${addr} 连接成功`);
        });
        inclient.on('data', (data) => {
            console.log(`代理连接 ${addr} 接收数据 ${++chunkRevNum} : ${data.length
            }`);
            outclient.write(Buffer.from(sp.encode(addr, data)));
        });
        inclient.on('close', () => {
            delete inclientMap[addr];
            console.log(`代理连接 ${addr} 关闭`);
        });
        inclient.on('error', function (err) {
            console.log(`代理连接 ${addr} 异常`);
            console.error(err)
        });
    }
}

process.on('uncaughtException', (err) => {
  console.log("======uncaughtException_start")
  console.log(err)
  console.log("======uncaughtException_end")
});