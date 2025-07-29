import { DbResult, Id64, Id64String } from "@itwin/core-bentley";
import { BriefcaseDb } from "./IModelDb";
import { SqliteStatement } from "./SqliteStatement";
import { TxnManager } from "./TxnManager";
export type NoUndefined<T> = T extends undefined ? never : T;
enum EdgeColor {
  WHITE, GRAY, BLACK
}

// Represents the status of an edge in the dependency graph.
enum EdgeStatus {
  Satisfied = 0,
  Failed = 1,
  Deferred = 0x80,
}

// Represents a unique instance of an element in the dependency graph.
interface InstanceKey {
  instanceId: Id64String;
  classId: Id64String;
}

/**
 * Represents a dependency edge between two elements in the system.
 *
 * @property rootElementId - The Id64String of the root (source) element in the dependency.
 * @property dependentElementId - The Id64String of the dependent (target) element.
 * @property priority - The priority of the dependency edge.
 * @property isDirect - Indicates if the dependency is a direct relationship.
 * @property status - The current status of the dependency edge.
 * @property isDeleted - Indicates if the dependency edge has been marked as deleted.
 * @property instanceKey - The unique instance key associated with this edge.
 * @property isEDE - Indicates if the edge is an Element Dependency Edge (EDE).
 *
 * @internal
 */
export interface Edge {
  rootElementId: Id64String;
  dependentElementId: Id64String;
  priority: number;
  isDirect: boolean;
  status: EdgeStatus;
  isDeleted: boolean;
  instanceKey: InstanceKey;
  isEDE: boolean;
}

/**
 * Represents a node in the dependency graph, containing information about the element's in-degree,
 * inputs processed, outputs processed, and whether the input was directly changed.
 *
 * @internal
 */
