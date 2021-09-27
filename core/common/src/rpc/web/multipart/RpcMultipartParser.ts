/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

/*
Adapted from https://github.com/pillarjs/multiparty. Multiparty license as follows:
(The MIT License)

Copyright (c) 2013 Felix Geisendörfer
Copyright (c) 2014 Andrew Kelley
Copyright (c) 2014 Douglas Christopher Wilson

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
import { StringDecoder } from "string_decoder";
import { RpcSerializedValue } from "../../core/RpcMarshaling";

const START = 0;
const START_BOUNDARY = 1;
const HEADER_FIELD_START = 2;
const HEADER_FIELD = 3;
const HEADER_VALUE_START = 4;
const HEADER_VALUE = 5;
const HEADER_VALUE_ALMOST_DONE = 6;
const HEADERS_ALMOST_DONE = 7;
const PART_DATA_START = 8;
const PART_DATA = 9;
const CLOSE_BOUNDARY = 10;
const END = 11;

const LF = 10;
const CR = 13;
const SPACE = 32;
const HYPHEN = 45;
const COLON = 58;
const A = 97;
const Z = 122;

const CONTENT_TYPE_RE = /^multipart\/(?:form-data|related)(?:;|$)/i;
const CONTENT_TYPE_PARAM_RE = /;\s*([^=]+)=(?:"([^"]+)"|([^;]+))/gi;

/** @internal */
export class RpcMultipartParser {
  private _headerFieldMark: number | null;
  private _headerValueMark: number | null;
  private _partDataMark: number | null;
  private _partBoundaryFlag: boolean;
  private _headerFieldDecoder: StringDecoder | null;
  private _headerValueDecoder: StringDecoder | null;
  private _headerField: string;
  private _partHeaders: { [index: string]: string };
  private _partName: string | null;
  private _partChunks: Buffer[];
  private _headerValue: string;
  private _boundary: string;
  private _buffer: Buffer;
  private _value: RpcSerializedValue;

  public constructor(contentType: string, buffer: Buffer) {
    let m = CONTENT_TYPE_RE.exec(contentType);
    if (!m) {
      throw new Error("unsupported content-type");
    }

    let boundary = "";
    CONTENT_TYPE_PARAM_RE.lastIndex = m.index + m[0].length - 1;
    while ((m = CONTENT_TYPE_PARAM_RE.exec(contentType))) {
      if (m[1].toLowerCase() !== "boundary") continue;
      boundary = m[2] || m[3];
      break;
    }

    if (!boundary) {
      throw new Error("content-type missing boundary");
    }

    this._headerFieldDecoder = null;
    this._headerValueDecoder = null;
    this._headerField = "";
    this._partHeaders = {};
    this._partName = null;
    this._partChunks = [];
    this._headerValue = "";

    this._headerFieldMark = null;
    this._headerValueMark = null;
    this._partDataMark = null;
    this._partBoundaryFlag = false;

    this._boundary = boundary;
    this._buffer = buffer;
    this._value = RpcSerializedValue.create();
  }

