/**
 * 解决TCP粘包半包问题
 */

const SUM_LEN = 4;
const TAG_LEN = 6;
const encode = (tag, payload = new Uint8Array()) => {
    const length = SUM_LEN + TAG_LEN + payload.byteLength;
    const bytes = [];
    const pairs = tag.split(':');
    const ipUint8 = pairs[0].split('.').map(v => +v);
    const portUint8 = [Math.floor(+pairs[1] / 256), +pairs[1] % 256]
    bytes.push(...num2uint8(length, 4))
    bytes.push(...ipUint8)
    bytes.push(...portUint8)
    bytes.push(...payload)
    return Uint8Array.from(bytes);
}

const num2uint8 = (num, minLength = 0) => {
    const uint8 = [];
    while (num > 0) {
        uint8.unshift(num % 256);
        num = Math.floor(num / 256);
    }
    while (uint8.length < minLength) {
        uint8.unshift(0);
    }
    return uint8;
}

const uint82num = uint8 => {
    return uint8.reduce((a, b) => a * 256 + b);
}

const decode = (bytes = new Uint8Array()) => {
    if (bytes.length < SUM_LEN + TAG_LEN) {
        return [];
    }
    const rslist = [];
    const sum = uint82num(bytes.subarray(0, SUM_LEN));
    const tagUint8 = bytes.subarray(SUM_LEN, SUM_LEN + TAG_LEN);
    const tag = `${tagUint8[0]}.${tagUint8[1]}.${tagUint8[2]}.${tagUint8[3]}:${tagUint8[4] * 256 + tagUint8[5]}`;
    const rs = { sum, tag }
    rslist.push(rs)
    if (bytes.length === sum) {
        rs.type = 'full'
        rs.payload = bytes.subarray(SUM_LEN + TAG_LEN);
    } else if (bytes.length > sum) {
        rs.type = 'full'
        rs.payload = bytes.subarray(SUM_LEN + TAG_LEN, sum);
        rslist.push(...decode(bytes.subarray(sum)));
    } else {
        rs.type = 'half'
        rs.bytes = bytes;
    }
    return rslist;
}

module.exports={
    encode,
    decode
}
// const bytes = encode('127.0.0.1:12345', Uint8Array.of(1, 2, 3, 4, 5))
// const bytes2 = encode('127.0.0.2:12345', Uint8Array.of(1, 2, 3, 4, 5))
// const bytes3 = encode('127.0.0.3:12345', Uint8Array.of(1, 2, 3, 4, 5))
// console.log(bytes)
// console.log(decode(Uint8Array.of(...bytes, 0, 0, 0, 15, 127, 0, 0, 1, 48, 57, 1, 2)))