class Nodes {
  private _stmts: {
    insert: SqliteStatement;
    incrementInDegree: SqliteStatement;
    selectInDegree: SqliteStatement;
    setDirect: SqliteStatement;
    selectDirect: SqliteStatement;
    allInputsProcessed: SqliteStatement;
    anyOutputsProcessed: SqliteStatement;
    incrementInputsProcessed: SqliteStatement;
    incrementOutputsProcessed: SqliteStatement;
  };
  private prepare(sql: string): SqliteStatement {
    return this.graph.db.prepareSqliteStatement(sql);
  }
  private tableExists(tableName: string): boolean {
    return this.graph.db.withSqliteStatement("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (stmt: SqliteStatement) => {
      stmt.bindString(1, tableName);
      return stmt.step() === DbResult.BE_SQLITE_ROW;
    });
  }
  public constructor(public readonly graph: Graph) {
    if (!this.tableExists(NativeTables.TXN_NODES)) {
      const success = this.graph.db.withSqliteStatement(
        `CREATE TABLE ${NativeTables.TXN_NODES} (
          [ElementId] INTEGER PRIMARY KEY,
          [InDegree] INTEGER DEFAULT 0,
          [InputsProcessed] INTEGER DEFAULT 0,
          [OutputsProcessed] INTEGER DEFAULT 0,
          [Direct] INTEGER DEFAULT 0)`, (stmt: SqliteStatement) => {
        return stmt.step() === DbResult.BE_SQLITE_OK;
      });
      if (!success) {
        throw new Error(`Failed to create table ${NativeTables.TXN_NODES}`);
      }
    }
    this._stmts = {
      insert: this.prepare(`INSERT OR IGNORE INTO ${NativeTables.TXN_NODES} (ElementId) VALUES(?)`),
      incrementInDegree: this.prepare(`UPDATE ${NativeTables.TXN_NODES} SET [InDegree]=[InDegree]+1 WHERE [ElementId]=?`),
      selectInDegree: this.prepare(`SELECT [InDegree] FROM ${NativeTables.TXN_NODES} WHERE [ElementId]=?`),
      setDirect: this.prepare(`UPDATE ${NativeTables.TXN_NODES} SET [Direct]=1 WHERE [ElementId]=?`),
      selectDirect: this.prepare(`SELECT [Direct] FROM ${NativeTables.TXN_NODES} WHERE [ElementId]=?`),
      allInputsProcessed: this.prepare(`SELECT EXISTS(SELECT 1 FROM ${NativeTables.TXN_NODES} WHERE [ElementId]=? AND [InDegree]=[InputsProcessed] LIMIT 1)`),
      anyOutputsProcessed: this.prepare(`SELECT EXISTS(SELECT 1 FROM ${NativeTables.TXN_NODES} WHERE [ElementId]=? AND [OutputsProcessed]!=0 LIMIT 1)`),
      incrementInputsProcessed: this.prepare(`UPDATE ${NativeTables.TXN_NODES} SET [InputsProcessed]=[InputsProcessed]+1 WHERE [ElementId]=?`),
      incrementOutputsProcessed: this.prepare(`UPDATE ${NativeTables.TXN_NODES} SET [OutputsProcessed]=[OutputsProcessed]+1 WHERE [ElementId]=?`),
    };
  }
  public [Symbol.dispose](): void {
    if (this.graph.db.isOpen) {
      this.graph.db.withSqliteStatement(`DELETE FROM ${NativeTables.TXN_NODES}`, (stmt: SqliteStatement) => {
        stmt.step();
      });
    }
  }
  public allInputsProcessed(elementId: Id64String): boolean {
    if (!Id64.isValidId64(elementId)) {
      throw new Error("Invalid elementId");
    }
    this._stmts.allInputsProcessed.reset();
    this._stmts.allInputsProcessed.bindId(1, elementId);
    const result = this._stmts.allInputsProcessed.step();
    if (result !== DbResult.BE_SQLITE_ROW && result !== DbResult.BE_SQLITE_DONE) {
      throw new Error("Failed to check if all inputs are processed");
    }
    return result === DbResult.BE_SQLITE_ROW;
  }
  public anyOutputsProcessed(elementId: Id64String): boolean {
    if (!Id64.isValidId64(elementId)) {
      throw new Error("Invalid elementId");
    }
    this._stmts.anyOutputsProcessed.reset();
    this._stmts.anyOutputsProcessed.bindId(1, elementId);
    const result = this._stmts.anyOutputsProcessed.step();
    if (result !== DbResult.BE_SQLITE_ROW && result !== DbResult.BE_SQLITE_DONE) {
      throw new Error("Failed to check if any outputs are processed");
    }
    return result === DbResult.BE_SQLITE_ROW;
  }
  public insertNode(elementId: Id64String): void {
    if (!Id64.isValidId64(elementId)) {
      throw new Error("Invalid elementId");
    }
    this._stmts.insert.reset();
    this._stmts.insert.bindId(1, elementId);
    const result = this._stmts.insert.step();
    if (result !== DbResult.BE_SQLITE_DONE) {
      throw new Error("Failed to insert node");
    }
  }
  public incrementInDegree(elementId: Id64String): void {
    if (!Id64.isValidId64(elementId)) {
      throw new Error("Invalid elementId");
    }
    this._stmts.incrementInDegree.reset();
    this._stmts.incrementInDegree.bindId(1, elementId);
    const result = this._stmts.incrementInDegree.step();
    if (result !== DbResult.BE_SQLITE_DONE) {
      throw new Error("Failed to increment in-degree");
    }
  }
  public getInDegree(elementId: Id64String): number {
    if (!Id64.isValidId64(elementId)) {
      throw new Error("Invalid elementId");
    }
    this._stmts.selectInDegree.reset();
    this._stmts.selectInDegree.bindId(1, elementId);
    const result = this._stmts.selectInDegree.step();
    if (result === DbResult.BE_SQLITE_DONE) {
      return 0; // No in-degree found
    } else if (result !== DbResult.BE_SQLITE_ROW) {
      throw new Error("Failed to select in-degree");
    }
    return this._stmts.selectInDegree.getValue(0).getInteger();
  }
  public setInputWasDirectlyChanged(elementId: Id64String): void {
    if (!Id64.isValidId64(elementId)) {
      throw new Error("Invalid elementId");
    }
    this._stmts.setDirect.reset();
    this._stmts.setDirect.bindId(1, elementId);
    const result = this._stmts.setDirect.step();
    if (result !== DbResult.BE_SQLITE_DONE) {
      throw new Error("Failed to set direct");
    }
  }
  public isInputDirectlyChanged(elementId: Id64String): boolean {
    if (!Id64.isValidId64(elementId)) {
      throw new Error("Invalid elementId");
    }
    this._stmts.selectDirect.reset();
    this._stmts.selectDirect.bindId(1, elementId);
    const result = this._stmts.selectDirect.step();
    if (result === DbResult.BE_SQLITE_DONE) {
      return false; // No direct status found
    } else if (result !== DbResult.BE_SQLITE_ROW) {
      throw new Error("Failed to select direct status");
    }
    return this._stmts.selectDirect.getValue(0).getInteger() !== 0;
  }
  public incrementInputsProcessed(elementId: Id64String): void {
    if (!Id64.isValidId64(elementId)) {
      throw new Error("Invalid elementId");
    }
    this._stmts.incrementInputsProcessed.reset();
    this._stmts.incrementInputsProcessed.bindId(1, elementId);
    const result = this._stmts.incrementInputsProcessed.step();
    if (result !== DbResult.BE_SQLITE_DONE) {
      throw new Error("Failed to increment inputs processed");
    }
  }
  public incrementOutputsProcessed(elementId: Id64String): void {
    if (!Id64.isValidId64(elementId)) {
      throw new Error("Invalid elementId");
    }
    this._stmts.incrementOutputsProcessed.reset();
    this._stmts.incrementOutputsProcessed.bindId(1, elementId);
    const result = this._stmts.incrementOutputsProcessed.step();
    if (result !== DbResult.BE_SQLITE_DONE) {
      throw new Error("Failed to increment outputs processed");
    }
  }

}
class EdgeQueue {
  private _cachedStmts?: {
    insert: SqliteStatement;
    setEdgeColor: SqliteStatement;
    getEdgeColor: SqliteStatement;
    select: SqliteStatement;
    selectByPriority: SqliteStatement;
    selectByPriorityForOutput: SqliteStatement;
  };
  private prepare(sql: string): SqliteStatement {
    return this.graph.db.prepareSqliteStatement(sql);
  }
  private get _stmts(): NoUndefined<typeof this._cachedStmts> {
    if (!this._cachedStmts) {
      throw new Error("Statements not initialized");
    }
    return this._cachedStmts;
  }
  private tableExists(tableName: string): boolean {
    return this.graph.db.withSqliteStatement("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (stmt: SqliteStatement) => {
      stmt.bindString(1, tableName);
      return stmt.step() === DbResult.BE_SQLITE_ROW;
    });
  }

  public constructor(public readonly graph: Graph) {
    if (!this.tableExists(NativeTables.TXN_EDGE_QUEUE)) {
      const success = graph.db.withSqliteStatement(`CREATE TABLE ${NativeTables.TXN_EDGE_QUEUE} (
           [ECClassId] INTEGER,
           [InstanceId] INTEGER,
           [SourceId] INTEGER,
           [TargetId] INTEGER,
           [Status] INTEGER DEFAULT 0,
           [Priority] INTEGER DEFAULT 0,
           [Color] INTEGER DEFAULT 0,
           [Deleted] INTEGER DEFAULT 0,
           [Direct] INTEGER DEFAULT 0,
           [IsEDE] INTEGER DEFAULT 0,
           PRIMARY KEY(ECClassId, [InstanceId])
         )`, (stmt: SqliteStatement) => {
        return stmt.step() === DbResult.BE_SQLITE_OK;
      });
      if (!success) {
        throw new Error(`Failed to create table ${NativeTables.TXN_EDGE_QUEUE}`);
      }

      const edgeQueueQueryColumns = "[InstanceId],[SourceId],[TargetId],[ECClassId],[Status],[Priority],[Deleted],[Direct],[IsEDE]"
      this._cachedStmts = {
        insert: this.prepare(`INSERT INTO ${NativeTables.TXN_EDGE_QUEUE} ([InstanceId],[SourceId],[TargetId],[ECClassId],[Status],[Priority],[Deleted],[Direct],[IsEDE]) VALUES(?,?,?,?,?,?,?,?,?)`),
        setEdgeColor: this.prepare(`UPDATE ${NativeTables.TXN_EDGE_QUEUE} SET [Color]=? WHERE [ECClassId]=? AND [InstanceId]=?`),
        getEdgeColor: this.prepare(`SELECT [Color] FROM ${NativeTables.TXN_EDGE_QUEUE} WHERE [ECClassId]=? AND [InstanceId]=?`),
        select: this.prepare(`SELECT ${edgeQueueQueryColumns} FROM ${NativeTables.TXN_EDGE_QUEUE}`),
        selectByPriority: this.prepare(`SELECT ${edgeQueueQueryColumns} FROM ${NativeTables.TXN_EDGE_QUEUE} ORDER BY [Priority] DESC`),
        selectByPriorityForOutput: this.prepare(`SELECT ${edgeQueueQueryColumns} FROM ${NativeTables.TXN_EDGE_QUEUE} WHERE [TargetId]=? ORDER BY [Priority] DESC`),
      };

    }
  }
  public [Symbol.dispose](): void {
    if (this.graph.db.isOpen) {
      this.graph.db.withSqliteStatement(`DELETE FROM ${NativeTables.TXN_EDGE_QUEUE}`, (stmt: SqliteStatement) => {
        stmt.step();
      });
    }
  }
  public selectEdge(stmt: SqliteStatement): Edge | undefined {
    const rc = stmt.step();
    if (rc !== DbResult.BE_SQLITE_ROW) {
      throw new Error(`Failed to select edge, expected BE_SQLITE_ROW but got ${DbResult[rc]}`);
    }

    return {
      rootElementId: stmt.getValueId(1),
      dependentElementId: stmt.getValueId(2),
      instanceKey: {
        instanceId: stmt.getValueId(0),
        classId: stmt.getValueId(3),
      },
      status: stmt.getValueInteger(4) as EdgeStatus,
      priority: stmt.getValueInteger(5),
      isDeleted: stmt.getValueInteger(6) !== 0,
      isDirect: stmt.getValueInteger(7) !== 0,
      isEDE: stmt.getValueInteger(8) !== 0,
    }
  }
  public bindSelectByOutput(dependentElementId: Id64String): void {
    if (!Id64.isValidId64(dependentElementId)) {
      throw new Error("Invalid dependentElementId");
    }
    this._stmts.selectByPriorityForOutput.reset();
    this._stmts.selectByPriorityForOutput.bindId(1, dependentElementId);
  }

  public addEdge(edge: Edge): void {
    if ((edge.status & EdgeStatus.Deferred) === EdgeStatus.Deferred) {
      return; // Edge is deferred, do not add
    }

    if (!Id64.isValidId64(edge.rootElementId)) {
      throw new Error("Invalid rootElementId in edge");
    }
    if (!Id64.isValidId64(edge.dependentElementId)) {
      throw new Error("Invalid dependentElementId in edge");
    }
    if (!Id64.isValidId64(edge.instanceKey.instanceId)) {
      throw new Error("Invalid instanceId in edge");
    }
    if (!Id64.isValidId64(edge.instanceKey.classId)) {
      throw new Error("Invalid classId in edge");
    }

    this._stmts.insert.reset();
    this._stmts.insert.bindId(1, edge.instanceKey.instanceId);
    this._stmts.insert.bindId(2, edge.rootElementId);
    this._stmts.insert.bindId(3, edge.dependentElementId);
    this._stmts.insert.bindId(4, edge.instanceKey.classId);
    this._stmts.insert.bindInteger(5, edge.status);
    this._stmts.insert.bindInteger(6, edge.priority);
    this._stmts.insert.bindInteger(7, edge.isDeleted ? 1 : 0);
    this._stmts.insert.bindInteger(8, edge.isDirect ? 1 : 0);
    this._stmts.insert.bindInteger(9, edge.isEDE ? 1 : 0);
    const rc = this._stmts.insert.step();
    if (rc !== DbResult.BE_SQLITE_DONE) {
      throw new Error(`Failed to insert edge, expected BE_SQLITE_DONE but got ${DbResult[rc]}`);
    }
  }
  public stepSelectByOutput(): Edge | undefined {
    return this.selectEdge(this._stmts.selectByPriorityForOutput);
  }
  public stepSelectAllOrderedByPriority(): Edge | undefined {
    return this.selectEdge(this._stmts.selectByPriority);
  }
  public resetSelectAllOrderByPriority(): void {
    this._stmts.selectByPriority.reset();
  }
  public getEdgeColor(edge: Edge): EdgeColor {
    if (!Id64.isValidId64(edge.instanceKey.instanceId)) {
      throw new Error("Invalid instanceId in edge");
    }
    if (!Id64.isValidId64(edge.instanceKey.classId)) {
      throw new Error("Invalid classId in edge");
    }
    this._stmts.getEdgeColor.reset();
    this._stmts.getEdgeColor.bindId(1, edge.instanceKey.classId);
    this._stmts.getEdgeColor.bindId(2, edge.instanceKey.instanceId);
    const rc = this._stmts.getEdgeColor.step();
    if (rc === DbResult.BE_SQLITE_DONE) {
      return EdgeColor.WHITE; // Default color if not found
    } else if (rc !== DbResult.BE_SQLITE_ROW) {
      throw new Error(`Failed to get edge color, expected BE_SQLITE_ROW but got ${DbResult[rc]}`);
    }
    const colorValue = this._stmts.getEdgeColor.getValue(0).getInteger();
    if (colorValue < EdgeColor.WHITE || colorValue > EdgeColor.BLACK) {
      throw new Error(`Invalid edge color value: ${colorValue}`);
    }
    return colorValue as EdgeColor;
  }
  public setEdgeColor(edge: Edge, color: EdgeColor): void {
    if (!Id64.isValidId64(edge.instanceKey.instanceId)) {
      throw new Error("Invalid instanceId in edge");
    }
    if (!Id64.isValidId64(edge.instanceKey.classId)) {
      throw new Error("Invalid classId in edge");
    }
    this._stmts.setEdgeColor.reset();
    this._stmts.setEdgeColor.bindInteger(1, color);
    this._stmts.setEdgeColor.bindId(2, edge.instanceKey.classId);
    this._stmts.setEdgeColor.bindId(3, edge.instanceKey.instanceId);
    const rc = this._stmts.setEdgeColor.step();
    if (rc !== DbResult.BE_SQLITE_DONE) {
      throw new Error(`Failed to set edge color, expected BE_SQLITE_DONE but got ${DbResult[rc]}`);
    }
  }
}

