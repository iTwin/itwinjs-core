import { BufferedStream } from "../../imodelhub/AzureFileHandler";
import * as chai from "chai";
import * as stream from "stream";

describe("iModelHub AzureFileHandler BufferedStream", () => {
  before(async function (this: Mocha.IHookCallbackContext) {
    this.enableTimeouts(false);
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
