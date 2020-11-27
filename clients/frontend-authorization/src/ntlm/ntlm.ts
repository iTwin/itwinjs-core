/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/*
 * Code below adapted from https://github.com/erlandranvinge/ntlm.js/
 */
// NTLM (ntlm.js) authentication in JavaScript.
// ------------------------------------------------------------------------
// The MIT License (MIT). Copyright (c) 2012 Erland Ranvinge.
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to
// the following conditions:
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// cspell:ignore chrsz binl
/* eslint-disable prefer-template,@typescript-eslint/naming-convention */
class Msg {
  private _data: number[];

  public constructor(data?: string) {
    this._data = [];
    if (!data) return;
    if (data.indexOf("NTLM ") === 0) data = data.substr(5);
    atob(data).split("").map((c: string) => this._data.push(c.charCodeAt(0)));
  }

  public addByte(b: number) {
    this._data.push(b);
  }

  public addShort(s: number) {
    this._data.push(s & 0xFF);
    this._data.push((s >> 8) & 0xFF);
  }

  public addString(str: string, utf16?: boolean) {
    if (utf16) // Fake UTF16 by padding each character in string.
      str = str.split("").map((c) => c + "\0").join("");

    for (let i = 0; i < str.length; i++)
      this._data.push(str.charCodeAt(i));
  }

  public getString(offset: number, length: number) {
    let result = "";
    for (let i = 0; i < length; i++) {
      if (offset + i >= this._data.length)
        return "";
      result += String.fromCharCode(this._data[offset + i]);
    }
    return result;
  }

  public getByte(offset: number) {
    return this._data[offset];
  }

  public toBase64() {
    const str = String.fromCharCode.apply(null, this._data);
    return btoa(str).replace(/.{76}(?=.)/g, "$&");
  }
}

/**
 * Utility to use NTLM based authentication and make queries
 * Adapted from https://github.com/erlandranvinge/ntlm.js/
 * @example
 * Ntlm.setCredentials('domain', 'username', 'password');
 * const url = 'http://myserver.com/secret.txt';
 *
 * try {
 *   await Ntlm.authenticate(url);
 * } catch (err) {
 *   // Authentication error
 *   console.log(err.message);
 * }
 *
 * const response = await fetch(url);
 * const json = await response.json();
 * console.log(JSON.stringify(json));
 *   // => My super secret message stored on server.
 *
 * @internal
 */
export class Ntlm {
  private static _lmHashedPassword: string;
  private static _ntHashedPassword: string;
  private static _domain: string;
  private static _username: string;

  private static error(msg: string) {
    console.error(msg); // eslint-disable-line no-console
  }

  private static createMessage1(hostname: string) {
    const msg1 = new Msg();
    msg1.addString("NTLMSSP\0");
    msg1.addByte(1);
    msg1.addString("\0\0\0");
    msg1.addShort(0xb203);
    msg1.addString("\0\0");
    msg1.addShort(this._domain.length);
    msg1.addShort(this._domain.length);
    msg1.addShort(32 + hostname.length);
    msg1.addString("\0\0");
    msg1.addShort(hostname.length);
    msg1.addShort(hostname.length);
    msg1.addShort(32);
    msg1.addString("\0\0");
    msg1.addString(hostname.toUpperCase());
    msg1.addString(this._domain.toUpperCase());
    return msg1;
  }

  private static getChallenge(data: string) {
    const msg2 = new Msg(data);
    if (msg2.getString(0, 8) !== "NTLMSSP\0") {
      this.error("Invalid NTLM response header.");
      return "";
    }
    if (msg2.getByte(8) !== 2) {
      this.error("Invalid NTLM response type.");
      return "";
    }
    const challenge = msg2.getString(24, 8);
    return challenge;
  }

  private static createMessage3(challenge: string, hostname: string) {
    const lmResponse = this.buildResponse(this._lmHashedPassword, challenge);
    const ntResponse = this.buildResponse(this._ntHashedPassword, challenge);
    const username = this._username;
    const domain = this._domain;
    const msg3 = new Msg();

    msg3.addString("NTLMSSP\0");
    msg3.addByte(3);
    msg3.addString("\0\0\0");

    msg3.addShort(24); // lmResponse
    msg3.addShort(24);
    msg3.addShort(64 + (domain.length + username.length + hostname.length) * 2);
    msg3.addString("\0\0");

    msg3.addShort(24); // ntResponse
    msg3.addShort(24);
    msg3.addShort(88 + (domain.length + username.length + hostname.length) * 2);
    msg3.addString("\0\0");

    msg3.addShort(domain.length * 2); // Domain.
    msg3.addShort(domain.length * 2);
    msg3.addShort(64);
    msg3.addString("\0\0");

    msg3.addShort(username.length * 2); // Username.
    msg3.addShort(username.length * 2);
    msg3.addShort(64 + domain.length * 2);
    msg3.addShort(0x00); // NEEDS_WORK: Confirm

    msg3.addShort(hostname.length * 2); // Hostname.
    msg3.addShort(hostname.length * 2);
    msg3.addShort(64 + (domain.length + username.length) * 2);
    msg3.addString("\0\0");

    msg3.addString("\0\0\0\0");
    msg3.addShort(112 + (domain.length + username.length + hostname.length) * 2);
    msg3.addString("\0\0");
    msg3.addShort(0x8201);
    msg3.addString("\0\0");

    msg3.addString(domain.toUpperCase(), true); // "Some" string are passed as UTF-16.
    msg3.addString(username, true);
    msg3.addString(hostname.toUpperCase(), true);
    msg3.addString(lmResponse);
    msg3.addString(ntResponse);

    return msg3;
  }