class ElementDrivesElement {
  private _cachedStmts: {
    selectByRootInDirectChanges: SqliteStatement;
    selectByRelationshipInDirectChanges: SqliteStatement;
    selectByRoot: SqliteStatement;
    updateStatus: SqliteStatement;
  };
  private prepare(sql: string): SqliteStatement {
    return this.graph.db.prepareSqliteStatement(sql);
  }
  public constructor(public readonly graph: Graph) {
    this._cachedStmts = {
      selectByRootInDirectChanges: this.prepare(`
        SELECT [SourceId],[TargetId],[Id] as [RelId],[ECClassId],[Status],[Priority]
        FROM ${NativeTables.BIS_ELEMENT_DRIVES_ELEMENT}
        WHERE ([SourceId] IN (SELECT [ElementId] FROM ${NativeTables.TXN_ELEMENT}))`),
      selectByRelationshipInDirectChanges: this.prepare(`
        SELECT SourceId,TargetId,Id as RelId,ECClassId,Status,Priority
        FROM ${NativeTables.BIS_ELEMENT_DRIVES_ELEMENT}
        WHERE ([Id] IN (SELECT ECInstanceId FROM ${NativeTables.TXN_DEPEND}))`),
      selectByRoot: this.prepare(`
        SELECT SourceId,TargetId,Id as RelId,ECClassId,Status,Priority
        FROM ${NativeTables.BIS_ELEMENT_DRIVES_ELEMENT}
        WHERE SourceId=?`),
      updateStatus: this.prepare(`UPDATE ${NativeTables.BIS_ELEMENT_DRIVES_ELEMENT} SET Status=? WHERE Id=?`),
    };
  }
  private get _stmts(): NoUndefined<typeof this._cachedStmts> {
    if (!this._cachedStmts) {
      throw new Error("Statements not initialized");
    }
    return this._cachedStmts;
  }
  public updateEdgeStatusInDb(edge: Edge, newStatus: EdgeStatus): void {
    if (!Id64.isValidId64(edge.instanceKey.instanceId)) {
      throw new Error("Invalid instanceId in edge");
    }
    if (!Id64.isValidId64(edge.instanceKey.classId)) {
      throw new Error("Invalid classId in edge");
    }
    this._stmts.updateStatus.reset();
    this._stmts.updateStatus.bindInteger(1, newStatus);
    this._stmts.updateStatus.bindId(2, edge.instanceKey.instanceId);
    const rc = this._stmts.updateStatus.step();
    if (rc !== DbResult.BE_SQLITE_DONE) {
      throw new Error(`Failed to update edge status, expected BE_SQLITE_DONE but got ${DbResult[rc]}`);
    }
  }
  private selectEdge(stmt: SqliteStatement): Edge | undefined {
    const rc = stmt.step();
    if (rc !== DbResult.BE_SQLITE_ROW) {
      return undefined; // No edge found
    }

    return {
      rootElementId: stmt.getValueId(0),
      dependentElementId: stmt.getValueId(1),
      instanceKey: {
        instanceId: stmt.getValueId(2),
        classId: stmt.getValueId(3),
      },
      status: stmt.getValueInteger(4) as EdgeStatus,
      priority: stmt.getValueInteger(5),
      isDeleted: false,
      isDirect: false,
      isEDE: true,
    };
  }
  public stepSelectWhereRootInDirectChanges(): Edge | undefined {
    return this.selectEdge(this._stmts.selectByRootInDirectChanges);
  }
  public stepSelectWhereRelationshipInDirectChanges(): Edge | undefined {
    return this.selectEdge(this._stmts.selectByRelationshipInDirectChanges);
  }
  public bindSelectByRoot(rootElementId: Id64String): void {
    if (!Id64.isValidId64(rootElementId)) {
      throw new Error("Invalid rootElementId");
    }
    this._stmts.selectByRoot.reset();
    this._stmts.selectByRoot.bindId(1, rootElementId);
  }
  public stepSelectByRoot(): Edge | undefined {
    return this.selectEdge(this._stmts.selectByRoot);
  }
}
class ChildPropagatesChangesToParent {
  private _cachedStmts: {
    selectByChildInDirectChanges: SqliteStatement;
    selectByChild: SqliteStatement;
    selectByParent: SqliteStatement;
  };
  public get stmts(): NoUndefined<typeof this._cachedStmts> {
    if (!this._cachedStmts) {
      throw new Error("Statements not initialized");
    }
    return this._cachedStmts;
  }
  private prepare(sql: string): SqliteStatement {
    return this.graph.db.prepareSqliteStatement(sql);
  }

