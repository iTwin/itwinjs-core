import { Id64String } from "@itwin/core-bentley";
import { TxnManager } from "./TxnManager";

export interface Value {
  get isNull(): boolean;
  get isValid(): boolean;
  get valueType(): "integer" | "null" | "string" | "double" | "binary";
  getId(): Id64String;
  getInteger(): number;
  getString(): string;
  getDouble(): number;
  getBinary(): Uint8Array;
}

export interface Change {
  getValueOld(idx: number): Value | undefined;
  getValueNew(idx: number): Value | undefined;
  getTableName(): string;
  getColumnName(idx: number): string;
  getColumnCount(): number;
  getOperation(): "insert" | "update" | "delete";
  isPrimaryKey(idx: number): boolean;
}

class Changes implements Iterator<Change> {
  public constructor(private _changeStream: ChangeStream) {
  }
  public next(): IteratorResult<Change> {
    throw new Error("Method not implemented.");
  }

}
export class ChangeStream implements Iterable<Change> {

  public [Symbol.iterator](): Iterator<Change> {
    return new Changes(this);
  }


}

export class ChangeTracker {

}

export abstract class TxnTable {
  public constructor(public readonly txns: TxnManager) {
  }
  public abstract get tableName(): string;
  public abstract initialize(): void
  public abstract onValidate(): void;
  public abstract onValidateAdd(): void;
  public abstract onValidateUpdate(change: Change): void;
  public abstract onValidateDelete(change: Change): void;
  public abstract propagateChanges(change: Change): void;
  public abstract onValidated(): void;
  public abstract onApply(): void;
  public abstract onApplied(): void;
  public abstract onAppliedAdd(change: Change): void;
  public abstract onAppliedUpdate(change: Change): void;
  public abstract onAppliedDelete(change: Change): void;
}
export class TxnTables{
  private _tables: Map<string, TxnTable> = new Map();

  public registerTable(table: TxnTable): void {
    this._tables.set(table.tableName, table);
  }

  public getTable(name: string): TxnTable | undefined {
    return this._tables.get(name);
  }

  public initializeAll(): void {
    for (const table of this._tables.values()) {
      table.initialize();
    }
  }
}