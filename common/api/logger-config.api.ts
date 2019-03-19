// @beta
class BunyanLoggerConfig {
  static logToBunyan(blgr: any): void;
  static logToStdoutViaBunyan(loggerName: string): void;
}

// @beta
class FluentdBunyanLoggerConfig {
  static createBunyanFluentdLogger(fluentdConfig: IFluentdConfig, loggerName: string): any;
  static validateProps(fluentdConfig: any): void;
}

// @beta (undocumented)
class FluentdLoggerStream extends Writable {
  constructor(fluentdParams: IFluentdConfig);
  // (undocumented)
  _write(chunk: any, encoding: string, callback: (err?: Error) => void): void;
  // (undocumented)
  _writev(chunks: Array<{
          chunk: any;
          encoding: string;
      }>, callback: (err?: Error) => void): void;
}

// @beta (undocumented)
interface GenericPost {
  // (undocumented)
  postasync(config: any, jsonbody: any): Promise<number>;
}

// @beta
interface IFluentdConfig {
  fluentdHost?: string;
  fluentdPort?: number;
  fluentdTimeout?: number;
  seqApiKey?: string;
  seqServerPort?: number;
  seqServerUrl?: string;
}

// @beta (undocumented)
class PostFluentd implements GenericPost {
  // (undocumented)
  postasync(config: any, jsonbody: any): Promise<number>;
}

// @beta
interface SeqConfig {
  apiKey?: string;
  batchSizeLimit?: number;
  hostURL?: string;
  maxBatchingTime?: number;
  port?: number;
  reemitErrorEvents?: boolean;
}

// @beta
class SeqLoggerConfig {
  static createBunyanSeqLogger(seqConfig: SeqConfig, loggerName: string): any;
  static validateProps(seqConfig: any): void;
}

// (No @packagedocumentation comment for this package)