  private static createKey(str: string) {
    const key56: number[] = [];
    while (str.length < 7) str += "\0";
    str = str.substr(0, 7);
    str.split("").map((c) => key56.push(c.charCodeAt(0)));
    const key = [0, 0, 0, 0, 0, 0, 0, 0];
    key[0] = key56[0]; // Convert 56 bit key to 64 bit.
    key[1] = ((key56[0] << 7) & 0xFF) | (key56[1] >> 1);
    key[2] = ((key56[1] << 6) & 0xFF) | (key56[2] >> 2);
    key[3] = ((key56[2] << 5) & 0xFF) | (key56[3] >> 3);
    key[4] = ((key56[3] << 4) & 0xFF) | (key56[4] >> 4);
    key[5] = ((key56[4] << 3) & 0xFF) | (key56[5] >> 5);
    key[6] = ((key56[5] << 2) & 0xFF) | (key56[6] >> 6);
    key[7] = (key56[6] << 1) & 0xFF;
    for (let i = 0; i < key.length; i++) { // Fix DES key parity bits.
      let bit = 0;
      for (let k = 0; k < 7; k++) {
        const t = key[i] >> k;
        bit = (t ^ bit) & 0x1;
      }
      key[i] = (key[i] & 0xFE) | bit;
    }

    let result = "";
    key.map((i) => result += String.fromCharCode(i));
    return result;
  }

  private static buildResponse(key: string, text: string) {
    while (key.length < 21)
      key += "\0";
    const key1 = this.createKey(key.substr(0, 7));
    const key2 = this.createKey(key.substr(7, 7));
    const key3 = this.createKey(key.substr(14, 7));
    return des(key1, text, 1, 0) + des(key2, text, 1, 0) + des(key3, text, 1, 0);
  }

  private static getLocation(url: string) {
    const l = document.createElement("a");
    l.href = url;
    return l;
  }

  /** Sets the credentials for NTLM based authentication */
  public static setCredentials(domain: string, username: string, password: string): void {
    const magic = "KGS!@#$%"; // Create LM password hash.
    let lmPassword = password.toUpperCase().substr(0, 14);
    while (lmPassword.length < 14)
      lmPassword += "\0";
    const key1 = this.createKey(lmPassword);
    const key2 = this.createKey(lmPassword.substr(7));
    const lmHashedPassword = des(key1, magic, 1, 0) + des(key2, magic, 1, 0);

    let ntPassword = ""; // Create NT password hash.
    for (let i = 0; i < password.length; i++)
      ntPassword += password.charAt(i) + "\0";
    const ntHashedPassword = str_md4(ntPassword);

    this._domain = domain;
    this._username = username;
    this._lmHashedPassword = lmHashedPassword;
    this._ntHashedPassword = ntHashedPassword;
  }

  /**
   * Performs NTLM based authentication
   * @param url URL end point that will trigger authentication
   * @throws Error on authentication error
   * @note
   * - Must call [Ntlm.setCredentials] before calling this method
   * - After successful authentication use fetch to make requests
   */
  public static async authenticate(url: string): Promise<void> {
    if (!this._domain || !this._username || !this._lmHashedPassword || !this._ntHashedPassword)
      throw new Error("Authentication error: No NTLM credentials specified");

    const hostname = this.getLocation(url).hostname;
    const msg1 = this.createMessage1(hostname);
    const token1 = "NTLM " + msg1.toBase64();
    const response = await fetch(url, {
      method: "GET", mode: "cors", headers: {
        Authorization: token1,
      },
    });
    const authHeader = response.headers.get("WWW-Authenticate");
    const challenge = this.getChallenge(authHeader!);

    const msg3 = this.createMessage3(challenge, hostname);
    const token2 = "NTLM " + msg3.toBase64();
    const response2 = await fetch(url, {
      method: "GET", mode: "cors", headers: {
        Authorization: token2,
      },
    });
    if (response2.status !== 200)
      throw new Error(`Authentication error: ${response2.status}:${response2.statusText}`);
  }
}