  // TODO: dummy implementation, replace with txn.getChildPropagatesChangesToParentRelationships()
  public getChildPropagatesChangesToParentRelationships(): Id64String[] {
    return [];
  }
  private getParentRelMatch(): string {
    const relIds = this.getChildPropagatesChangesToParentRelationships();
    const matchParentRelationships = new StringBuilder();
    if (relIds.length === 1) {
      matchParentRelationships.append(` = ${relIds[0]}`);
    } else {
      matchParentRelationships.append(" IN (");
      matchParentRelationships.append(relIds.map(id => id).join(","));
      matchParentRelationships.append(")");
    }
    return matchParentRelationships.toString();
  }
  public constructor(public readonly graph: Graph) {
    const matchParentRelationships = this.getParentRelMatch();
    this._cachedStmts = {
      selectByChildInDirectChanges: this.prepare(`
        SELECT el.id, el.parentId, el.ParentRelECClassId
        FROM ${NativeTables.BIS_ELEMENT} el, ${NativeTables.TXN_ELEMENT} direct
        WHERE el.id = direct.ElementId AND el.parentId != 0x1 AND el.ParentRelECClassId ${matchParentRelationships})`),
      selectByChild: this.prepare(`
        SELECT id, parentId, ParentRelECClassId
        FROM ${NativeTables.BIS_ELEMENT}
        WHERE id = ? AND parentId != 0x1 AND ParentRelECClassId ${matchParentRelationships}`),
      selectByParent: this.prepare(`
        SELECT id, parentId, ParentRelECClassId
        FROM ${NativeTables.BIS_ELEMENT}
        WHERE parentId = ? AND ParentRelECClassId ${matchParentRelationships}`),
    };
  }
  private selectEdge(stmt: SqliteStatement): Edge | undefined {
    const rc = stmt.step();
    if (rc !== DbResult.BE_SQLITE_ROW) {
      return undefined; // No edge found
    }

    return {
      rootElementId: stmt.getValueId(0),
      dependentElementId: stmt.getValueId(1),
      instanceKey: {
        instanceId: Id64.invalid,
        classId: stmt.getValueId(2),
      },
      status: EdgeStatus.Satisfied,
      priority: 0,
      isDeleted: false,
      isDirect: false,
      isEDE: false,
    };
  }
  public stepSelectByChildInDirectChanges(): Edge | undefined {
    return this.selectEdge(this._cachedStmts.selectByChildInDirectChanges);
  }
  public bindSelectByChild(childElementId: Id64String): void {
    if (!Id64.isValidId64(childElementId)) {
      throw new Error("Invalid childElementId");
    }
    this._cachedStmts.selectByChild.reset();
    this._cachedStmts.selectByChild.bindId(1, childElementId);
  }
  public stepSelectByChild(): Edge | undefined {
    return this.selectEdge(this._cachedStmts.selectByChild);
  }
  public bindSelectByParent(parentElementId: Id64String): void {
    if (!Id64.isValidId64(parentElementId)) {
      throw new Error("Invalid parentElementId");
    }
    this._cachedStmts.selectByParent.reset();
    this._cachedStmts.selectByParent.bindId(1, parentElementId);
  }
  public stepSelectByParent(): Edge | undefined {
    return this.selectEdge(this._cachedStmts.selectByParent);
  }
}


