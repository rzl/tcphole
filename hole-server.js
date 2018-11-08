const net = require('net');
const sp = require('./stickPackage')
var argv = process.argv.splice(2);
console.log(JSON.stringify(argv))
var IN_CHANNEL_PORT = 8071;
var OUT_CHANNEL_PORT = 8070;

if (argv[0] !== undefined && argv[0] !== "" && parseInt(argv[0])) {
    OUT_CHANNEL_PORT = parseInt(argv[0])
}
if (argv[1] !== undefined && argv[1] !== "" && parseInt(argv[1])) {
    IN_CHANNEL_PORT = parseInt(argv[1])
}
console.log('usage: [外网服务端口] [管道服务端口] \n');
console.log('default: 8070 8071 \n');

let insock = null;
let outsockMap = {};
var chunkRevNum = 0
var chunkSendNum = 0
var heartBeat = 0

const inserver = net.createServer((sock) => {
    sock.setKeepAlive(true,3000)
    insock = sock;
    var halfUint8 = new Uint8Array();
    sock.on('data', function (data) {
        if (data.length ===1 && data.toString() === "w"){
            console.error(`管道数据心跳包 ${++heartBeat} `)
            if (sock.tureSocket === undefined) {
                sock.tureSocket = true
            }
            return;
        }
        if (insock === undefined || !insock.tureSocket) {
            insock = sock
            return;
        }
        console.log("---管道数据接收"  + ++chunkRevNum )
        var packs
        try {
            packs = sp.decode(Uint8Array.of(...halfUint8, ...data));
        } catch(err) {
            halfUint8 = new Uint8Array()
            return
        }
        console.log(packs[0] != undefined ? packs[0].tag : "")
        console.log(packs[0] != undefined ? packs[0].sum : "")
        //console.log("---管道数据接收" + packs[0] != undefined ? packs[0].tag : "" + ":" + ++chunkRevNum)
        halfUint8 = new Uint8Array();
        packs.forEach(pack => {
            if(pack.type === 'full'){
            	try{
                    console.log(pack.tag)
                	outsockMap[pack.tag] && outsockMap[pack.tag].write(Buffer.from(pack.payload));
            	}catch(err){
					console.error(`管道数据接收异常 ${pack.tag} broken`,err)
            	}
            }else if(pack.type === 'half'){
                if (outsockMap[pack.tag]) {
                    halfUint8 = pack.bytes;
                } else {
                    halfUint8 = new Uint8Array();
                    console.error(`管道数据接收异常 ${pack.tag} broken pack length ${pack.sum}`)
                }
            }
        });
    });
    sock.on('error', function (err) {
        console.log('管道服务异常')
        console.error(err)
    });
    sock.on('close', function () {
        insock = null;
        console.log('管道客户端端口连接')
    });
});
inserver.on('connection', function (socket) {
    console.log('管道服客户端上线')
});
inserver.listen(IN_CHANNEL_PORT, () => {
    console.log('客户端管道连接端口: ' + IN_CHANNEL_PORT + "\n");
    //console.log(`inserver channel listen to ${IN_CHANNEL_PORT}`);
});

const outserver = net.createServer((sock) => {
	console.log(`外网服务器客户连接, ${sock.remoteFamily}#${sock.remoteAddress}:${sock.remotePort}`)
    let ipv4 = sock.remoteFamily === 'IPv4' && sock.remoteAddress ;
    if(!ipv4){
    	if(sock.remoteAddress && sock.remoteAddress.indexOf('::ffff:') > -1){
    		ipv4 = sock.remoteAddress.substring('::ffff:'.length)
    	}else{
    		ipv4 = '0.0.0.0';
    	}
    }
    const addr = `${ipv4}:${sock.remotePort}`;
    outsockMap[addr] = sock;
    sock.on('data', function (data) {
        const buf = Buffer.from(sp.encode(addr,data));
        try{
        	if (insock) {
                console.log("--管道数据发送" + addr + ":" + ++chunkSendNum)
                insock.write(buf)
            };
        }catch(err){
        	console.error('管道数据发送异常',err)
        }
    });

    sock.on('error', function (err) {
        console.error(err);
    });
    sock.on('close', function () {
        delete outsockMap[addr];
        console.log(`外网服务器客户断开 ${addr} close` );
    });
});
outserver.listen(OUT_CHANNEL_PORT, () => {
    console.log('外网服务器应用端口: ' + OUT_CHANNEL_PORT + "\n");
    //console.log(`outserver channel listen to ${OUT_CHANNEL_PORT}`);
});

process.on('uncaughtException', (err) => {
  console.log("======uncaughtException_start")
  console.log(err)
  console.log("======uncaughtException_end")
});