/*
 * A JavaScript implementation of the RSA Data Security, Inc. MD4 Message
 * Digest Algorithm, as defined in RFC 1320.
 * Version 2.1 Copyright (C) Jerrad Pierce, Paul Johnston 1999 - 2002.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for more info.
 */

const chrsz = 8;

function str_md4(s: string) { return binl2str(core_md4(str2binl(s), s.length * chrsz)); }

function core_md4(x: number[], len: number) {
  x[len >> 5] |= 0x80 << (len % 32);
  x[(((len + 64) >>> 9) << 4) + 14] = len;

  let a = 1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d = 271733878;

  for (let i = 0; i < x.length; i += 16) {
    const oldA = a;
    const oldB = b;
    const oldC = c;
    const oldD = d;

    a = md4_ff(a, b, c, d, x[i + 0], 3);
    d = md4_ff(d, a, b, c, x[i + 1], 7);
    c = md4_ff(c, d, a, b, x[i + 2], 11);
    b = md4_ff(b, c, d, a, x[i + 3], 19);
    a = md4_ff(a, b, c, d, x[i + 4], 3);
    d = md4_ff(d, a, b, c, x[i + 5], 7);
    c = md4_ff(c, d, a, b, x[i + 6], 11);
    b = md4_ff(b, c, d, a, x[i + 7], 19);
    a = md4_ff(a, b, c, d, x[i + 8], 3);
    d = md4_ff(d, a, b, c, x[i + 9], 7);
    c = md4_ff(c, d, a, b, x[i + 10], 11);
    b = md4_ff(b, c, d, a, x[i + 11], 19);
    a = md4_ff(a, b, c, d, x[i + 12], 3);
    d = md4_ff(d, a, b, c, x[i + 13], 7);
    c = md4_ff(c, d, a, b, x[i + 14], 11);
    b = md4_ff(b, c, d, a, x[i + 15], 19);

    a = md4_gg(a, b, c, d, x[i + 0], 3);
    d = md4_gg(d, a, b, c, x[i + 4], 5);
    c = md4_gg(c, d, a, b, x[i + 8], 9);
    b = md4_gg(b, c, d, a, x[i + 12], 13);
    a = md4_gg(a, b, c, d, x[i + 1], 3);
    d = md4_gg(d, a, b, c, x[i + 5], 5);
    c = md4_gg(c, d, a, b, x[i + 9], 9);
    b = md4_gg(b, c, d, a, x[i + 13], 13);
    a = md4_gg(a, b, c, d, x[i + 2], 3);
    d = md4_gg(d, a, b, c, x[i + 6], 5);
    c = md4_gg(c, d, a, b, x[i + 10], 9);
    b = md4_gg(b, c, d, a, x[i + 14], 13);
    a = md4_gg(a, b, c, d, x[i + 3], 3);
    d = md4_gg(d, a, b, c, x[i + 7], 5);
    c = md4_gg(c, d, a, b, x[i + 11], 9);
    b = md4_gg(b, c, d, a, x[i + 15], 13);

    a = md4_hh(a, b, c, d, x[i + 0], 3);
    d = md4_hh(d, a, b, c, x[i + 8], 9);
    c = md4_hh(c, d, a, b, x[i + 4], 11);
    b = md4_hh(b, c, d, a, x[i + 12], 15);
    a = md4_hh(a, b, c, d, x[i + 2], 3);
    d = md4_hh(d, a, b, c, x[i + 10], 9);
    c = md4_hh(c, d, a, b, x[i + 6], 11);
    b = md4_hh(b, c, d, a, x[i + 14], 15);
    a = md4_hh(a, b, c, d, x[i + 1], 3);
    d = md4_hh(d, a, b, c, x[i + 9], 9);
    c = md4_hh(c, d, a, b, x[i + 5], 11);
    b = md4_hh(b, c, d, a, x[i + 13], 15);
    a = md4_hh(a, b, c, d, x[i + 3], 3);
    d = md4_hh(d, a, b, c, x[i + 11], 9);
    c = md4_hh(c, d, a, b, x[i + 7], 11);
    b = md4_hh(b, c, d, a, x[i + 15], 15);

    a = safe_add(a, oldA);
    b = safe_add(b, oldB);
    c = safe_add(c, oldC);
    d = safe_add(d, oldD);

  }
  return [a, b, c, d];
}

function md4_cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
  return safe_add(rol(safe_add(safe_add(a, q), safe_add(x, t)), s), b);
}
function md4_ff(a: number, b: number, c: number, d: number, x: number, s: number) {
  return md4_cmn((b & c) | ((~b) & d), a, 0, x, s, 0);
}
function md4_gg(a: number, b: number, c: number, d: number, x: number, s: number) {
  return md4_cmn((b & c) | (b & d) | (c & d), a, 0, x, s, 1518500249);
}
function md4_hh(a: number, b: number, c: number, d: number, x: number, s: number) {
  return md4_cmn(b ^ c ^ d, a, 0, x, s, 1859775393);
}

