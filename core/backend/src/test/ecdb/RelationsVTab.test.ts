/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { DbResult, Id64String } from "@itwin/core-bentley";
import { QueryRowFormat } from "@itwin/core-common";
import { ECDb, ECSqlInsertResult, ECSqlStatement, ECSqlWriteStatement, SnapshotDb, SqliteStatement } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { KnownTestLocations } from "../KnownTestLocations";
import { ECDbTestHelper } from "./ECDbTestHelper";

// cspell:ignore vtab

/**
 * Tests for the `Relations()` table-valued function (experimental).
 *
 * `Relations()` is an ECSQL table-valued function that enables fast one-hop
 * relationship traversal by querying directly from a seed (ECInstanceId, ECClassId) pair.
 *
 * **Experimental feature**: Requires `ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES`
 * per-query or `PRAGMA experimental_features_enabled=true` on the connection.
 *
 * Syntax:
 *   SELECT ... FROM Relations(<ECInstanceId>, <ECClassId> [, '<direction>'])
 *     ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
 *   SELECT ... FROM ECVLib.Relations(<ECInstanceId>, <ECClassId> [, '<direction>'])
 *     ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
 *
 * Columns returned:
 *   - RelatedECInstanceId:    Id of the related instance
 *   - RelatedECClassId:       Class of the related instance
 *   - Direction:              'forward' | 'backward'
 *   - RelationshipECClassId:  Class of the traversed relationship
 *
 * Direction filter (optional 3rd argument): 'forward' | 'backward' | 'both' (default)
 */