export class Graph {
  private readonly _childPropagatesChangesToParent: ChildPropagatesChangesToParent;
  private readonly _elementDrivesElement: ElementDrivesElement;
  private readonly _edges: EdgeQueue;
  private readonly _nodes: Nodes;
  public constructor(
    public readonly db: BriefcaseDb,
  ) {
    // Initialization logic can go here
    this._childPropagatesChangesToParent = new ChildPropagatesChangesToParent(this);
    this._elementDrivesElement = new ElementDrivesElement(this);
    this._edges = new EdgeQueue(this);
    this._nodes = new Nodes(this);
  }
  public invokeAffectedDependencyHandlers() {
    this.invokeHandlersInDependencyOrder();
  }
  private updateEdgeStatusInDb(edge: Edge, newStatus: EdgeStatus): void {
    if (edge.status === newStatus) {
      return; // No change needed
    }
    this._elementDrivesElement.updateEdgeStatusInDb(edge, newStatus);
  }
  private setFailedEdgeStatusInDb(edge: Edge, failed: boolean): void {
    // set or clear failed status of the edge
    const status = failed ? edge.status | EdgeStatus.Failed : edge.status & ~EdgeStatus.Failed;
    this.updateEdgeStatusInDb(edge, status);
  }
  private invokeHandlerInTopologicalOrderOneGraph(edge: Edge): Edge[] {
    const color = this._edges.getEdgeColor(edge);
    if (color !== EdgeColor.WHITE) {
      if (color === EdgeColor.GRAY) {
        // TODO: Add logging for cycle detection
        this.setFailedEdgeStatusInDb(edge, true); // Mark as failed if already processing
      }
      return []; // Already processed or in process]
    }
    this._edges.setEdgeColor(edge, EdgeColor.GRAY); // Mark as processing
    const pathToEdge: Edge[] = [];
    pathToEdge.push(edge); // Add to processing stack
    this._edges.bindSelectByOutput(edge.rootElementId);
    const suppliers: Edge[] = [];
    let supplier = this._edges.stepSelectByOutput();
    while (supplier) {
      suppliers.push(supplier);
      supplier = this._edges.stepSelectByOutput();
    }
    for (const supplierEdge of suppliers) {
      const subPath = this.invokeHandlerInTopologicalOrderOneGraph(supplierEdge);
      pathToEdge.push(...subPath); // Add sub-path to current path
    }
    this._edges.setEdgeColor(edge, EdgeColor.BLACK); // Mark as processed
    return pathToEdge;
  }
  private invokeHandlersInDependencyOrder() {
    // Logic to invoke handlers in dependency order
  }
  private invokeHandlersTopologically() {
    this._edges.resetSelectAllOrderByPriority();
    let edge = this._edges.stepSelectAllOrderedByPriority();
    while (edge) {
      this.invokeHandlerInTopologicalOrderOneGraph(edge);
      edge = this._edges.stepSelectAllOrderedByPriority();
    }
    // TODO: Clear the edge queue after processing
    // m_txnMgr.ElementDependencies().m_deletedRels.clear();
  }
  private onDiscoverNodes(edge: Edge): void {
    this._nodes.insertNode(edge.rootElementId);
    this._nodes.insertNode(edge.dependentElementId);
    this._nodes.incrementInDegree(edge.dependentElementId);
    if (edge.isDirect) {
      this._nodes.setInputWasDirectlyChanged(edge.dependentElementId);
    }
  }
  private discoverEdges() {
    const fringe: Edge[] = [];
    const edgesSeen = new Set<string>();
    const markAsSeen = (key: InstanceKey) => {
      edgesSeen.add(`${key.classId}-${key.instanceId}`);
    }
    const hasSeen = (key: InstanceKey) => {
      return edgesSeen.has(`${key.classId}-${key.instanceId}`);
    }
    let directlyChanged = this._elementDrivesElement.stepSelectWhereRootInDirectChanges();
    while (directlyChanged) {
      directlyChanged.isDirect = true; // Mark as directly changed
      fringe.push(directlyChanged);
      directlyChanged = this._elementDrivesElement.stepSelectWhereRootInDirectChanges();
    }

    directlyChanged = this._elementDrivesElement.stepSelectWhereRelationshipInDirectChanges();
    while (directlyChanged) {
      directlyChanged.isDirect = true; // Mark as directly changed
      fringe.push(directlyChanged);
      directlyChanged = this._elementDrivesElement.stepSelectWhereRelationshipInDirectChanges();
    }

    directlyChanged = this._childPropagatesChangesToParent.stepSelectByChildInDirectChanges();
    while (directlyChanged) {
      directlyChanged.isDirect = true; // Mark as directly changed
      fringe.push(directlyChanged);
      directlyChanged = this._childPropagatesChangesToParent.stepSelectByChildInDirectChanges();
    }
    // TODO: Find and schedule the EDEs that where deleted.
    while (fringe.length > 0) {

      const workingEdges = [...fringe];
      fringe.length = 0; // Clear the fringe for next iteration
      for (const currEdge of workingEdges) {
        if (hasSeen(currEdge.instanceKey)) {
          continue; // Skip if already seen
        }
        markAsSeen(currEdge.instanceKey);
        this._edges.addEdge(currEdge); // Add edge to the queue
        this.onDiscoverNodes(currEdge); // Discover nodes for the edge

        this._elementDrivesElement.bindSelectByRoot(currEdge.dependentElementId);
        let effectedEdge = this._elementDrivesElement.stepSelectByRoot();
        while (effectedEdge) {
          if (currEdge.isDirect) {
            effectedEdge.isDirect = true; // Mark as directly changed
          }
          fringe.push(effectedEdge); // Add to fringe for further processing
          effectedEdge = this._elementDrivesElement.stepSelectByRoot();
        }
        // TODO: output currEdge could be a child element that drives its parent.
      }
    }
  }
}
//   public static formatEdge(edge: Edge): string {
//     const s= new StringBuilder();

//     s.append(formatElement(edge.rootElementId));
//     s.append("-[");
//     s.append(formatRel(edge));
//     s.append("]->");
//     s.append(formatElement(edge.dependentElementId));
//     s.append(` P=${edge.priority}`);
//     if (edge.status !== EdgeStatus.Satisfied)
//         s.append(` S=0x${edge.status.toString(16)}`);
//     if (edge.isDirect)
//         s.append(` *`);
//     return s.toString();
//    }
//

class StringBuilder {
  private _parts: string[] = [];
  public append(str: string): void {
    this._parts.push(str);
  }
  public toString(): string {
    return this._parts.join("");
  }
}
namespace NativeTables {
  export const BIS_ELEMENT_DRIVES_ELEMENT = "[main].[bis_ElementDrivesElement]";
  export const BIS_ELEMENT = "[main].[bis_Element]";
  export const TXN_ELEMENT = "[temp].[TxnElement]";
  export const TXN_NODES = "[temp].[TxnNodes]";
  export const TXN_EDGE_QUEUE = "[temp].[TxnEdgeQueue]";
  export const TXN_DEPEND = "[temp].[txn_Depend]";
}
