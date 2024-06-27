import * as util from "util";
import { expect } from "chai";
import { queryGeoscienceService } from "../../GraphicsProvider/GraphicRepresentationProvider";

describe("GeoscienceService", () => {
  it.only("queryGeoscienceService", async () => {
    const token = "";
    const orgId = "72adad30-c07c-465d-a1fe-2f2dfac950a4";
    const workspaceId = "9f123308-e4b9-4082-b68f-d261ce02da3c";
    const geoscienceObjId = "a0c4d7c6-d09d-4fff-8bf9-094ef5210eda";
    const args = {
      accessToken: token,
      sessionId: "testSession",
      dataSource: {
        iTwinId: orgId,
        id: workspaceId,
        changeId: geoscienceObjId,
        type: "Geoscience",
      },
      format: "3DTILES",
    };

    for await (const src of queryGeoscienceService(args)) {
      console.log(util.inspect(src, {showHidden: false, depth: null, colors: true}));
      expect(src).to.not.be.undefined;
    }
  });
});
