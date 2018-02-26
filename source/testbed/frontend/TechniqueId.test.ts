/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { BuiltInTechniqueId, TechniqueId } from "@bentley/imodeljs-frontend/lib/render/TechniqueId";

describe("TechniqueId", () => {
  it("should create TechniqueIds and retrieve their values", () => {
    const num: number = TechniqueId.numBuiltIn();
    assert.isTrue(num === BuiltInTechniqueId.kCOUNT);
    let techId: TechniqueId = new TechniqueId();
    assert.isFalse(techId.isValid(), "TechniqueId constructed with no argument should be invalid");
    techId = new TechniqueId(BuiltInTechniqueId.kSurface);
    assert.isTrue(techId.isValid(), "TechniqueId constructed with valid argument should be valid");
    assert.isTrue(techId.getValue() === BuiltInTechniqueId.kSurface as number, "TechniqueId constructed with Surface should be Surface");

    techId = TechniqueId.surface();
    assert.isTrue(techId.isValid(), "TechniqueId constructed from surface() should be valid");
    assert.isTrue(techId.getValue() === BuiltInTechniqueId.kSurface as number, "techId from TechniqueId.surface() should return value of kSurface");
    techId = TechniqueId.polyline();
    assert.isTrue(techId.isValid(), "TechniqueId constructed from polyline() should be valid");
    assert.isTrue(techId.getValue() === BuiltInTechniqueId.kPolyline as number, "techId from TechniqueId.polyline() should return value of kPolyline");
    techId = TechniqueId.pointCloud();
    assert.isTrue(techId.isValid(), "TechniqueId constructed from pointCloud() should be valid");
    assert.isTrue(techId.getValue() === BuiltInTechniqueId.kPointCloud as number, "techId from TechniqueId.pointCloud() should return value of kPointCloud");
    techId = TechniqueId.pointString();
    assert.isTrue(techId.isValid(), "TechniqueId constructed from pointString() should be valid");
    assert.isTrue(techId.getValue() === BuiltInTechniqueId.kPointString as number, "techId from TechniqueId.pointString() should return value of kPointString");
    techId = TechniqueId.edge();
    assert.isTrue(techId.isValid(), "TechniqueId constructed from edge() should be valid");
    assert.isTrue(techId.getValue() === BuiltInTechniqueId.kEdge as number, "techId from TechniqueId.edge() should return value of kEdge");
    techId = TechniqueId.silhouetteEdge();
    assert.isTrue(techId.isValid(), "TechniqueId constructed from silhouetteEdge() should be valid");
    assert.isTrue(techId.getValue() === BuiltInTechniqueId.kSilhouetteEdge as number, "techId from TechniqueId.silhouetteEdge() should return value of kSilhouetteEdge");
    techId = TechniqueId.compositeHilite();
    assert.isTrue(techId.isValid(), "TechniqueId constructed from compositeHilite() should be valid");
    assert.isTrue(techId.getValue() === BuiltInTechniqueId.kCompositeHilite as number, "techId from TechniqueId.compositeHilite() should return value of kCompositeHilite");
    techId = TechniqueId.compositeTranslucent();
    assert.isTrue(techId.isValid(), "TechniqueId constructed from compositeTranslucent() should be valid");
    assert.isTrue(techId.getValue() === BuiltInTechniqueId.kCompositeTranslucent as number, "techId from TechniqueId.compositeTranslucent() should return value of kCompositeTranslucent");
    techId = TechniqueId.compositeHiliteAndTranslucent();
    assert.isTrue(techId.isValid(), "TechniqueId constructed from compositeHiliteAndTranslucent() should be valid");
    assert.isTrue(techId.getValue() === BuiltInTechniqueId.kCompositeHiliteAndTranslucent as number, "techId from TechniqueId.compositeHiliteAndTranslucent() should return value of kCompositeHiliteAndTranslucent");
    techId = TechniqueId.oitClearTranslucent();
    assert.isTrue(techId.isValid(), "TechniqueId constructed from oitClearTranslucent() should be valid");
    assert.isTrue(techId.getValue() === BuiltInTechniqueId.kOITClearTranslucent as number, "techId from TechniqueId.oitClearTranslucent() should return value of kOITClearTranslucent");
    techId = TechniqueId.copyPickBuffers();
    assert.isTrue(techId.isValid(), "TechniqueId constructed from copyPickBuffers() should be valid");
    assert.isTrue(techId.getValue() === BuiltInTechniqueId.kCopyPickBuffers as number, "techId from TechniqueId.copyPickBuffers() should return value of kCopyPickBuffers");
    techId = TechniqueId.copyColor();
    assert.isTrue(techId.isValid(), "TechniqueId constructed from copyColor() should be valid");
    assert.isTrue(techId.getValue() === BuiltInTechniqueId.kCopyColor as number, "techId from TechniqueId.copyColor() should return value of kCopyColor");
    techId = TechniqueId.clearPickAndColor();
    assert.isTrue(techId.isValid(), "TechniqueId constructed from clearPickAndColor() should be valid");
    assert.isTrue(techId.getValue() === BuiltInTechniqueId.kClearPickAndColor as number, "techId from TechniqueId.clearPickAndColor() should return value of kClearPickAndColor");
  });
});
