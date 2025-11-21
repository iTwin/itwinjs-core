/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BisCoreSchema, BriefcaseDb, ClassRegistry, CodeService, Element, ExportGraphics, ExportGraphicsInfo, IModelJsFs, PhysicalModel, SnapshotDb, StandaloneDb, Subject } from "@itwin/core-backend";
import { AccessToken, Guid, Id64, Id64Array, Id64String } from "@itwin/core-bentley";
import { Code, CodeScopeSpec, CodeSpec, CodeSpecProperties, ConflictingLocksError, ElementGeometryInfo, IModel } from "@itwin/core-common";
import { BentleyGeometryFlatBuffer, Geometry, IModelJson, IndexedPolyface, PolyfaceQuery, Range3d, Sphere } from "@itwin/core-geometry";
import { assert } from "chai";
import { IModelTestUtils, KnownTestLocations } from "./IModelTestUtils";

/** Example code organized as tests to make sure that it builds and runs successfully. */
describe("Example Code", () => {
  let iModel: StandaloneDb;

  const accessToken: AccessToken = "";

  before(async () => {
    iModel = IModelTestUtils.openIModelForWrite("test.bim");
  });

  after(() => {
    iModel.close();
  });

  it("should update the imodel project extents", async () => {
    // __PUBLISH_EXTRACT_START__ IModelDb.updateProjectExtents
    // This is an example of how to expand an iModel's project extents.
    const originalExtents = iModel.projectExtents;
    const newExtents = Range3d.create(originalExtents.low, originalExtents.high);
    newExtents.low.x -= 50;
    newExtents.low.y -= 25;
    newExtents.low.z -= 189;
    newExtents.high.x += 1087;
    newExtents.high.y += 19;
    newExtents.high.z += .001;
    iModel.updateProjectExtents(newExtents);
    // __PUBLISH_EXTRACT_END__
  });

  it("should check for an InUseLocksError", async () => {
    if (iModel.isBriefcase) {
      const elementId = PhysicalModel.insert(iModel, IModel.rootSubjectId, "newModelCode2");
      assert.isTrue(elementId !== undefined);
      // __PUBLISH_EXTRACT_START__ ITwinError.catchAndHandleITwinError
      try {
        await iModel.locks.acquireLocks({ exclusive: elementId });
      } catch (err: unknown) {
        if (ConflictingLocksError.isError(err)) {
          if (err.conflictingLocks) {
            for (const inUseLock of err.conflictingLocks) {
              const _briefcaseId = inUseLock.briefcaseIds[0];
              const _state = inUseLock.state;
              const _objectId = inUseLock.objectId;
              // Create a user friendly error message
            }
          }
        } else {
          throw err;
        }
        // __PUBLISH_EXTRACT_END__
      }
    }
  });

  it("should extract working example code", async () => {
    // __PUBLISH_EXTRACT_START__ BisCore.registerSchemaAndGetClass

    // Make sure somewhere in your startup code you call: IModelHost.startup()

    // Get the JavaScript class for the "Element" BIS Class
    const elementClass = ClassRegistry.findRegisteredClass("BisCore:Element")!;
    assert.equal("BisCore", elementClass.schema.schemaName);
    assert.equal("Element", elementClass.className);
    // __PUBLISH_EXTRACT_END__

    if (iModel.isBriefcase) {
      const briefcaseDb = iModel as any as BriefcaseDb; // just to eliminate all of the distracting if (iModel.isBriefcase) stuff from the code snippets

      // Make some local changes. In this example, we'll create a modeled element and a model.
      const newModeledElementId = PhysicalModel.insert(iModel, IModel.rootSubjectId, "newModelCode");
      assert.isTrue(newModeledElementId !== undefined);

      // If we do get the resources we need, we can commit the local changes to a local transaction in the IModelDb.
      briefcaseDb.saveChanges("inserted generic objects");

      // When all local changes are saved in the briefcase, we push them to the iModel server.
      await briefcaseDb.pushChanges({ accessToken, description: "comment" });
    }

    // assertions to ensure example code is working properly
    assert.equal(BisCoreSchema.schemaName, elementClass.schema.schemaName);
    assert.equal(Element.name, elementClass.name);
  });

  it("should create and insert CodeSpecs", () => {
    const testImodel = iModel;

    // __PUBLISH_EXTRACT_START__ CodeSpecs.insert
    // Create and insert a new CodeSpec with the name "CodeSpec1". In this example, we choose to make a model-scoped CodeSpec.
    const codeSpec: CodeSpec = CodeSpec.create(testImodel, "CodeSpec1", CodeScopeSpec.Type.Model);
    const codeSpecId: Id64String = testImodel.codeSpecs.insert(codeSpec);
    assert.deepEqual(codeSpecId, codeSpec.id);

    // Should not be able to insert a duplicate.
    try {
      const codeSpecDup: CodeSpec = CodeSpec.create(testImodel, "CodeSpec1", CodeScopeSpec.Type.Model);
      testImodel.codeSpecs.insert(codeSpecDup); // throws in case of error
      assert.fail();
    } catch {
      // We expect this to fail.
    }

    // We should be able to insert another CodeSpec with a different name.
    const codeSpec2: CodeSpec = CodeSpec.create(testImodel, "CodeSpec2", CodeScopeSpec.Type.Model, CodeScopeSpec.ScopeRequirement.FederationGuid);
    const codeSpec2Id: Id64String = testImodel.codeSpecs.insert(codeSpec2);
    assert.deepEqual(codeSpec2Id, codeSpec2.id);
    assert.notDeepEqual(codeSpec2Id, codeSpecId);
    // __PUBLISH_EXTRACT_END__

  });

  it("export elements from local bim file", async () => {
    const inFile = `${KnownTestLocations.assetsDir}\\test.bim`; // contains 3 translates of a sphere
    const elementIds: Id64Array = ["0x1d"]; // one of the spheres

    // __PUBLISH_EXTRACT_START__ IModelDb.exportGeometry
    // export each element as a mesh
    const singleMesh: IndexedPolyface[] = [];
    await Snippets.extractGeometryFromBimFile(inFile, elementIds, singleMesh, {noPartMesh: true});
    assert.strictEqual(1, singleMesh.length, "extracted the mesh");

    // write each element's flatbuffer serialization to a file
    const fbFileBase = `${KnownTestLocations.outputDir}\\geom`;
    await Snippets.extractGeometryFromBimFile(inFile, elementIds, fbFileBase);
    const fbFileName = `${fbFileBase}-${elementIds[0].toString()}.fb`;
    assert.isTrue(IModelJsFs.existsSync(fbFileName), "wrote first element to flatbuffer file");

    // write each element's JSON serialization to a file
    const jsonFileBase = `${KnownTestLocations.outputDir}\\geom`;
    await Snippets.extractGeometryFromBimFile(inFile, elementIds, jsonFileBase, {exportJSON: true});
    const jsonFileName = `${jsonFileBase}-${elementIds[0].toString()}.json`;
    assert.isTrue(IModelJsFs.existsSync(jsonFileName), "wrote first element to JSON file");

    // apply ecsql query to generate the ids of elements to export
    const query = "SELECT ECInstanceId FROM bis.Element WHERE ECClassId=0xe7";
    const threeMeshes: IndexedPolyface[] = [];
    await Snippets.extractGeometryFromBimFile(inFile, query, threeMeshes);
    assert.strictEqual(3, threeMeshes.length, "extracted all three meshes from the model");
    // __PUBLISH_EXTRACT_END__

    // verify fb output
    let buf = IModelJsFs.readFileSync(fbFileName);
    assert.isTrue(buf.length > 0, "read flatbuffer file");
    const bytes = new Uint8Array(Buffer.isBuffer(buf) ? buf : Buffer.from(buf));
    const geometryFromFB = BentleyGeometryFlatBuffer.bytesToGeometry(bytes, true);
    assert.isTrue(geometryFromFB !== undefined, "deserialized fb geometry");

    // verify json output
    buf = IModelJsFs.readFileSync(jsonFileName);
    assert.isTrue(buf.length > 0, "read json file");
    const geometryFromJSON = IModelJson.Reader.parse(JSON.parse(buf.toString()));
    assert.isTrue(geometryFromJSON !== undefined, "deserialized fb geometry");

    // verify geometry
    assert.instanceOf(geometryFromFB, Sphere, "FB geometry is an ellipsoid");
    assert.instanceOf(geometryFromJSON, Sphere, "JSON geometry is an ellipsoid");
    assert.isTrue((geometryFromFB as Sphere).isAlmostEqual(geometryFromJSON as Sphere), "FB and JSON geometry match");
    const radius = (geometryFromFB as Sphere).trueSphereRadius();
    assert.isTrue(radius !== undefined, "ellipsoid is a sphere");
    const meshVolume = PolyfaceQuery.sumTetrahedralVolumes(singleMesh[0]);
    const sphereVolume = 4 / 3 * Math.PI * radius! * radius! * radius!;
    assert.isTrue(Geometry.isAlmostEqualNumber(sphereVolume, meshVolume, 0.005), "mesh and sphere volumes compare");
    for (const mesh of threeMeshes)
      assert.isTrue(Geometry.isAlmostEqualNumber(meshVolume, PolyfaceQuery.sumTetrahedralVolumes(mesh)), "all meshes have same volume");
  });

  it("CodeService", async () => {

    if (false) { // this will compile but it will not run, because the root element has no federationGuid -- waiting for a fix

      // __PUBLISH_EXTRACT_START__ CodeService.reserveInternalCodeForNewElement
      const code = Subject.createCode(iModel, IModel.rootSubjectId, "main transfer pump"); // an example a code that an app might use

      const proposedCode = CodeService.makeProposedCode({ iModel, code, props: { guid: Guid.createValue() } });
      try {
        await iModel.codeService?.internalCodes?.writeLocker.reserveCode(proposedCode);
      } catch (err) {
        // reserveCode will throw if another user has already reserved this code. In that case, you must user another code.
        // In this example, we'll just fail.
        throw err;
      }

      const elementId = Subject.insert(iModel, IModel.rootSubjectId, code.value);
      // __PUBLISH_EXTRACT_END__

      // __PUBLISH_EXTRACT_START__ CodeService.updateInternalCodeForExistinglement
      const el = iModel.elements.getElement(elementId);
      el.code = new Code({ ...el.code.toJSON(), value: "secondary transfer pump" });
      try {
        await iModel.codeService?.internalCodes?.writeLocker.updateCode({ guid: el.federationGuid!, value: el.code.value });
      } catch (err) {
        // updateCode will throw if another user has already reserved this code. In that case, you must user another code.
        // In this example, we'll just fail.
        throw err;
      }

      el.update();
      // __PUBLISH_EXTRACT_END__

      // __PUBLISH_EXTRACT_START__ CodeService.addInternalCodeSpec
      const name = "myapp:codespec1";

      const props: CodeSpecProperties = {
        scopeSpec: {
          type: CodeScopeSpec.Type.Model,
          fGuidRequired: false,
        },
      };

      const nameAndJson: CodeService.NameAndJson = {
        name,
        json: {
          scopeSpec: props.scopeSpec,
          version: "1.0",
        },
      };

      await iModel.codeService?.internalCodes?.writeLocker.addCodeSpec(nameAndJson);

      iModel.codeSpecs.insert(name, props);
      // __PUBLISH_EXTRACT_END__

      // __PUBLISH_EXTRACT_START__ CodeService.findCode
      const existingCodeGuid = iModel.codeService?.internalCodes?.reader.findCode({ value: code.value, ...CodeService.makeScopeAndSpec(iModel, code) });
      if (existingCodeGuid !== undefined) {
        /* the code has already been reserved and may be in use */
      }
      // __PUBLISH_EXTRACT_END__
    }

  });

});