  public parse(): RpcSerializedValue {
    let i = 0;
    const len = this._buffer.length;
    let prevIndex = 0;
    let index = 0;
    let state = START;

    const boundary = Buffer.alloc(this._boundary.length + 4);
    boundary.write("\r\n--", 0, this._boundary.length + 4, "ascii");
    boundary.write(this._boundary, 4, this._boundary.length, "ascii");

    const boundaryChars: { [index: number]: boolean } = {};
    for (const char of boundary) {
      boundaryChars[char] = true;
    }

    const boundaryLength = boundary.length;
    const boundaryEnd = boundaryLength - 1;
    const bufferLength = this._buffer.length;
    const lookbehind = Buffer.alloc(boundaryLength + 8);

    let c;
    let cl;

    for (i = 0; i < len; i++) {
      c = this._buffer[i];
      switch (state) {
        case START:
          index = 0;
          state = START_BOUNDARY;
        /* falls through */
        case START_BOUNDARY:
          if (index === boundaryLength - 2 && c === HYPHEN) {
            index = 1;
            state = CLOSE_BOUNDARY;
            break;
          } else if (index === boundaryLength - 2) {
            if (c !== CR) throw new Error(`Expected CR Received ${c}`);
            index++;
            break;
          } else if (index === boundaryLength - 1) {
            if (c !== LF) throw new Error(`Expected LF Received ${c}`);
            index = 0;
            this._onParsePartBegin();
            state = HEADER_FIELD_START;
            break;
          }

          if (c !== boundary[index + 2]) index = -2;
          if (c === boundary[index + 2]) index++;
          break;
        case HEADER_FIELD_START:
          state = HEADER_FIELD;
          this._headerFieldMark = i;
          index = 0;
        /* falls through */
        case HEADER_FIELD:
          if (c === CR) {
            this._headerFieldMark = null;
            state = HEADERS_ALMOST_DONE;
            break;
          }

          index++;
          if (c === HYPHEN) break;

          if (c === COLON) {
            if (index === 1) {
              // empty header field
              throw new Error("Empty header field");
            }
            this._onParseHeaderField(this._buffer.slice(this._headerFieldMark as number, i));
            this._headerFieldMark = null;
            state = HEADER_VALUE_START;
            break;
          }

          cl = c | 0x20;
          if (cl < A || cl > Z) {
            throw new Error(`Expected alphabetic character, received ${c}`);
          }
          break;
        case HEADER_VALUE_START:
          if (c === SPACE) break;

          this._headerValueMark = i;
          state = HEADER_VALUE;
        /* falls through */
        case HEADER_VALUE:
          if (c === CR) {
            this._onParseHeaderValue(this._buffer.slice(this._headerValueMark as number, i));
            this._headerValueMark = null;
            this._onParseHeaderEnd();
            state = HEADER_VALUE_ALMOST_DONE;
          }
          break;
        case HEADER_VALUE_ALMOST_DONE:
          if (c !== LF) throw new Error(`Expected LF Received ${c}`);
          state = HEADER_FIELD_START;
          break;
        case HEADERS_ALMOST_DONE:
          if (c !== LF) throw new Error(`Expected LF Received ${c}`);
          const err: any = this._onParseHeadersEnd(i + 1);
          if (err) throw err;
          state = PART_DATA_START;
          break;
        case PART_DATA_START:
          state = PART_DATA;
          this._partDataMark = i;
        /* falls through */
        case PART_DATA:
          prevIndex = index;

          if (index === 0) {
            // boyer-moore derived algorithm to safely skip non-boundary data
            i += boundaryEnd;
            while (i < bufferLength && !(this._buffer[i] in boundaryChars)) {
              i += boundaryLength;
            }
            i -= boundaryEnd;
            c = this._buffer[i];
          }

          if (index < boundaryLength) {
            if (boundary[index] === c) {
              if (index === 0) {
                this._onParsePartData(this._buffer.slice(this._partDataMark as number, i));
                this._partDataMark = null;
              }
              index++;
            } else {
              index = 0;
            }
          } else if (index === boundaryLength) {
            index++;
            if (c === CR) {
              // CR = part boundary
              this._partBoundaryFlag = true;
            } else if (c === HYPHEN) {
              index = 1;
              state = CLOSE_BOUNDARY;
              break;
            } else {
              index = 0;
            }
          } else if (index - 1 === boundaryLength) {
            if (this._partBoundaryFlag) {
              index = 0;
              if (c === LF) {
                this._partBoundaryFlag = false;
                this._onParsePartEnd();
                this._onParsePartBegin();
                state = HEADER_FIELD_START;
                break;
              }
            } else {
              index = 0;
            }
          }

          if (index > 0) {
            // when matching a possible boundary, keep a lookbehind reference
            // in case it turns out to be a false lead
            lookbehind[index - 1] = c;
          } else if (prevIndex > 0) {
            // if our boundary turned out to be rubbish, the captured lookbehind
            // belongs to partData
            this._onParsePartData(lookbehind.slice(0, prevIndex));
            prevIndex = 0;
            this._partDataMark = i;

            // reconsider the current character even so it interrupted the sequence
            // it could be the beginning of a new sequence
            i--;
          }

          break;
        case CLOSE_BOUNDARY:
          if (c !== HYPHEN) throw new Error(`Expected HYPHEN Received ${c}`);
          if (index === 1) {
            this._onParsePartEnd();
            state = END;
          } else if (index > 1) {
            throw new Error("Parser has invalid state.");
          }
          index++;
          break;
        case END:
          break;
        default:
          throw new Error("Parser has invalid state.");
      }
    }

    if (this._headerFieldMark != null) {
      this._onParseHeaderField(this._buffer.slice(this._headerFieldMark));
      this._headerFieldMark = 0;
    }
    if (this._headerValueMark != null) {
      this._onParseHeaderValue(this._buffer.slice(this._headerValueMark));
      this._headerValueMark = 0;
    }
    if (this._partDataMark != null) {
      this._onParsePartData(this._buffer.slice(this._partDataMark));
      this._partDataMark = 0;
    }

    return this._value;
  }

  private _onParsePartBegin() {
    this._clearPartVars();
  }

  private _clearPartVars() {
    this._partHeaders = {};
    this._partName = null;
    this._partChunks.length = 0;

    this._headerFieldDecoder = new StringDecoder("utf8");
    this._headerField = "";
    this._headerValueDecoder = new StringDecoder("utf8");
    this._headerValue = "";
  }

  private _onParseHeaderField(b: Buffer) {
    this._headerField += this._headerFieldDecoder!.write(b);
  }

  private _onParseHeaderValue(b: Buffer) {
    this._headerValue += this._headerValueDecoder!.write(b);
  }

  private _onParseHeaderEnd() {
    this._headerField = this._headerField.toLowerCase();
    this._partHeaders[this._headerField] = this._headerValue;

    let m: RegExpMatchArray | null;
    if (this._headerField === "content-disposition") {
      if (m = this._headerValue.match(/\bname="([^"]+)"/i)) {
        this._partName = m[1];
      }
      // this._partFilename = parseFilename(this._headerValue);
    } else if (this._headerField === "content-transfer-encoding") {
      // this._partTransferEncoding = this._headerValue.toLowerCase();
    }

    this._headerFieldDecoder = new StringDecoder("utf8");
    this._headerField = "";
    this._headerValueDecoder = new StringDecoder("utf8");
    this._headerValue = "";
  }

  private _onParsePartData(b: Buffer) {
    this._partChunks.push(b);
  }

  private _onParsePartEnd() {
    const partValue = this._partChunks.length === 1 ? this._partChunks[0] : Buffer.concat(this._partChunks);

    if (this._partName === "objects") {
      this._value.objects = partValue.toString();
    } else {
      this._value.data.push(partValue);
    }

    this._clearPartVars();
  }

  private _onParseHeadersEnd(_offset: number) {
  }
}