function safe_add(x: number, y: number) {
  const lsw = (x & 0xFFFF) + (y & 0xFFFF);
  const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xFFFF);
}

function rol(num: number, cnt: number) {
  return (num << cnt) | (num >>> (32 - cnt));
}

function str2binl(str: string) {
  const bin = new Array<number>();
  const mask = (1 << chrsz) - 1;
  for (let i = 0; i < str.length * chrsz; i += chrsz)
    bin[i >> 5] |= (str.charCodeAt(i / chrsz) & mask) << (i % 32);
  return bin;
}

function binl2str(bin: number[]) {
  let str = "";
  const mask = (1 << chrsz) - 1;
  for (let i = 0; i < bin.length * 32; i += chrsz)
    str += String.fromCharCode((bin[i >> 5] >>> (i % 32)) & mask);
  return str;
}

// Paul Tero, July 2001
// http://www.tero.co.uk/des/
//
// Optimized for performance with large blocks by Michael Hayworth, November 2001
// http://www.netdealing.com
//
// THIS SOFTWARE IS PROVIDED "AS IS" AND
// ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED.  IN NO EVENT SHALL THE AUTHOR OR CONTRIBUTORS BE LIABLE
// FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
// DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
// OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
// HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
// LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY
// OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
// SUCH DAMAGE.

