const net = require('net');
const sp = require('./stickPackage')

const IN_CHANNEL_PORT = 8090;
const OUT_CHANNEL_PORT = 8080;

let insock = null;
let outsockMap = {};

const inserver = net.createServer((sock) => {
    insock = sock;
    let halfUint8 = new Uint8Array();
    sock.on('data', function (data) {
        const packs = sp.decode(Uint8Array.of(...halfUint8, ...data));
        halfUint8 = new Uint8Array();
        packs.forEach(pack => {
            if(pack.type === 'full'){
            	try{
                	outsockMap[pack.tag] && outsockMap[pack.tag].write(Buffer.from(pack.payload));
            	}catch(err){
					console.error(`outsock ${pack.tag} broken`,err)
            	}
            }else if(pack.type === 'half'){
                halfUint8 = pack.bytes;
            }
        });
    });


    sock.on('error', function (err) {
        console.error(err)
    });
    sock.on('close', function () {
        insock = null;
        console.log('in closed')
    });
});
inserver.listen(IN_CHANNEL_PORT, () => {
    console.log(`inserver channel listen to ${IN_CHANNEL_PORT}`);
});

const outserver = net.createServer((sock) => {
	console.log(`new connection, ${sock.remoteFamily}#${sock.remoteAddress}:${sock.remotePort}`)
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
        	insock && insock.write(buf);
        }catch(err){
        	console.error('insock broken',err)
        }
    });

    sock.on('error', function (err) {
        console.error(err);
    });
    sock.on('close', function () {
        delete outsockMap[addr];
        console.log(`outsock ${addr} closed`);
    });
});
outserver.listen(OUT_CHANNEL_PORT, () => {
    console.log(`outserver channel listen to ${OUT_CHANNEL_PORT}`);
});

