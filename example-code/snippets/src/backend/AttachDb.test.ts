
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { SnapshotDb } from "@itwin/core-backend";
import { IModelTestUtils } from "@itwin/core-backend/lib/cjs/test/IModelTestUtils";
import { LocalFileName } from "@itwin/core-common";
import { expect } from "chai";


describe("Attach/Detach Db", async () => {
  it("attach simulation db", async () => {
    // __PUBLISH_EXTRACT_START__ IModelDb_attachDb.code
    async function attachSimulationDb(masterFile: LocalFileName, simulationFile: LocalFileName): Promise<void> {
      const master = SnapshotDb.openFile(masterFile);

      // attach simulation db
      master.attachDb(simulationFile, "SimDb");

      const ecsql = `
      SELECT ts.TimeFromStart [Time From Start (s)],
         p.UserLabel [Pipe with Max Flow],
         MAX(ltvrr.Flow) [Max Flow (L/s)]
      FROM
          SimDb.simrescore.TimeStep ts
          INNER JOIN SimDb.stmswrres.BasicFlowResultRecord ltvrr ON ts.ECInstanceId = ltvrr.TimeStep.Id
          INNER JOIN swrhyd.Pipe p ON p.ECInstanceId = ltvrr.ElementId
      GROUP BY
            ts.ECInstanceId
      HAVING
            MAX(ltvrr.Flow) > 1 LIMIT 3`;

      const reader = master.createQueryReader(ecsql);
      const rows = [];
      while (await reader.step()) {
        rows.push(reader.current.toRow());
      }
      const expected = [
        {
          'Time From Start (s)': 0,
          'Pipe with Max Flow': 'CO-4',
          'Max Flow (L/s)': 66.14359584163114
        },
        {
          'Time From Start (s)': 3600,
          'Pipe with Max Flow': 'CO-4',
          'Max Flow (L/s)': 78.33925707748288
        },
        {
          'Time From Start (s)': 7200,
          'Pipe with Max Flow': 'CO-3',
          'Max Flow (L/s)': 85.32875334207684
        },
      ];
      expect(rows).to.deep.equal(expected);

      // detach attached db
      master.detachDb("SimDb");
      master.close();
    }
    // __PUBLISH_EXTRACT_END__
    await attachSimulationDb(IModelTestUtils.resolveAssetFile("sim-master.bim"), IModelTestUtils.resolveAssetFile("sim-attach.ecdb"));

  });
});