// des
// this takes the key, the message, and whether to encrypt or decrypt
function des(key: string, message: string, encrypt: number, mode: number, iv?: string, padding?: number) {
  // declaring this locally speeds things up a bit
  const spFunction1 = [0x1010400, 0, 0x10000, 0x1010404, 0x1010004, 0x10404, 0x4, 0x10000, 0x400, 0x1010400, 0x1010404, 0x400, 0x1000404, 0x1010004, 0x1000000, 0x4, 0x404, 0x1000400, 0x1000400, 0x10400, 0x10400, 0x1010000, 0x1010000, 0x1000404, 0x10004, 0x1000004, 0x1000004, 0x10004, 0, 0x404, 0x10404, 0x1000000, 0x10000, 0x1010404, 0x4, 0x1010000, 0x1010400, 0x1000000, 0x1000000, 0x400, 0x1010004, 0x10000, 0x10400, 0x1000004, 0x400, 0x4, 0x1000404, 0x10404, 0x1010404, 0x10004, 0x1010000, 0x1000404, 0x1000004, 0x404, 0x10404, 0x1010400, 0x404, 0x1000400, 0x1000400, 0, 0x10004, 0x10400, 0, 0x1010004];
  const spFunction2 = [-0x7fef7fe0, -0x7fff8000, 0x8000, 0x108020, 0x100000, 0x20, -0x7fefffe0, -0x7fff7fe0, -0x7fffffe0, -0x7fef7fe0, -0x7fef8000, -0x80000000, -0x7fff8000, 0x100000, 0x20, -0x7fefffe0, 0x108000, 0x100020, -0x7fff7fe0, 0, -0x80000000, 0x8000, 0x108020, -0x7ff00000, 0x100020, -0x7fffffe0, 0, 0x108000, 0x8020, -0x7fef8000, -0x7ff00000, 0x8020, 0, 0x108020, -0x7fefffe0, 0x100000, -0x7fff7fe0, -0x7ff00000, -0x7fef8000, 0x8000, -0x7ff00000, -0x7fff8000, 0x20, -0x7fef7fe0, 0x108020, 0x20, 0x8000, -0x80000000, 0x8020, -0x7fef8000, 0x100000, -0x7fffffe0, 0x100020, -0x7fff7fe0, -0x7fffffe0, 0x100020, 0x108000, 0, -0x7fff8000, 0x8020, -0x80000000, -0x7fefffe0, -0x7fef7fe0, 0x108000];
  const spFunction3 = [0x208, 0x8020200, 0, 0x8020008, 0x8000200, 0, 0x20208, 0x8000200, 0x20008, 0x8000008, 0x8000008, 0x20000, 0x8020208, 0x20008, 0x8020000, 0x208, 0x8000000, 0x8, 0x8020200, 0x200, 0x20200, 0x8020000, 0x8020008, 0x20208, 0x8000208, 0x20200, 0x20000, 0x8000208, 0x8, 0x8020208, 0x200, 0x8000000, 0x8020200, 0x8000000, 0x20008, 0x208, 0x20000, 0x8020200, 0x8000200, 0, 0x200, 0x20008, 0x8020208, 0x8000200, 0x8000008, 0x200, 0, 0x8020008, 0x8000208, 0x20000, 0x8000000, 0x8020208, 0x8, 0x20208, 0x20200, 0x8000008, 0x8020000, 0x8000208, 0x208, 0x8020000, 0x20208, 0x8, 0x8020008, 0x20200];
  const spFunction4 = [0x802001, 0x2081, 0x2081, 0x80, 0x802080, 0x800081, 0x800001, 0x2001, 0, 0x802000, 0x802000, 0x802081, 0x81, 0, 0x800080, 0x800001, 0x1, 0x2000, 0x800000, 0x802001, 0x80, 0x800000, 0x2001, 0x2080, 0x800081, 0x1, 0x2080, 0x800080, 0x2000, 0x802080, 0x802081, 0x81, 0x800080, 0x800001, 0x802000, 0x802081, 0x81, 0, 0, 0x802000, 0x2080, 0x800080, 0x800081, 0x1, 0x802001, 0x2081, 0x2081, 0x80, 0x802081, 0x81, 0x1, 0x2000, 0x800001, 0x2001, 0x802080, 0x800081, 0x2001, 0x2080, 0x800000, 0x802001, 0x80, 0x800000, 0x2000, 0x802080];
  const spFunction5 = [0x100, 0x2080100, 0x2080000, 0x42000100, 0x80000, 0x100, 0x40000000, 0x2080000, 0x40080100, 0x80000, 0x2000100, 0x40080100, 0x42000100, 0x42080000, 0x80100, 0x40000000, 0x2000000, 0x40080000, 0x40080000, 0, 0x40000100, 0x42080100, 0x42080100, 0x2000100, 0x42080000, 0x40000100, 0, 0x42000000, 0x2080100, 0x2000000, 0x42000000, 0x80100, 0x80000, 0x42000100, 0x100, 0x2000000, 0x40000000, 0x2080000, 0x42000100, 0x40080100, 0x2000100, 0x40000000, 0x42080000, 0x2080100, 0x40080100, 0x100, 0x2000000, 0x42080000, 0x42080100, 0x80100, 0x42000000, 0x42080100, 0x2080000, 0, 0x40080000, 0x42000000, 0x80100, 0x2000100, 0x40000100, 0x80000, 0, 0x40080000, 0x2080100, 0x40000100];
  const spFunction6 = [0x20000010, 0x20400000, 0x4000, 0x20404010, 0x20400000, 0x10, 0x20404010, 0x400000, 0x20004000, 0x404010, 0x400000, 0x20000010, 0x400010, 0x20004000, 0x20000000, 0x4010, 0, 0x400010, 0x20004010, 0x4000, 0x404000, 0x20004010, 0x10, 0x20400010, 0x20400010, 0, 0x404010, 0x20404000, 0x4010, 0x404000, 0x20404000, 0x20000000, 0x20004000, 0x10, 0x20400010, 0x404000, 0x20404010, 0x400000, 0x4010, 0x20000010, 0x400000, 0x20004000, 0x20000000, 0x4010, 0x20000010, 0x20404010, 0x404000, 0x20400000, 0x404010, 0x20404000, 0, 0x20400010, 0x10, 0x4000, 0x20400000, 0x404010, 0x4000, 0x400010, 0x20004010, 0, 0x20404000, 0x20000000, 0x400010, 0x20004010];
  const spFunction7 = [0x200000, 0x4200002, 0x4000802, 0, 0x800, 0x4000802, 0x200802, 0x4200800, 0x4200802, 0x200000, 0, 0x4000002, 0x2, 0x4000000, 0x4200002, 0x802, 0x4000800, 0x200802, 0x200002, 0x4000800, 0x4000002, 0x4200000, 0x4200800, 0x200002, 0x4200000, 0x800, 0x802, 0x4200802, 0x200800, 0x2, 0x4000000, 0x200800, 0x4000000, 0x200800, 0x200000, 0x4000802, 0x4000802, 0x4200002, 0x4200002, 0x2, 0x200002, 0x4000000, 0x4000800, 0x200000, 0x4200800, 0x802, 0x200802, 0x4200800, 0x802, 0x4000002, 0x4200802, 0x4200000, 0x200800, 0, 0x2, 0x4200802, 0, 0x200802, 0x4200000, 0x800, 0x4000002, 0x4000800, 0x800, 0x200002];
  const spFunction8 = [0x10001040, 0x1000, 0x40000, 0x10041040, 0x10000000, 0x10001040, 0x40, 0x10000000, 0x40040, 0x10040000, 0x10041040, 0x41000, 0x10041000, 0x41040, 0x1000, 0x40, 0x10040000, 0x10000040, 0x10001000, 0x1040, 0x41000, 0x40040, 0x10040040, 0x10041000, 0x1040, 0, 0, 0x10040040, 0x10000040, 0x10001000, 0x41040, 0x40000, 0x41040, 0x40000, 0x10041000, 0x1000, 0x40, 0x10040040, 0x1000, 0x41040, 0x10001000, 0x40, 0x10000040, 0x10040000, 0x10040040, 0x10000000, 0x40000, 0x10001040, 0, 0x10041040, 0x40040, 0x10000040, 0x10040000, 0x10001000, 0x10001040, 0, 0x10041040, 0x41000, 0x41000, 0x1040, 0x1040, 0x40040, 0x10000000, 0x10041000];

  // create the 16 or 48 sub-keys we will need
  const keys = des_createKeys(key);
  let m = 0, i, j, temp, right1, right2, left, right, looping;
  let cbcLeft: number, cbcLeft2: number, cbcRight: number, cbcRight2: number;
  let endLoop, loopInc;
  let len = message.length;
  let chunk = 0;
  // set up the loops for single and triple des
  const iterations = keys.length === 32 ? 3 : 9; // single or triple des
  if (iterations === 3) {
    looping = encrypt ? [0, 32, 2] : [30, -2, -2];
  } else {
    looping = encrypt ? [0, 32, 2, 62, 30, -2, 64, 96, 2] : [94, 62, -2, 32, 64, 2, 30, -2, -2];
  }

  // pad the message depending on the padding parameter
  if (padding === 2) message += "        "; // pad the message with spaces
  else if (padding === 1) { // PKCS7 padding
    temp = 8 - (len % 8); message += String.fromCharCode(temp, temp, temp, temp, temp, temp, temp, temp);
    if (temp === 8)
      len += 8;
  } else if (!padding) {
    message += "\0\0\0\0\0\0\0\0"; // pad the message out with null bytes
  }

  // store the result here
  let result = "";
  let tempResult = "";

  if (mode === 1) { // CBC mode
    cbcLeft = (iv!.charCodeAt(m++) << 24) | (iv!.charCodeAt(m++) << 16) | (iv!.charCodeAt(m++) << 8) | iv!.charCodeAt(m++);
    cbcRight = (iv!.charCodeAt(m++) << 24) | (iv!.charCodeAt(m++) << 16) | (iv!.charCodeAt(m++) << 8) | iv!.charCodeAt(m++);
    m = 0;
  }

  // loop through each 64 bit chunk of the message
  while (m < len) {
    left = (message.charCodeAt(m++) << 24) | (message.charCodeAt(m++) << 16) | (message.charCodeAt(m++) << 8) | message.charCodeAt(m++);
    right = (message.charCodeAt(m++) << 24) | (message.charCodeAt(m++) << 16) | (message.charCodeAt(m++) << 8) | message.charCodeAt(m++);

    // for Cipher Block Chaining mode, xor the message with the previous result
    if (mode === 1) {
      if (encrypt) {
        left ^= cbcLeft!; right ^= cbcRight!;
      } else {
        cbcLeft2 = cbcLeft!; cbcRight2 = cbcRight!; cbcLeft = left; cbcRight = right;
      }
    }

    // first each 64 but chunk of the message must be permuted according to IP
    temp = ((left >>> 4) ^ right) & 0x0f0f0f0f; right ^= temp; left ^= (temp << 4);
    temp = ((left >>> 16) ^ right) & 0x0000ffff; right ^= temp; left ^= (temp << 16);
    temp = ((right >>> 2) ^ left) & 0x33333333; left ^= temp; right ^= (temp << 2);
    temp = ((right >>> 8) ^ left) & 0x00ff00ff; left ^= temp; right ^= (temp << 8);
    temp = ((left >>> 1) ^ right) & 0x55555555; right ^= temp; left ^= (temp << 1);

    left = ((left << 1) | (left >>> 31));
    right = ((right << 1) | (right >>> 31));

    // do this either 1 or 3 times for each chunk of the message
    for (j = 0; j < iterations; j += 3) {
      endLoop = looping[j + 1];
      loopInc = looping[j + 2];
      // now go through and perform the encryption or decryption
      for (i = looping[j]; i !== endLoop; i += loopInc) { // for efficiency
        right1 = right ^ keys[i];
        right2 = ((right >>> 4) | (right << 28)) ^ keys[i + 1];
        // the result is attained by passing these bytes through the S selection functions
        temp = left;
        left = right;
        right = temp ^ (spFunction2[(right1 >>> 24) & 0x3f] | spFunction4[(right1 >>> 16) & 0x3f]
          | spFunction6[(right1 >>> 8) & 0x3f] | spFunction8[right1 & 0x3f]
          | spFunction1[(right2 >>> 24) & 0x3f] | spFunction3[(right2 >>> 16) & 0x3f]
          | spFunction5[(right2 >>> 8) & 0x3f] | spFunction7[right2 & 0x3f]);
      }
      temp = left; left = right; right = temp; // un-reverse left and right
    } // for either 1 or 3 iterations

    // move then each one bit to the right
    left = ((left >>> 1) | (left << 31));
    right = ((right >>> 1) | (right << 31));

    // now perform IP-1, which is IP in the opposite direction
    temp = ((left >>> 1) ^ right) & 0x55555555; right ^= temp; left ^= (temp << 1);
    temp = ((right >>> 8) ^ left) & 0x00ff00ff; left ^= temp; right ^= (temp << 8);
    temp = ((right >>> 2) ^ left) & 0x33333333; left ^= temp; right ^= (temp << 2);
    temp = ((left >>> 16) ^ right) & 0x0000ffff; right ^= temp; left ^= (temp << 16);
    temp = ((left >>> 4) ^ right) & 0x0f0f0f0f; right ^= temp; left ^= (temp << 4);

    // for Cipher Block Chaining mode, xor the message with the previous result
    if (mode === 1) { if (encrypt) { cbcLeft = left; cbcRight = right; } else { left ^= cbcLeft2!; right ^= cbcRight2!; } }
    tempResult += String.fromCharCode((left >>> 24), ((left >>> 16) & 0xff), ((left >>> 8) & 0xff), (left & 0xff), (right >>> 24), ((right >>> 16) & 0xff), ((right >>> 8) & 0xff), (right & 0xff));

    chunk += 8;
    if (chunk === 512) { result += tempResult; tempResult = ""; chunk = 0; }
  } // for every 8 characters, or 64 bits in the message

  // return the result as an array
  return result + tempResult;
} // end of des

