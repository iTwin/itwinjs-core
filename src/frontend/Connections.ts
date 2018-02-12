/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { BeEvent } from "@bentley/bentleyjs-core/lib/BeEvent";

/** Data structure that stores information about a connection. */
export interface Connection {
  connectionId: string;
  // IsProjectPrimary: boolean;
}

/** Interface of the data structure that stores information about a connection-related event. */
export interface ConnectionEventArgs {
  connection: Connection;
}

/** An interface for connection listeners */
export declare type ConnectionsListener = (args: ConnectionEventArgs) => void;

/** An event broadcasted on connection changes */
export class ConnectionEvent extends BeEvent<ConnectionsListener> { }

/** An interface for connections' manager which notifies listeners about opened and closed connections. */
export interface ConnectionManager {
  connectionOpened: ConnectionEvent;
  connectionClosed: ConnectionEvent;
  registerConnection(connection: Connection): void;
  unregisterConnection(connection: Connection): void;
}

/** The connections' manager which notifies listeners about opened and closed connections. */
export class ConnectionManagerImpl implements ConnectionManager {
  private _connections: Connection[];
  public connectionOpened: ConnectionEvent;
  public connectionClosed: ConnectionEvent;

  /** Constructor. */
  constructor() {
    this._connections = new Array<Connection>();
    this.connectionOpened = new ConnectionEvent();
    this.connectionClosed = new ConnectionEvent();
  }

  public registerConnection(connection: Connection): void {
    assert(-1 === this._connections.indexOf(connection), "Should not register a connection more than once");
    this._connections.push(connection);
    this.connectionOpened.raiseEvent({ Connection: connection });
  }

  public unregisterConnection(connection: Connection): void {
    const idx = this._connections.indexOf(connection);
    if (-1 === idx) {
      assert(false, "Trying to unregister a connection that's not registered");
      return;
    }
    this._connections.splice(idx, 1);
    this.connectionClosed.raiseEvent({ Connection: connection });
  }
}
