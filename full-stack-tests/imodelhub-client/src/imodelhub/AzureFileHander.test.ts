/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as stream from "stream";
import { URL } from "url";
import { AuthorizedClientRequestContext, SasUrlExpired } from "@bentley/itwin-client";
import { AzureFileHandler, BufferedStream } from "@bentley/backend-itwin-client";
import { MockAccessToken } from "./TestUtils";
import { workDir } from "./TestConstants";

/* eslint-disable @typescript-eslint/unbound-method */

describe("iModelHub AzureFileHandler", () => {
  before(async function () {
    this.timeout(0);
  });

  it("Check for expired sas url", () => {
    const se = new Date(new Date().toUTCString());
    se.setSeconds(se.getSeconds() - 10);
    const ur = new URL("http://mock.com");
    ur.searchParams.append("se", se.toISOString());
    chai.expect(AzureFileHandler.isUrlExpired(ur.toString())).to.be.true;
  });

  it("Check for valid sas url", () => {
    const se = new Date(new Date().toUTCString());
    se.setSeconds(se.getSeconds() + 10);
    const ur = new URL("http://mock.com");
    ur.searchParams.append("se", se.toISOString());
    chai.expect(AzureFileHandler.isUrlExpired(ur.toString())).to.be.false;
  });

  it("Check for SasUrlExpired exception", async () => {
    const expiredLink = "https://imodelhubprodsa01.blob.core.windows.net/imodelhub-04dcd32a-781b-4b4d-8e27-2175793f6ffa/fca1ee0731957db792373f809d0f102bbb9dbe61.cs?sv=2018-03-28&sr=b&sig=NXfWf%2BRZURZHTVX%2B1FPqVc4m%2F5zAC%2BJhAx%2FrcfDoH%2BQ%3D&st=2020-04-07T18%3A16%3A57Z&se=2020-04-07T18%3A26%3A57Z&sp=r%22"; const az = new AzureFileHandler();
    const mockRequestContext = new AuthorizedClientRequestContext(new MockAccessToken());
    try {
      await az.downloadFile(mockRequestContext, expiredLink, workDir);
      chai.assert(false, "expect SasUrlExpired exception");
    } catch (err) {
      chai.expect(err).instanceOf(SasUrlExpired);
    }
  });

  it("should concatenate simple buffer", () => {
    const bufferedStream = new BufferedStream(4);
    const chunkList: Buffer[] = [];

    const receivingStream = new stream.Writable();
    receivingStream._write = (chunk, _, done) => {
      chunkList.push(chunk);
      done();
    };

    bufferedStream.pipe(receivingStream);
    bufferedStream.write(Buffer.from("12", "binary"));
    bufferedStream.write(Buffer.from("34", "binary"));
    bufferedStream.write(Buffer.from("56", "binary"));

    bufferedStream.on("end", () => {
      chai.expect(chunkList[0].toString()).to.be.equal("1234");
      chai.expect(chunkList[1].toString()).to.be.equal("56");
    });

    bufferedStream.end();
  });

  it("should concatenate not full buffer", () => {
    const bufferedStream = new BufferedStream(3);
    const chunkList: Buffer[] = [];

    const receivingStream = new stream.Writable();
    receivingStream._write = (chunk, _, done) => {
      chunkList.push(chunk);
      done();
    };

    bufferedStream.pipe(receivingStream);
    bufferedStream.write(Buffer.from("12", "binary"));
    bufferedStream.write(Buffer.from("34", "binary"));
    bufferedStream.write(Buffer.from("5", "binary"));

    bufferedStream.on("end", () => {
      chai.expect(chunkList[0].toString()).to.be.equal("123");
      chai.expect(chunkList[1].toString()).to.be.equal("45");
    });

    bufferedStream.end();
  });

  it("should return buffer size chunks", () => {
    const bufferedStream = new BufferedStream(2);
    const chunkList: Buffer[] = [];

    const receivingStream = new stream.Writable();
    receivingStream._write = (chunk, _, done) => {
      chunkList.push(chunk);
      done();
    };

    bufferedStream.pipe(receivingStream);
    bufferedStream.write(Buffer.from("12", "binary"));
    bufferedStream.write(Buffer.from("34", "binary"));

    bufferedStream.on("end", () => {
      chai.expect(chunkList[0].toString()).to.be.equal("12");
      chai.expect(chunkList[1].toString()).to.be.equal("34");
    });

    bufferedStream.end();
  });

  it("should return bigger than buffer chunks", () => {
    const bufferedStream = new BufferedStream(2);
    const chunkList: Buffer[] = [];

    const receivingStream = new stream.Writable();
    receivingStream._write = (chunk, _, done) => {
      chunkList.push(chunk);
      done();
    };

    bufferedStream.pipe(receivingStream);
    bufferedStream.write(Buffer.from("1234", "binary"));
    bufferedStream.write(Buffer.from("5678", "binary"));

    bufferedStream.on("end", () => {
      chai.expect(chunkList[0].toString()).to.be.equal("1234");
      chai.expect(chunkList[1].toString()).to.be.equal("5678");
    });

    bufferedStream.end();
  });

  it("should return bigger than buffer chunks when varying chunk size", () => {
    const bufferedStream = new BufferedStream(3);
    const chunkList: Buffer[] = [];

    const receivingStream = new stream.Writable();
    receivingStream._write = (chunk, _, done) => {
      chunkList.push(chunk);
      done();
    };

    bufferedStream.pipe(receivingStream);
    bufferedStream.write(Buffer.from("12", "binary"));
    bufferedStream.write(Buffer.from("34567", "binary"));
    bufferedStream.write(Buffer.from("BCDE", "binary"));

    bufferedStream.on("end", () => {
      chai.expect(chunkList[0].toString()).to.be.equal("1234567");
      chai.expect(chunkList[1].toString()).to.be.equal("BCDE");
    });

    bufferedStream.end();
  });

});