// des_createKeys
// this takes as input a 64 bit key (even though only 56 bits are used)
// as an array of 2 integers, and returns 16 48 bit keys
function des_createKeys(key: string): number[] {
  // declaring this locally speeds things up a bit
  const pc2bytes0 = new Array<number>(0, 0x4, 0x20000000, 0x20000004, 0x10000, 0x10004, 0x20010000, 0x20010004, 0x200, 0x204, 0x20000200, 0x20000204, 0x10200, 0x10204, 0x20010200, 0x20010204);
  const pc2bytes1 = new Array<number>(0, 0x1, 0x100000, 0x100001, 0x4000000, 0x4000001, 0x4100000, 0x4100001, 0x100, 0x101, 0x100100, 0x100101, 0x4000100, 0x4000101, 0x4100100, 0x4100101);
  const pc2bytes2 = new Array<number>(0, 0x8, 0x800, 0x808, 0x1000000, 0x1000008, 0x1000800, 0x1000808, 0, 0x8, 0x800, 0x808, 0x1000000, 0x1000008, 0x1000800, 0x1000808);
  const pc2bytes3 = new Array<number>(0, 0x200000, 0x8000000, 0x8200000, 0x2000, 0x202000, 0x8002000, 0x8202000, 0x20000, 0x220000, 0x8020000, 0x8220000, 0x22000, 0x222000, 0x8022000, 0x8222000);
  const pc2bytes4 = new Array<number>(0, 0x40000, 0x10, 0x40010, 0, 0x40000, 0x10, 0x40010, 0x1000, 0x41000, 0x1010, 0x41010, 0x1000, 0x41000, 0x1010, 0x41010);
  const pc2bytes5 = new Array<number>(0, 0x400, 0x20, 0x420, 0, 0x400, 0x20, 0x420, 0x2000000, 0x2000400, 0x2000020, 0x2000420, 0x2000000, 0x2000400, 0x2000020, 0x2000420);
  const pc2bytes6 = new Array<number>(0, 0x10000000, 0x80000, 0x10080000, 0x2, 0x10000002, 0x80002, 0x10080002, 0, 0x10000000, 0x80000, 0x10080000, 0x2, 0x10000002, 0x80002, 0x10080002);
  const pc2bytes7 = new Array<number>(0, 0x10000, 0x800, 0x10800, 0x20000000, 0x20010000, 0x20000800, 0x20010800, 0x20000, 0x30000, 0x20800, 0x30800, 0x20020000, 0x20030000, 0x20020800, 0x20030800);
  const pc2bytes8 = new Array<number>(0, 0x40000, 0, 0x40000, 0x2, 0x40002, 0x2, 0x40002, 0x2000000, 0x2040000, 0x2000000, 0x2040000, 0x2000002, 0x2040002, 0x2000002, 0x2040002);
  const pc2bytes9 = new Array<number>(0, 0x10000000, 0x8, 0x10000008, 0, 0x10000000, 0x8, 0x10000008, 0x400, 0x10000400, 0x408, 0x10000408, 0x400, 0x10000400, 0x408, 0x10000408);
  const pc2bytes10 = new Array<number>(0, 0x20, 0, 0x20, 0x100000, 0x100020, 0x100000, 0x100020, 0x2000, 0x2020, 0x2000, 0x2020, 0x102000, 0x102020, 0x102000, 0x102020);
  const pc2bytes11 = new Array<number>(0, 0x1000000, 0x200, 0x1000200, 0x200000, 0x1200000, 0x200200, 0x1200200, 0x4000000, 0x5000000, 0x4000200, 0x5000200, 0x4200000, 0x5200000, 0x4200200, 0x5200200);
  const pc2bytes12 = new Array<number>(0, 0x1000, 0x8000000, 0x8001000, 0x80000, 0x81000, 0x8080000, 0x8081000, 0x10, 0x1010, 0x8000010, 0x8001010, 0x80010, 0x81010, 0x8080010, 0x8081010);
  const pc2bytes13 = new Array<number>(0, 0x4, 0x100, 0x104, 0, 0x4, 0x100, 0x104, 0x1, 0x5, 0x101, 0x105, 0x1, 0x5, 0x101, 0x105);

  // how many iterations (1 for des, 3 for triple des)
  const iterations = key.length > 8 ? 3 : 1; // changed by Paul 16/6/2007 to use Triple DES for 9+ byte keys
  // stores the return keys
  const keys = new Array<number>(32 * iterations);
  // now define the left shifts which need to be done
  const shifts = new Array<number>(0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0);
  // other variables
  let leftTemp, rightTemp, m = 0, n = 0, temp;

  for (let j = 0; j < iterations; j++) { // either 1 or 3 iterations
    let left = (key.charCodeAt(m++) << 24) | (key.charCodeAt(m++) << 16) | (key.charCodeAt(m++) << 8) | key.charCodeAt(m++);
    let right = (key.charCodeAt(m++) << 24) | (key.charCodeAt(m++) << 16) | (key.charCodeAt(m++) << 8) | key.charCodeAt(m++);

    temp = ((left >>> 4) ^ right) & 0x0f0f0f0f; right ^= temp; left ^= (temp << 4);
    temp = ((right >>> -16) ^ left) & 0x0000ffff; left ^= temp; right ^= (temp << -16);
    temp = ((left >>> 2) ^ right) & 0x33333333; right ^= temp; left ^= (temp << 2);
    temp = ((right >>> -16) ^ left) & 0x0000ffff; left ^= temp; right ^= (temp << -16);
    temp = ((left >>> 1) ^ right) & 0x55555555; right ^= temp; left ^= (temp << 1);
    temp = ((right >>> 8) ^ left) & 0x00ff00ff; left ^= temp; right ^= (temp << 8);
    temp = ((left >>> 1) ^ right) & 0x55555555; right ^= temp; left ^= (temp << 1);

    // the right side needs to be shifted and to get the last four bits of the left side
    temp = (left << 8) | ((right >>> 20) & 0x000000f0);
    // left needs to be put upside down
    left = (right << 24) | ((right << 8) & 0xff0000) | ((right >>> 8) & 0xff00) | ((right >>> 24) & 0xf0);
    right = temp;

    // now go through and perform these shifts on the left and right keys
    for (const shift of shifts) {
      // shift the keys either one or two bits to the left
      if (shift) {
        left = (left << 2) | (left >>> 26); right = (right << 2) | (right >>> 26);
      } else {
        left = (left << 1) | (left >>> 27); right = (right << 1) | (right >>> 27);
      }
      left &= -0xf; right &= -0xf;

      // now apply PC-2, in such a way that E is easier when encrypting or decrypting
      // this conversion will look like PC-2 except only the last 6 bits of each byte are used
      // rather than 48 consecutive bits and the order of lines will be according to
      // how the S selection functions will be applied: S2, S4, S6, S8, S1, S3, S5, S7
      leftTemp = pc2bytes0[left >>> 28] | pc2bytes1[(left >>> 24) & 0xf]
        | pc2bytes2[(left >>> 20) & 0xf] | pc2bytes3[(left >>> 16) & 0xf]
        | pc2bytes4[(left >>> 12) & 0xf] | pc2bytes5[(left >>> 8) & 0xf]
        | pc2bytes6[(left >>> 4) & 0xf];
      rightTemp = pc2bytes7[right >>> 28] | pc2bytes8[(right >>> 24) & 0xf]
        | pc2bytes9[(right >>> 20) & 0xf] | pc2bytes10[(right >>> 16) & 0xf]
        | pc2bytes11[(right >>> 12) & 0xf] | pc2bytes12[(right >>> 8) & 0xf]
        | pc2bytes13[(right >>> 4) & 0xf];
      temp = ((rightTemp >>> 16) ^ leftTemp) & 0x0000ffff;
      keys[n++] = leftTemp ^ temp; keys[n++] = rightTemp ^ (temp << 16);
    }
  } // for each iterations
  // return the keys we've created
  return keys;
} // end of des_createKeys
