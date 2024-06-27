import { expect } from "chai";
import { obtainGeoscienceTilesetUrl } from "../../GraphicsProvider/GraphicsProvider";

describe("GeoscienceTiles", () => {
  it.only("obtainGeoscienceTilesetUrl", async () => {
    const token = "";
    const orgId = "72adad30-c07c-465d-a1fe-2f2dfac950a4";
    const workspaceId = "9f123308-e4b9-4082-b68f-d261ce02da3c";
    const geoscienceObjId = "a0c4d7c6-d09d-4fff-8bf9-094ef5210eda";
    const args = {
      accessToken: token,
      organizationId: orgId,
      workspaceId,
      geoscienceObjectId: geoscienceObjId,
    };

    const url = await obtainGeoscienceTilesetUrl(args);
    expect(url).to.not.be.undefined;
  });
});
