/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { SnapshotDb } from "../IModelDb";
import { IModelTestUtils } from "./IModelTestUtils";

describe("Attach/Detach Db", () => {
  it("attach simulation db", async () => {
    const masterFile = IModelTestUtils.resolveAssetFile("sim-master.bim");
    const simulationFile = IModelTestUtils.resolveAssetFile("sim-attach.ecdb");

    const master = SnapshotDb.openFile(masterFile);
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
          MAX(ltvrr.Flow) > 1`;

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
      {
        'Time From Start (s)': 10800,
        'Pipe with Max Flow': 'CO-3',
        'Max Flow (L/s)': 73.66891955141061
      },
      {
        'Time From Start (s)': 14400,
        'Pipe with Max Flow': 'CO-3',
        'Max Flow (L/s)': 98.03457129303487
      },
      {
        'Time From Start (s)': 18000,
        'Pipe with Max Flow': 'CO-3',
        'Max Flow (L/s)': 79.73721449443349
      },
      {
        'Time From Start (s)': 21600,
        'Pipe with Max Flow': 'CO-4',
        'Max Flow (L/s)': 91.99697459812566
      },
      {
        'Time From Start (s)': 25200,
        'Pipe with Max Flow': 'CO-3',
        'Max Flow (L/s)': 97.3640516154515
      },
      {
        'Time From Start (s)': 28800,
        'Pipe with Max Flow': 'CO-3',
        'Max Flow (L/s)': 82.92153917380564
      },
      {
        'Time From Start (s)': 32400,
        'Pipe with Max Flow': 'CO-3',
        'Max Flow (L/s)': 93.43596024800935
      },
      {
        'Time From Start (s)': 36000,
        'Pipe with Max Flow': 'CO-1',
        'Max Flow (L/s)': 93.38944851040705
      },
      {
        'Time From Start (s)': 39600,
        'Pipe with Max Flow': 'CO-2',
        'Max Flow (L/s)': 96.89678313985426
      },
      {
        'Time From Start (s)': 43200,
        'Pipe with Max Flow': 'CO-4',
        'Max Flow (L/s)': 68.37554676909588
      },
      {
        'Time From Start (s)': 46800,
        'Pipe with Max Flow': 'CO-4',
        'Max Flow (L/s)': 40.71067873689955
      },
      {
        'Time From Start (s)': 50400,
        'Pipe with Max Flow': 'CO-2',
        'Max Flow (L/s)': 94.95603088826243
      },
      {
        'Time From Start (s)': 54000,
        'Pipe with Max Flow': 'CO-3',
        'Max Flow (L/s)': 90.30742518949977
      },
      {
        'Time From Start (s)': 57600,
        'Pipe with Max Flow': 'CO-2',
        'Max Flow (L/s)': 96.32532799368296
      },
      {
        'Time From Start (s)': 61200,
        'Pipe with Max Flow': 'CO-3',
        'Max Flow (L/s)': 98.7241157161529
      },
      {
        'Time From Start (s)': 64800,
        'Pipe with Max Flow': 'CO-1',
        'Max Flow (L/s)': 76.65530275985837
      },
      {
        'Time From Start (s)': 68400,
        'Pipe with Max Flow': 'CO-2',
        'Max Flow (L/s)': 61.81109058119374
      },
      {
        'Time From Start (s)': 72000,
        'Pipe with Max Flow': 'CO-3',
        'Max Flow (L/s)': 98.37332278792479
      },
      {
        'Time From Start (s)': 75600,
        'Pipe with Max Flow': 'CO-3',
        'Max Flow (L/s)': 70.55434454594996
      },
      {
        'Time From Start (s)': 79200,
        'Pipe with Max Flow': 'CO-2',
        'Max Flow (L/s)': 84.03731418990937
      },
      {
        'Time From Start (s)': 82800,
        'Pipe with Max Flow': 'CO-2',
        'Max Flow (L/s)': 96.3267817742375
      }
    ];
    expect(rows).to.deep.equal(expected);
  });

});
