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

/** Interface of the data structure that stores information about a connetion-related event. */
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
  }

  public registerConnection(connection: Connection): void {
    assert(-1 === this._connections.indexOf(connection), "Should not register a connection more than once");
    this._connections.push(connection);
    this.connectionOpened.raiseEvent({Connection: connection});
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

  /* @todo
  public _GetMessageTypes(): string[] { return ["Message.DgnClientFx.Presentation.ConnectionEvent"]; }

  public _HandleMessage(message: Message): void {
    let evt: ConnectionEventArgs = message.GetData();
    if (evt.EventType === ConnectionEventType.Open)
      this._connections.push(evt.Connection);
    else if (evt.EventType === ConnectionEventType.Close) {
      for (let i = 0; i < this._connections.length; i++) {
        if (evt.Connection.ConnectionId === this._connections[i].ConnectionId)
          this._connections.splice(i, 1);
        break;
      }
    }
    this.HandleEvent(evt);
  }*/

  /*public GetPrimaryConnection(): Connection | null {
    for (const connection of this._connections) {
      if (connection.IsProjectPrimary)
        return connection;
    }
    return null;
  }*/
}

/** An interface for a connection supplier listener which is notified when connection has
 * changed.
 */
/*export interface IConnectionSupplierListener {
  _OnConnectionChanged(): void;
}*/

/** An interface for a connection supply. */
/*export interface IConnectionSupplier {
  GetConnectionId(): string;
  AddListener(listener: IConnectionSupplierListener): void;
  RemoveListener(listener: IConnectionSupplierListener): void;
  OnDestroy(): void;
}*/

/** Connection Supplier which tracks active project. */
/*export class PrimaryProjectConnectionSupplier implements IConnectionSupplier, IConnectionListener {
  private m_listeners: Array<IConnectionSupplierListener>;
  private m_connection: IConnection;

  //--------------------------------------------------------------------------------------
  //  @bsimethod                                    Aidas.Vaiksnoras             07/2017
  //--------------------------------------------------------------------------------------
  constructor() {
    DgnClientFx.Connections.AddListener(this);
    this.m_listeners = new Array<IConnectionSupplierListener>();
    this.m_connection = DgnClientFx.Connections.GetPrimarayConnection();
  }

  //---------------------------------------------------------------------------------------
  //  @bsimethod                                    Aidas.Vaiksnoras              07/2017
  //---------------------------------------------------------------------------------------
  public GetConnectionId(): string { return null == this.m_connection ? null : this.m_connection.ConnectionId; }

  //---------------------------------------------------------------------------------------
  //  @bsimethod                                    Aidas.Vaiksnoras              07/2017
  //---------------------------------------------------------------------------------------
  public AddListener(listener: IConnectionSupplierListener): void { this.m_listeners.push(listener); }

  //---------------------------------------------------------------------------------------
  //  @bsimethod                                    Aidas.Vaiksnoras              07/2017
  //---------------------------------------------------------------------------------------
  public RemoveListener(listener: IConnectionSupplierListener): void {
    let index = this.m_listeners.indexOf(listener);
    if (-1 !== index)
      this.m_listeners.splice(index, 1);
  }

  //---------------------------------------------------------------------------------------
  //  @bsimethod                                    Aidas.Vaiksnoras              07/2017
  //---------------------------------------------------------------------------------------
  private NotifyListeners(): void {
    for (let listener of this.m_listeners)
      listener._OnConnectionChanged();
  }

  //---------------------------------------------------------------------------------------
  //  @bsimethod                                    Aidas.Vaiksnoras              07/2017
  //---------------------------------------------------------------------------------------
  public _OnConnectionEvent(event: ConnectionEventArgs): void {
    if (event.Connection.IsProjectPrimary && event.EventType === ConnectionEventType.Open && this.m_connection != event.Connection)
      this.m_connection = event.Connection;
    else if (event.EventType === ConnectionEventType.Close && this.m_connection.ConnectionId == event.Connection.ConnectionId)
      this.m_connection = null;
    else
      return;

    this.NotifyListeners();
  }

  //---------------------------------------------------------------------------------------
  //  @bsimethod                                    Aidas.Vaiksnoras              07/2017
  //---------------------------------------------------------------------------------------
  public OnDestroy(): void {
    this.m_listeners = [];
    DgnClientFx.Connections.RemoveListener(this);
  }*/