describe("relations() virtual table", () => {
  const outDir = KnownTestLocations.outputDir;

  /** Appended to every ECSQL query to enable the experimental Relations() vtab. */
  const experimentalOpt = "ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES";

  // ──────────────────────────────────────────────────────────
  // Schema: link-table relationship (many-to-many)
  // ──────────────────────────────────────────────────────────
  const linkTableSchema = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestLinkTable" alias="tlt" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECEntityClass typeName="Device" modifier="None">
        <ECProperty propertyName="Name" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="Cable" modifier="None">
        <ECProperty propertyName="Label" typeName="string"/>
      </ECEntityClass>
      <ECRelationshipClass typeName="DeviceConnectedByCable" modifier="None" strength="referencing">
        <Source multiplicity="(0..*)" roleLabel="connects from" polymorphic="true">
          <Class class="Device"/>
        </Source>
        <Target multiplicity="(0..*)" roleLabel="connects to" polymorphic="true">
          <Class class="Cable"/>
        </Target>
      </ECRelationshipClass>
    </ECSchema>`;

  // ──────────────────────────────────────────────────────────
  // Schema: nav-prop relationship (foreign-key based)
  // ──────────────────────────────────────────────────────────
  const navPropSchema = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestNavProp" alias="tnp" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECEntityClass typeName="Folder" modifier="None">
        <ECProperty propertyName="Name" typeName="string"/>
      </ECEntityClass>
      <ECEntityClass typeName="Document" modifier="None">
        <ECProperty propertyName="Title" typeName="string"/>
        <ECNavigationProperty propertyName="Folder" relationshipName="FolderContainsDocuments" direction="backward"/>
      </ECEntityClass>
      <ECRelationshipClass typeName="FolderContainsDocuments" modifier="None" strength="embedding">
        <Source multiplicity="(0..1)" roleLabel="contains" polymorphic="false">
          <Class class="Folder"/>
        </Source>
        <Target multiplicity="(0..*)" roleLabel="is in" polymorphic="false">
          <Class class="Document"/>
        </Target>
      </ECRelationshipClass>
    </ECSchema>`;

  // ──────────────────────────────────────────────────────────
  // Schema: graph with self-referencing link-table relationship
  // ──────────────────────────────────────────────────────────
  const graphSchema = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestGraph" alias="tg" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECEntityClass typeName="Node" modifier="None">
        <ECProperty propertyName="Label" typeName="string"/>
      </ECEntityClass>
      <ECRelationshipClass typeName="NodeConnectsNode" modifier="None" strength="referencing">
        <Source multiplicity="(0..*)" roleLabel="connects" polymorphic="true">
          <Class class="Node"/>
        </Source>
        <Target multiplicity="(0..*)" roleLabel="connected by" polymorphic="true">
          <Class class="Node"/>
        </Target>
      </ECRelationshipClass>
    </ECSchema>`;

  // ── Helpers ────────────────────────────────────────────────

  /** Insert a row via ECSQL and return the ECInstanceId. */
  function insertRow(ecdb: ECDb, ecsql: string): Id64String {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return ecdb.withCachedWriteStatement(ecsql, (stmt: ECSqlWriteStatement) => {
      const res: ECSqlInsertResult = stmt.stepForInsert();
      assert.equal(res.status, DbResult.BE_SQLITE_DONE);
      assert.isDefined(res.id);
      return res.id!;
    });
  }

  /** Look up the ECClassId for a class name via ECSQL meta tables. */
  function classIdOf(ecdb: ECDb, className: string): Id64String {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return ecdb.withPreparedStatement(
      `SELECT ECInstanceId FROM meta.ECClassDef WHERE Name=?`,
      (stmt) => {
        stmt.bindString(1, className.split(".").pop()!);
        assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
        return stmt.getValue(0).getId();
      },
    );
  }

  /** Relation row returned by the virtual table. */
  interface RelationRow {
    relatedECInstanceId: Id64String;
    relatedECClassId: Id64String;
    direction: string;
    relationshipECClassId: Id64String;
  }

  /** Collect all rows from an ECSQL Relations() query via createQueryReader. */
  async function queryRelations(ecdb: ECDb, ecsql: string): Promise<RelationRow[]> {
    const rows: RelationRow[] = [];
    for await (const row of ecdb.createQueryReader(`${ecsql} ${experimentalOpt}`, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      rows.push({
        relatedECInstanceId: row.relatedECInstanceId,
        relatedECClassId: row.relatedECClassId,
        direction: row.direction,
        relationshipECClassId: row.relationshipECClassId,
      });
    }
    return rows;
  }

  /** Collect (RelatedECInstanceId, Direction) from an ECSQL Relations() query. */
  async function queryRelationsIdDir(ecdb: ECDb, ecsql: string): Promise<Array<{ relatedECInstanceId: Id64String; direction: string }>> {
    const rows: Array<{ relatedECInstanceId: Id64String; direction: string }> = [];
    for await (const row of ecdb.createQueryReader(`${ecsql} ${experimentalOpt}`, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      rows.push({
        relatedECInstanceId: row.relatedECInstanceId,
        direction: row.direction,
      });
    }
    return rows;
  }

  /** Run an ECSQL query and collect all rows as JS objects. */
  async function queryAll(ecdb: ECDb, ecsql: string): Promise<any[]> {
    const rows: any[] = [];
    for await (const row of ecdb.createQueryReader(`${ecsql} ${experimentalOpt}`, undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      rows.push(row.toRow());
    }
    return rows;
  }

  /**
   * Run an ECSQL query synchronously via withPreparedStatement (direct ECSqlStatement path).
   */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  function querySync(ecdb: ECDb, ecsql: string): any[] {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return ecdb.withPreparedStatement(`${ecsql} ${experimentalOpt}`, (stmt: ECSqlStatement) => {
      const rows: any[] = [];
      while (stmt.step() === DbResult.BE_SQLITE_ROW)
        rows.push(stmt.getRow());
      return rows;
    });
  }

  // ════════════════════════════════════════════════════════════
  // Link-table relationship tests
  // ════════════════════════════════════════════════════════════

  describe("link-table relationships", () => {
    let ecdb: ECDb;
    let deviceAId: Id64String;
    let deviceBId: Id64String;
    let cable1Id: Id64String;
    let cable2Id: Id64String;
    let deviceClassId: Id64String;
    let cableClassId: Id64String;

    before(() => {
      ecdb = ECDbTestHelper.createECDb(outDir, "relations_linktable.ecdb", linkTableSchema);
      assert.isTrue(ecdb.isOpen);

      deviceAId = insertRow(ecdb, "INSERT INTO tlt.Device(Name) VALUES('DeviceA')");
      deviceBId = insertRow(ecdb, "INSERT INTO tlt.Device(Name) VALUES('DeviceB')");
      cable1Id = insertRow(ecdb, "INSERT INTO tlt.Cable(Label) VALUES('CableX')");
      cable2Id = insertRow(ecdb, "INSERT INTO tlt.Cable(Label) VALUES('CableY')");

      insertRow(ecdb, `INSERT INTO tlt.DeviceConnectedByCable(SourceECInstanceId, TargetECInstanceId) VALUES(${deviceAId}, ${cable1Id})`);
      insertRow(ecdb, `INSERT INTO tlt.DeviceConnectedByCable(SourceECInstanceId, TargetECInstanceId) VALUES(${deviceAId}, ${cable2Id})`);
      insertRow(ecdb, `INSERT INTO tlt.DeviceConnectedByCable(SourceECInstanceId, TargetECInstanceId) VALUES(${deviceBId}, ${cable1Id})`);

      ecdb.saveChanges();
      deviceClassId = classIdOf(ecdb, "Device");
      cableClassId = classIdOf(ecdb, "Cable");
    });

    after(() => { ecdb.closeDb(); });

    it("forward traversal returns target instances", async () => {
      const rows = await queryRelations(ecdb,
        `SELECT RelatedECInstanceId, RelatedECClassId, Direction, RelationshipECClassId
         FROM ECVLib.Relations(${deviceAId}, ${deviceClassId}, 'forward')`);

      assert.equal(rows.length, 2);
      const relatedIds = rows.map((r) => r.relatedECInstanceId);
      assert.includeMembers(relatedIds, [cable1Id, cable2Id]);
      for (const row of rows) assert.equal(row.direction, "forward");
    });

    it("backward traversal returns source instances", async () => {
      const rows = await queryRelations(ecdb,
        `SELECT RelatedECInstanceId, RelatedECClassId, Direction, RelationshipECClassId
         FROM ECVLib.Relations(${cable1Id}, ${cableClassId}, 'backward')`);

      assert.equal(rows.length, 2);
      const relatedIds = rows.map((r) => r.relatedECInstanceId);
      assert.includeMembers(relatedIds, [deviceAId, deviceBId]);
      for (const row of rows) assert.equal(row.direction, "backward");
    });

    it("default direction (both) returns all related instances", async () => {
      const rows = await queryRelationsIdDir(ecdb,
        `SELECT RelatedECInstanceId, Direction
         FROM ECVLib.Relations(${deviceAId}, ${deviceClassId})`);

      assert.isAtLeast(rows.length, 2);
      const relatedIds = rows.map((r) => r.relatedECInstanceId);
      assert.includeMembers(relatedIds, [cable1Id, cable2Id]);
    });

    it("RelationshipECClassId is populated", async () => {
      const rows = await queryRelations(ecdb,
        `SELECT RelatedECInstanceId, RelatedECClassId, Direction, RelationshipECClassId
         FROM ECVLib.Relations(${deviceAId}, ${deviceClassId}, 'forward')`);

      assert.isAbove(rows.length, 0);
      for (const row of rows) {
        assert.isDefined(row.relationshipECClassId);
        assert.notEqual(row.relationshipECClassId, "0");
      }
    });

    it("unqualified Relations() works without schema prefix", async () => {
      const rows = await queryRelationsIdDir(ecdb,
        `SELECT RelatedECInstanceId, Direction
         FROM Relations(${deviceAId}, ${deviceClassId}, 'forward')`);

      assert.equal(rows.length, 2);
      const relatedIds = rows.map((r) => r.relatedECInstanceId);
      assert.includeMembers(relatedIds, [cable1Id, cable2Id]);
    });
  });

  // ════════════════════════════════════════════════════════════
  // Nav-prop (foreign-key) relationship tests
  // ════════════════════════════════════════════════════════════

  // Nav-prop (foreign-key) relationship traversal is not yet supported by the native vtab.
  describe.skip("nav-prop relationships", () => {
    let ecdb: ECDb;
    let folderId: Id64String;
    let doc1Id: Id64String;
    let doc2Id: Id64String;
    let folderClassId: Id64String;
    let documentClassId: Id64String;

    before(() => {
      ecdb = ECDbTestHelper.createECDb(outDir, "relations_navprop.ecdb", navPropSchema);
      assert.isTrue(ecdb.isOpen);

      folderId = insertRow(ecdb, "INSERT INTO tnp.Folder(Name) VALUES('MyFolder')");
      doc1Id = insertRow(ecdb, `INSERT INTO tnp.Document(Title, Folder.Id) VALUES('Doc1', ${folderId})`);
      doc2Id = insertRow(ecdb, `INSERT INTO tnp.Document(Title, Folder.Id) VALUES('Doc2', ${folderId})`);

      ecdb.saveChanges();
      folderClassId = classIdOf(ecdb, "Folder");
      documentClassId = classIdOf(ecdb, "Document");
    });

    after(() => { ecdb.closeDb(); });

    it("forward from Folder finds child Documents", async () => {
      const rows = await queryRelationsIdDir(ecdb,
        `SELECT RelatedECInstanceId, Direction
         FROM ECVLib.Relations(${folderId}, ${folderClassId}, 'forward')`);

      const relatedIds = rows.map((r) => r.relatedECInstanceId);
      assert.includeMembers(relatedIds, [doc1Id, doc2Id]);
    });

    it("backward from Document finds parent Folder", async () => {
      const rows = await queryRelationsIdDir(ecdb,
        `SELECT RelatedECInstanceId, Direction
         FROM ECVLib.Relations(${doc1Id}, ${documentClassId}, 'backward')`);

      assert.isAbove(rows.length, 0);
      const relatedIds = rows.map((r) => r.relatedECInstanceId);
      assert.include(relatedIds, folderId);
    });
  });

  // ════════════════════════════════════════════════════════════
  // JOIN: Relations() combined with ECSQL entity query
  // ════════════════════════════════════════════════════════════

  describe("JOIN with element data", () => {
    let ecdb: ECDb;
    let deviceAId: Id64String;
    let deviceAClassId: Id64String;

    before(() => {
      ecdb = ECDbTestHelper.createECDb(outDir, "relations_join.ecdb", linkTableSchema);
      assert.isTrue(ecdb.isOpen);

      deviceAId = insertRow(ecdb, "INSERT INTO tlt.Device(Name) VALUES('Hub')");
      insertRow(ecdb, `INSERT INTO tlt.Cable(Label) VALUES('CableA')`);
      insertRow(ecdb, `INSERT INTO tlt.Cable(Label) VALUES('CableB')`);

      // Get the cable IDs we just inserted
      const cables: Id64String[] = [];
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      ecdb.withPreparedStatement("SELECT ECInstanceId FROM tlt.Cable", (stmt: ECSqlStatement) => {
        while (stmt.step() === DbResult.BE_SQLITE_ROW)
          cables.push(stmt.getValue(0).getId());
      });

      for (const cId of cables)
        insertRow(ecdb, `INSERT INTO tlt.DeviceConnectedByCable(SourceECInstanceId, TargetECInstanceId) VALUES(${deviceAId}, ${cId})`);

      ecdb.saveChanges();
      deviceAClassId = classIdOf(ecdb, "Device");
    });

    after(() => { ecdb.closeDb(); });

    it("JOIN Relations() with ECSQL entity class to get properties", async () => {
      const rows = await queryAll(ecdb,
        `SELECT c.Label, r.Direction
         FROM tlt.Cable c
         JOIN ECVLib.Relations(${deviceAId}, ${deviceAClassId}) r
           ON r.RelatedECInstanceId = c.ECInstanceId`);

      assert.equal(rows.length, 2);
      const labels = rows.map((r: any) => r.label);
      assert.includeMembers(labels, ["CableA", "CableB"]);
    });

    it("subquery: filter elements by relationship", async () => {
      const rows = await queryAll(ecdb,
        `SELECT ECInstanceId, Label
         FROM tlt.Cable
         WHERE ECInstanceId IN (
           SELECT RelatedECInstanceId FROM ECVLib.Relations(${deviceAId}, ${deviceAClassId}, 'forward')
         )`);

      assert.equal(rows.length, 2);
      const labels = rows.map((r: any) => r.label);
      assert.includeMembers(labels, ["CableA", "CableB"]);
    });
  });

  // ════════════════════════════════════════════════════════════
  // Multi-hop graph traversal (programmatic BFS using Relations() TVF)
  // ════════════════════════════════════════════════════════════

  describe("multi-hop graph traversal", () => {
    let ecdb: ECDb;
    let nodeAId: Id64String;
    let nodeBId: Id64String;
    let nodeCId: Id64String;
    let nodeDId: Id64String;
    let nodeClassId: Id64String;

    before(() => {
      ecdb = ECDbTestHelper.createECDb(outDir, "relations_cte.ecdb", graphSchema);
      assert.isTrue(ecdb.isOpen);

      nodeAId = insertRow(ecdb, "INSERT INTO tg.Node(Label) VALUES('A')");
      nodeBId = insertRow(ecdb, "INSERT INTO tg.Node(Label) VALUES('B')");
      nodeCId = insertRow(ecdb, "INSERT INTO tg.Node(Label) VALUES('C')");
      nodeDId = insertRow(ecdb, "INSERT INTO tg.Node(Label) VALUES('D')");

      insertRow(ecdb, `INSERT INTO tg.NodeConnectsNode(SourceECInstanceId, TargetECInstanceId) VALUES(${nodeAId}, ${nodeBId})`);
      insertRow(ecdb, `INSERT INTO tg.NodeConnectsNode(SourceECInstanceId, TargetECInstanceId) VALUES(${nodeBId}, ${nodeCId})`);
      insertRow(ecdb, `INSERT INTO tg.NodeConnectsNode(SourceECInstanceId, TargetECInstanceId) VALUES(${nodeCId}, ${nodeDId})`);

      ecdb.saveChanges();
      nodeClassId = classIdOf(ecdb, "Node");
    });

    after(() => { ecdb.closeDb(); });

    /** BFS: walk forward from a seed, collecting all reachable IDs up to maxDepth. */
    function bfsForward(db: ECDb, seedId: Id64String, seedClassId: Id64String, maxDepth: number): Set<Id64String> {
      const visited = new Set<Id64String>();
      let frontier: Array<{ id: Id64String; classId: Id64String }> = [{ id: seedId, classId: seedClassId }];
      for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
        const next: Array<{ id: Id64String; classId: Id64String }> = [];
        for (const node of frontier) {
          const rows = querySync(db,
            `SELECT RelatedECInstanceId, RelatedECClassId FROM ECVLib.Relations(${node.id}, ${node.classId}, 'forward')`);
          for (const r of rows) {
            if (!visited.has(r.relatedECInstanceId)) {
              visited.add(r.relatedECInstanceId);
              next.push({ id: r.relatedECInstanceId, classId: r.relatedECClassId });
            }
          }
        }
        frontier = next;
      }
      return visited;
    }

    it("multi-hop BFS walks the full chain A→B→C→D", () => {
      const reachable = bfsForward(ecdb, nodeAId, nodeClassId, 5);
      assert.isTrue(reachable.has(nodeBId), "B should be reachable from A");
      assert.isTrue(reachable.has(nodeCId), "C should be reachable from A");
      assert.isTrue(reachable.has(nodeDId), "D should be reachable from A");
    });

    it("depth limit stops BFS early", () => {
      const reachable = bfsForward(ecdb, nodeAId, nodeClassId, 1);
      assert.isTrue(reachable.has(nodeBId), "B should be reachable at depth 1");
      assert.isFalse(reachable.has(nodeCId), "C should NOT be reachable at depth 1");
      assert.isFalse(reachable.has(nodeDId), "D should NOT be reachable at depth 1");
    });

    it("recursive CTE walks the full chain from A", async () => {
      const rows = await queryAll(ecdb,
        `WITH RECURSIVE graph(ECInstanceId, ECClassId, Depth) AS (
            VALUES (${nodeAId}, ${nodeClassId}, 0)
            UNION
            SELECT r.RelatedECInstanceId, r.RelatedECClassId, g.Depth + 1
            FROM graph g, ECVLib.Relations(g.ECInstanceId, g.ECClassId, 'forward') r
            WHERE g.Depth < 5
         )
         SELECT DISTINCT ECInstanceId, Depth FROM graph ORDER BY Depth`);

      assert.isAtLeast(rows.length, 4);
      // CTE columns are returned as raw integers, not hex Id64 strings
      const ids = rows.map((r: any) => `0x${Number(r.eCInstanceId).toString(16)}`);
      assert.includeMembers(ids, [nodeAId, nodeBId, nodeCId, nodeDId]);
    });

    it("CTE depth limit stops early", async () => {
      const rows = await queryAll(ecdb,
        `WITH RECURSIVE graph(ECInstanceId, ECClassId, Depth) AS (
            VALUES (${nodeAId}, ${nodeClassId}, 0)
            UNION
            SELECT r.RelatedECInstanceId, r.RelatedECClassId, g.Depth + 1
            FROM graph g, ECVLib.Relations(g.ECInstanceId, g.ECClassId, 'forward') r
            WHERE g.Depth < 1
         )
         SELECT DISTINCT ECInstanceId, Depth FROM graph ORDER BY Depth`);

      assert.equal(rows.length, 2);
      const ids = rows.map((r: any) => `0x${Number(r.eCInstanceId).toString(16)}`);
      assert.includeMembers(ids, [nodeAId, nodeBId]);
      assert.notInclude(ids, nodeDId);
    });

    it("chained multi-hop via cross-join", async () => {
      const rows = await queryAll(ecdb,
        `SELECT r2.RelatedECInstanceId
         FROM tg.Node a,
              ECVLib.Relations(a.ECInstanceId, a.ECClassId, 'forward') r1,
              ECVLib.Relations(r1.RelatedECInstanceId, r1.RelatedECClassId, 'forward') r2
         WHERE a.ECInstanceId = ${nodeAId}`);

      assert.isAbove(rows.length, 0);
      const ids = rows.map((r: any) => r.relatedECInstanceId);
      assert.include(ids, nodeCId, "Two-hop from A should reach C");
    });
  });

  // ════════════════════════════════════════════════════════════
  // Mixed relationship types (link-table + nav-prop)
  // ════════════════════════════════════════════════════════════

  // Mixed traversal depends on nav-prop support, which is not yet available in the native vtab.
  describe.skip("mixed link-table and nav-prop traversal", () => {
    let ecdb: ECDb;
    let nodeId: Id64String;
    let otherNodeId: Id64String;
    let tagId: Id64String;
    let nodeClassId: Id64String;

    const mixedSchema = `<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="TestMixed" alias="tmx" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECEntityClass typeName="Node" modifier="None">
          <ECProperty propertyName="Label" typeName="string"/>
        </ECEntityClass>
        <ECEntityClass typeName="Tag" modifier="None">
          <ECProperty propertyName="Value" typeName="string"/>
          <ECNavigationProperty propertyName="Owner" relationshipName="NodeHasTag" direction="backward"/>
        </ECEntityClass>
        <ECRelationshipClass typeName="NodeConnectsNode" modifier="None" strength="referencing">
          <Source multiplicity="(0..*)" roleLabel="connects" polymorphic="true">
            <Class class="Node"/>
          </Source>
          <Target multiplicity="(0..*)" roleLabel="connected by" polymorphic="true">
            <Class class="Node"/>
          </Target>
        </ECRelationshipClass>
        <ECRelationshipClass typeName="NodeHasTag" modifier="None" strength="embedding">
          <Source multiplicity="(0..1)" roleLabel="has tag" polymorphic="true">
            <Class class="Node"/>
          </Source>
          <Target multiplicity="(0..*)" roleLabel="tagged on" polymorphic="false">
            <Class class="Tag"/>
          </Target>
        </ECRelationshipClass>
      </ECSchema>`;

    before(() => {
      ecdb = ECDbTestHelper.createECDb(outDir, "relations_mixed.ecdb", mixedSchema);
      assert.isTrue(ecdb.isOpen);

      nodeId = insertRow(ecdb, "INSERT INTO tmx.Node(Label) VALUES('Center')");
      otherNodeId = insertRow(ecdb, "INSERT INTO tmx.Node(Label) VALUES('Peer')");

      // Insert Tag then set nav-prop FK via raw SQLite (workaround for ECSQL nav-prop insert)
      tagId = insertRow(ecdb, "INSERT INTO tmx.Tag(Value) VALUES('important')");
      const relClassId = classIdOf(ecdb, "NodeHasTag");
      ecdb.withSqliteStatement(
        `UPDATE [tmx_Tag] SET OwnerId = ${nodeId}, OwnerRelECClassId = ${relClassId} WHERE Id = ${tagId}`,
        (stmt: SqliteStatement) => { assert.equal(stmt.step(), DbResult.BE_SQLITE_DONE); },
      );

      // Link-table: Center -> Peer
      insertRow(ecdb, `INSERT INTO tmx.NodeConnectsNode(SourceECInstanceId, TargetECInstanceId) VALUES(${nodeId}, ${otherNodeId})`);

      ecdb.saveChanges();
      nodeClassId = classIdOf(ecdb, "Node");
    });

    after(() => { ecdb.closeDb(); });

    it("traversal returns both link-table and nav-prop related instances", async () => {
      const rows = await queryRelationsIdDir(ecdb,
        `SELECT RelatedECInstanceId, Direction
         FROM ECVLib.Relations(${nodeId}, ${nodeClassId})`);

      const relatedIds = rows.map((r) => r.relatedECInstanceId);
      assert.includeMembers(relatedIds, [otherNodeId, tagId]);
    });
  });

  // ════════════════════════════════════════════════════════════
  // Edge cases
  // ════════════════════════════════════════════════════════════

  describe("edge cases", () => {
    let ecdb: ECDb;
    let isolatedId: Id64String;
    let isolatedClassId: Id64String;

    before(() => {
      ecdb = ECDbTestHelper.createECDb(outDir, "relations_edge.ecdb", linkTableSchema);
      assert.isTrue(ecdb.isOpen);

      isolatedId = insertRow(ecdb, "INSERT INTO tlt.Device(Name) VALUES('Isolated')");
      ecdb.saveChanges();
      isolatedClassId = classIdOf(ecdb, "Device");
    });

    after(() => { ecdb.closeDb(); });

    it("isolated node returns no related instances", async () => {
      const rows = await queryRelations(ecdb,
        `SELECT RelatedECInstanceId, RelatedECClassId, Direction, RelationshipECClassId
         FROM ECVLib.Relations(${isolatedId}, ${isolatedClassId})`);

      assert.equal(rows.length, 0);
    });
  });

  // ════════════════════════════════════════════════════════════
  // Graph intersection (common nodes from two seeds via BFS)
  // ════════════════════════════════════════════════════════════

  describe("graph intersection", () => {
    let ecdb: ECDb;
    let seedA: Id64String;
    let seedB: Id64String;
    let shared: Id64String;
    let onlyA: Id64String;
    let onlyB: Id64String;
    let nodeClassId: Id64String;

    before(() => {
      ecdb = ECDbTestHelper.createECDb(outDir, "relations_intersection.ecdb", graphSchema);
      assert.isTrue(ecdb.isOpen);

      seedA = insertRow(ecdb, "INSERT INTO tg.Node(Label) VALUES('SeedA')");
      seedB = insertRow(ecdb, "INSERT INTO tg.Node(Label) VALUES('SeedB')");
      shared = insertRow(ecdb, "INSERT INTO tg.Node(Label) VALUES('Shared')");
      onlyA = insertRow(ecdb, "INSERT INTO tg.Node(Label) VALUES('OnlyA')");
      onlyB = insertRow(ecdb, "INSERT INTO tg.Node(Label) VALUES('OnlyB')");

      insertRow(ecdb, `INSERT INTO tg.NodeConnectsNode(SourceECInstanceId, TargetECInstanceId) VALUES(${seedA}, ${onlyA})`);
      insertRow(ecdb, `INSERT INTO tg.NodeConnectsNode(SourceECInstanceId, TargetECInstanceId) VALUES(${onlyA}, ${shared})`);
      insertRow(ecdb, `INSERT INTO tg.NodeConnectsNode(SourceECInstanceId, TargetECInstanceId) VALUES(${seedB}, ${onlyB})`);
      insertRow(ecdb, `INSERT INTO tg.NodeConnectsNode(SourceECInstanceId, TargetECInstanceId) VALUES(${onlyB}, ${shared})`);

      ecdb.saveChanges();
      nodeClassId = classIdOf(ecdb, "Node");
    });

    after(() => { ecdb.closeDb(); });

    /** Collect all forward-reachable IDs from a seed via BFS (max 10 hops). */
    function collectReachable(db: ECDb, seedId: Id64String, classId: Id64String): Set<Id64String> {
      const visited = new Set<Id64String>([seedId]);
      let frontier: Array<{ id: Id64String; classId: Id64String }> = [{ id: seedId, classId }];
      for (let depth = 0; depth < 10 && frontier.length > 0; depth++) {
        const next: Array<{ id: Id64String; classId: Id64String }> = [];
        for (const node of frontier) {
          const rows = querySync(db,
            `SELECT RelatedECInstanceId, RelatedECClassId FROM ECVLib.Relations(${node.id}, ${node.classId}, 'forward')`);
          for (const r of rows) {
            if (!visited.has(r.relatedECInstanceId)) {
              visited.add(r.relatedECInstanceId);
              next.push({ id: r.relatedECInstanceId, classId: r.relatedECClassId });
            }
          }
        }
        frontier = next;
      }
      return visited;
    }

    it("intersection finds shared nodes between two seeds", () => {
      const reachableA = collectReachable(ecdb, seedA, nodeClassId);
      const reachableB = collectReachable(ecdb, seedB, nodeClassId);

      const intersection = new Set([...reachableA].filter((id) => reachableB.has(id)));
      assert.isTrue(intersection.has(shared), "Shared node should appear in intersection");
      assert.isFalse(intersection.has(onlyA), "OnlyA should not appear in intersection");
      assert.isFalse(intersection.has(onlyB), "OnlyB should not appear in intersection");
    });
  });

  // ════════════════════════════════════════════════════════════
  // Graph union (all reachable nodes from two seeds via BFS)
  // ════════════════════════════════════════════════════════════

  describe("graph union", () => {
    let ecdb: ECDb;
    let seedA: Id64String;
    let seedB: Id64String;
    let nodeA1: Id64String;
    let nodeB1: Id64String;
    let nodeClassId: Id64String;

    before(() => {
      ecdb = ECDbTestHelper.createECDb(outDir, "relations_union.ecdb", graphSchema);
      assert.isTrue(ecdb.isOpen);

      seedA = insertRow(ecdb, "INSERT INTO tg.Node(Label) VALUES('SeedA')");
      seedB = insertRow(ecdb, "INSERT INTO tg.Node(Label) VALUES('SeedB')");
      nodeA1 = insertRow(ecdb, "INSERT INTO tg.Node(Label) VALUES('A1')");
      nodeB1 = insertRow(ecdb, "INSERT INTO tg.Node(Label) VALUES('B1')");

      insertRow(ecdb, `INSERT INTO tg.NodeConnectsNode(SourceECInstanceId, TargetECInstanceId) VALUES(${seedA}, ${nodeA1})`);
      insertRow(ecdb, `INSERT INTO tg.NodeConnectsNode(SourceECInstanceId, TargetECInstanceId) VALUES(${seedB}, ${nodeB1})`);

      ecdb.saveChanges();
      nodeClassId = classIdOf(ecdb, "Node");
    });

    after(() => { ecdb.closeDb(); });

    it("union combines reachable nodes from both seeds", async () => {
      const reachableA = new Set<Id64String>();
      for await (const row of ecdb.createQueryReader(
        `SELECT RelatedECInstanceId FROM ECVLib.Relations(${seedA}, ${nodeClassId}, 'forward') ${experimentalOpt}`,
        undefined,
        { rowFormat: QueryRowFormat.UseJsPropertyNames },
      )) {
        reachableA.add(row.relatedECInstanceId);
      }
      reachableA.add(seedA);

      const reachableB = new Set<Id64String>();
      for await (const row of ecdb.createQueryReader(
        `SELECT RelatedECInstanceId FROM ECVLib.Relations(${seedB}, ${nodeClassId}, 'forward') ${experimentalOpt}`,
        undefined,
        { rowFormat: QueryRowFormat.UseJsPropertyNames },
      )) {
        reachableB.add(row.relatedECInstanceId);
      }
      reachableB.add(seedB);

      const unionIds = new Set([...reachableA, ...reachableB]);
      assert.isTrue(unionIds.has(seedA));
      assert.isTrue(unionIds.has(seedB));
      assert.isTrue(unionIds.has(nodeA1));
      assert.isTrue(unionIds.has(nodeB1));
    });
  });

  // ════════════════════════════════════════════════════════════
  // Test with real iModel (BIS relationships)
  // ════════════════════════════════════════════════════════════

  describe("with real iModel", () => {
    let imodel: SnapshotDb;

    before(async () => {
      imodel = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("test.bim"));
    });

    after(async () => {
      imodel.close();
    });

    it("traverses BIS relationships from root subject", async () => {
      // Get root subject ECInstanceId and ECClassId via withPreparedStatement (avoids class name conversion)
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const { subjectId, subjectClassId } = imodel.withPreparedStatement(
        "SELECT ECInstanceId, ECClassId FROM bis.Subject LIMIT 1",
        (stmt: ECSqlStatement) => {
          assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
          return {
            subjectId: stmt.getValue(0).getId(),
            subjectClassId: stmt.getValue(1).getId(),
          };
        },
      );

      // Query relations from root subject
      const rows: RelationRow[] = [];
      for await (const row of imodel.createQueryReader(
        `SELECT RelatedECInstanceId, RelatedECClassId, Direction, RelationshipECClassId
         FROM ECVLib.Relations(${subjectId}, ${subjectClassId})
         ${experimentalOpt}`,
        undefined,
        { rowFormat: QueryRowFormat.UseJsPropertyNames },
      )) {
        rows.push({
          relatedECInstanceId: row.relatedECInstanceId,
          relatedECClassId: row.relatedECClassId,
          direction: row.direction,
          relationshipECClassId: row.relationshipECClassId,
        });
      }

      assert.isAbove(rows.length, 0, "Root subject should have related instances via BIS relationships");
    });
  });
});