namespace Snippets {
  // this snippet isn't a test because it uses a fake ElementAspect class "SomeDomain:SomeAspectClass" that doesn't exist
  export function elementAspectSnippet() {
    const iModel = IModelTestUtils.openIModelForWrite("test.bim");
    const elementId = Id64.invalid;
    // __PUBLISH_EXTRACT_START__ Elements.getAspects
    const elementAspectClassFullName = "SomeDomain:SomeAspectClass";
    const elementAspects = iModel.elements.getAspects(elementId, elementAspectClassFullName);
    // __PUBLISH_EXTRACT_END__
    elementAspects;

    // __PUBLISH_EXTRACT_START__ Elements.insertAspect
    const aspectProps = {
      classFullName: "SomeDomain:SomeAspectClass",
      element: { id: elementId },
      stringProp: "s1",
      numberProp: 1,
    };
    iModel.elements.insertAspect(aspectProps);
    // __PUBLISH_EXTRACT_END__
  }

  export interface ExtractGeometryOptions {
    /** Optional flag to ignore parts when exporting meshes. */
    noPartMesh?: boolean;
    /** Optional flag to export JSON instead of the default FlatBuffers format. */
    exportJSON?: boolean;
  }

  /**
   * Given a .bim file and an array of element ids, extract the element geometry into flatbuffer files and/or export them as meshes.
   * @param bimFilePathName full pathname of input .bim file, e.g., "c:\\tmp\\foo.bim".
   * @param elementIds array of element ids in the bim file (e.g., ["0x1d", "0x2000000000a"]), or an ECSQL query that collects element ids in the first entry of each row.
   * @param geometry array to populate with meshes exported via [IModelDb.exportGraphics]($core-backend), or base pathname (e.g., "c:\\tmp\\bar") to extract element
   * geometry as flatbuffer/JSON files with names of the form `${basePathName}-${elementId.toString()}.fb/json`.
   * @param options optional settings for output content/type.
   * @returns number of elements exported
   */
  export async function extractGeometryFromBimFile(bimFilePathName: string, elementIds: Id64Array | string, geometry: IndexedPolyface[] | string, options?: ExtractGeometryOptions) {
    // __PUBLISH_EXTRACT_START__ IModelDb.extractGeometry
    const myIModel = SnapshotDb.openFile(bimFilePathName);
    const elementIdArray = Array.isArray(elementIds) ? elementIds : [];
    const query = Array.isArray(elementIds) ? "" : elementIds;
    if (query.length > 0) {
      const reader = myIModel.createQueryReader(query);
      while (await reader.step())
        elementIdArray.push(reader.current[0]);
    }
    if (elementIdArray.length === 0)
      return;
    const filePathNameBase = Array.isArray(geometry) ? undefined : geometry;
    if (filePathNameBase) {
      for (const elementId of elementIdArray) {
        myIModel.elementGeometryRequest({
          elementId,
          onGeometry: (info: ElementGeometryInfo) => {
            for (const entry of info.entryArray) {
              if (options && options.exportJSON) {
                const geom = BentleyGeometryFlatBuffer.bytesToGeometry(entry.data, true);
                const json = IModelJson.Writer.toIModelJson(geom);
                IModelJsFs.writeFileSync(`${filePathNameBase}-${elementId.toString()}.json`, JSON.stringify(json));
              } else
                IModelJsFs.writeFileSync(`${filePathNameBase}-${elementId.toString()}.fb`, entry.data);
            }
          }});
      }
    }
    const meshes = Array.isArray(geometry) ? geometry : undefined;
    if (meshes)
      myIModel.exportGraphics({
        elementIdArray,
        onGraphics: (info: ExportGraphicsInfo) => meshes.push(ExportGraphics.convertToIndexedPolyface(info.mesh)),
        partInstanceArray: (options && options.noPartMesh) ? [] : undefined,
      });
    myIModel.close();
    // __PUBLISH_EXTRACT_END__
  }

}
Snippets.elementAspectSnippet;
