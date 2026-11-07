// v1.10.85 - the PC's own HTTPS certificate for phone access (phoneAccess.js).
//
// Node can make keys and signatures but not certificates, so the certificate
// is written here in DER by hand (no new package): ECDSA P-256 with SHA-256,
// valid 800 days (Apple refuses more than 825), for server use (extended key
// usage serverAuth), naming this PC's addresses and host name. It is made once
// per books folder and its private key stays in data/phone-access/ (never
// in a backup). Browsers do not know it, so the phone warns once ("Your
// connection is not private"): the user compares its fingerprint with the PC.
//
// Standalone on purpose (Node built-ins only): shipped in the release ZIP.
import crypto from 'crypto';

export const CERT_DAYS = 800;

// ---- a minimal DER writer ----------------------------------------------------
const len = (n) => {
  if (n < 0x80) return Buffer.from([n]);
  const bytes = [];
  for (let v = n; v > 0; v >>= 8) bytes.unshift(v & 0xff);
  return Buffer.from([0x80 | bytes.length, ...bytes]);
};
const tlv = (tag, ...parts) => {
  const body = Buffer.concat(parts.map((p) => (Buffer.isBuffer(p) ? p : Buffer.from(p))));
  return Buffer.concat([Buffer.from([tag]), len(body.length), body]);
};
const seq = (...p) => tlv(0x30, ...p);
const set = (...p) => tlv(0x31, ...p);
const oid = (dotted) => {
  const [a, b, ...rest] = dotted.split('.').map(Number);
  const out = [a * 40 + b];
  for (const n of rest) {
    const chunk = [n & 0x7f];
    for (let v = n >> 7; v > 0; v >>= 7) chunk.unshift(0x80 | (v & 0x7f));
    out.push(...chunk);
  }
  return tlv(0x06, Buffer.from(out));
};
const int = (buf) => tlv(0x02, buf[0] & 0x80 ? Buffer.concat([Buffer.from([0]), buf]) : buf);
const utf8 = (s) => tlv(0x0c, Buffer.from(s, 'utf8'));
const bool = (v) => tlv(0x01, Buffer.from([v ? 0xff : 0]));
const octets = (buf) => tlv(0x04, buf);
const bits = (buf) => tlv(0x03, Buffer.concat([Buffer.from([0]), buf]));
const time = (d) => {
  const iso = d.toISOString().replace(/[-:T]/g, '').slice(0, 14); // YYYYMMDDHHMMSS
  return d.getUTCFullYear() < 2050 ? tlv(0x17, `${iso.slice(2)}Z`) : tlv(0x18, `${iso}Z`);
};
const ext = (id, critical, value) => seq(oid(id), ...(critical ? [bool(true)] : []), octets(value));

const ipBytes = (ip) => {
  const v4 = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip);
  return v4 ? Buffer.from(v4.slice(1).map(Number)) : null;
};

const ECDSA_SHA256 = seq(oid('1.2.840.10045.4.3.2'));

// { names: ['my-pc', 'my-pc.local'], ips: ['192.168.1.20'] } ->
// { key, cert } (PEM) and the certificate's SHA-256 fingerprint.
export function makeSelfSignedCert({ names = [], ips = [], commonName = 'Free GST Billing', days = CERT_DAYS, now = new Date() } = {}) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const serial = crypto.randomBytes(16);
  serial[0] = (serial[0] & 0x7f) | 0x40; // positive, and no leading zero byte (strict DER)
  const name = seq(set(seq(oid('2.5.4.3'), utf8(commonName.slice(0, 64)))));
  const notBefore = new Date(now.getTime() - 24 * 3600 * 1000); // phones whose clock is a little behind
  const notAfter = new Date(now.getTime() + days * 24 * 3600 * 1000);
  const altNames = [
    ...[...new Set(names.map((n) => String(n).toLowerCase()).filter((n) => /^[a-z0-9.-]+$/.test(n)))].map((n) => tlv(0x82, Buffer.from(n, 'ascii'))),
    ...[...new Set(ips)].map(ipBytes).filter(Boolean).map((b) => tlv(0x87, b)),
  ];
  const extensions = [
    ext('2.5.29.19', true, seq()), // basicConstraints: not a CA
    ext('2.5.29.15', true, tlv(0x03, Buffer.from([7, 0x80]))), // keyUsage: digitalSignature (7 unused bits)
    ext('2.5.29.37', false, seq(oid('1.3.6.1.5.5.7.3.1'))), // extKeyUsage: serverAuth
    ...(altNames.length ? [ext('2.5.29.17', false, seq(...altNames))] : []),
  ];
  const tbs = seq(
    tlv(0xa0, int(Buffer.from([2]))), // version 3
    int(serial),
    ECDSA_SHA256,
    name,
    seq(time(notBefore), time(notAfter)),
    name,
    publicKey.export({ type: 'spki', format: 'der' }),
    tlv(0xa3, seq(...extensions)),
  );
  const signature = crypto.sign('sha256', tbs, privateKey); // DER-encoded ECDSA
  const der = seq(tbs, ECDSA_SHA256, bits(signature));
  const cert = `-----BEGIN CERTIFICATE-----\n${der.toString('base64').match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----\n`;
  const key = privateKey.export({ type: 'pkcs8', format: 'pem' });
  return { key, cert, fingerprint256: new crypto.X509Certificate(cert).fingerprint256 };
}

// Still usable: parses, matches its key, and has more than 30 days left.
export function certStillGood(certPem, keyPem, now = Date.now()) {
  try {
    const x = new crypto.X509Certificate(certPem);
    if (!x.checkPrivateKey(crypto.createPrivateKey(keyPem))) return false;
    return new Date(x.validTo).getTime() - now > 30 * 24 * 3600 * 1000;
  } catch {
    return false;
  }
}
