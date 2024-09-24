/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { Id64, Id64String } from "@itwin/core-bentley";
import { Code, EmptyLocalization, PlanarClipMaskMode, PlanarClipMaskProps, PlanarClipMaskSettings, RealityModelDisplaySettings } from "@itwin/core-common";
import { DisplayStyle3dState } from "../DisplayStyleState";
import { ContextRealityModelState } from "../ContextRealityModelState";
import { IModelConnection } from "../IModelConnection";
import { IModelApp } from "../IModelApp";
import { createOrbitGtTileTreeReference, createRealityTileTreeReference, OrbitGtTreeReference, TileTreeOwner } from "../tile/internal";
import { createBlankConnection } from "./createBlankConnection";

describe("ContextRealityModelState", () => {
	let imodel: IModelConnection;

	beforeAll(async () => {
		await IModelApp.startup({ localization: new EmptyLocalization() });
		imodel = createBlankConnection();
	});

	afterEach(() => {
		imodel.tiles.reset();
	});

	afterAll(async () => {
		await imodel.close();
		await IModelApp.shutdown();
	});

	interface Tree {
		id: Id64String;
		owner: TileTreeOwner;
	}

	class Style extends DisplayStyle3dState {
		public constructor() {
			super(
				{
					id: "0",
					code: Code.createEmpty(),
					model: IModelConnection.dictionaryId,
					classFullName: "BisCore:DisplayStyle3d",
				},
				imodel
			);
		}

		public attachOrbit(id: string, iTwinId?: string): ContextRealityModelState {
			const model = this.attachRealityModel({
				tilesetUrl: "",
				rdSourceKey: {
					provider: "ContextShare",
					format: "OPC",
					id,
					iTwinId,
				},
			});

			expect(model.treeRef).toBeInstanceOf(OrbitGtTreeReference);
			return model;
		}

		public get trees(): Tree[] {
			const trees: Tree[] = [];
			this.forEachRealityModel((model) => {
				expect(model.modelId).toBeDefined();
				expect(Id64.isTransient(model.modelId!)).toBe(true);
				trees.push({
					id: model.modelId!,
					owner: model.treeRef.treeOwner,
				});
			});

			return trees;
		}

		public expectTrees(modelIds: Id64String[]): void {
			const trees = this.trees;
			expect(trees.map((tree) => tree.id)).toEqual(modelIds);

			// Any context reality models with the same modelId should point to the same TileTreeOwner.
			for (const a of trees) for (const b of trees) expect(a.id === b.id).toEqual(a.owner === b.owner);
		}
	}

	describe("for tileset URL", () => {
		const planarClipMask: PlanarClipMaskProps = {
			mode: PlanarClipMaskMode.Models,
			modelIds: "+123",
		};

		it("has a unique tree within a view", () => {
			const style = new Style();
			style.expectTrees([]);

			const a = imodel.transientIds.peekNext();
			style.attachRealityModel({ tilesetUrl: "a" });
			style.expectTrees([a]);

			const b = imodel.transientIds.peekNext();
			style.attachRealityModel({ tilesetUrl: "b" });
			style.expectTrees([a, b]);

			const bMask = imodel.transientIds.peekNext();
			style.attachRealityModel({ tilesetUrl: "b", planarClipMask });
			style.expectTrees([a, b, bMask]);
		});

		it("shares compatible trees between views", () => {
			const s1 = new Style();
			const s2 = new Style();

			const a = imodel.transientIds.peekNext();
			s1.attachRealityModel({ tilesetUrl: "a" });
			s1.expectTrees([a]);

			const b = imodel.transientIds.peekNext();
			s1.attachRealityModel({ tilesetUrl: "b" });
			s1.expectTrees([a, b]);
			s2.attachRealityModel({ tilesetUrl: "b" });
			s2.expectTrees([b]);

			const bMask = imodel.transientIds.peekNext();
			s2.attachRealityModel({ tilesetUrl: "b", planarClipMask });
			s2.expectTrees([b, bMask]);

			s1.attachRealityModel({ tilesetUrl: "b", planarClipMask });
			s1.expectTrees([a, b, bMask]);

			s2.attachRealityModel({ tilesetUrl: "a" });
			s2.expectTrees([b, bMask, a]);
		});

		it("does not share trees with persistent reality models", () => {
			const style = new Style();
			const rdSourceKey = undefined as any; // API claims required but is not actually...
			const getDisplaySettings = () => RealityModelDisplaySettings.defaults;
			const persistentRef1 = createRealityTileTreeReference({
				source: style,
				iModel: imodel,
				modelId: "0x123",
				url: "a",
				getDisplaySettings,
				rdSourceKey,
			});
			expect(persistentRef1.modelId).toEqual("0x123");

			const persistentRef2 = createRealityTileTreeReference({
				source: style,
				iModel: imodel,
				modelId: "0x456",
				url: "a",
				getDisplaySettings,
				rdSourceKey,
			});
			expect(persistentRef2.modelId).toEqual("0x456");
			expect(persistentRef2.treeOwner).not.toEqual(persistentRef1.treeOwner);

			const transientId = imodel.transientIds.peekNext();
			style.attachRealityModel({ tilesetUrl: "a" });
			style.expectTrees([transientId]);
			expect(style.trees[0].owner).not.toEqual(persistentRef1.treeOwner);
			expect(style.trees[0].owner).not.toEqual(persistentRef2.treeOwner);

			const transientRef = createRealityTileTreeReference({
				source: style,
				iModel: imodel,
				modelId: transientId,
				url: "a",
				getDisplaySettings,
				rdSourceKey,
			});
			expect(transientRef.modelId).toEqual(transientId);
			expect(transientRef.treeOwner).toEqual(style.trees[0].owner);
		});

		it("keeps same modelId but gets new TileTreeOwner when settings change", () => {
			const style = new Style();
			const id = imodel.transientIds.peekNext();
			style.attachRealityModel({ tilesetUrl: "a" });
			style.expectTrees([id]);
			const a = style.trees[0].owner;

			style.forEachRealityModel((model) => (model.planarClipMaskSettings = PlanarClipMaskSettings.fromJSON(planarClipMask)));
			style.expectTrees([id]);
			const b = style.trees[0].owner;
			expect(b).not.toEqual(a);

			style.forEachRealityModel((model) => (model.planarClipMaskSettings = undefined));
			style.expectTrees([id]);
			expect(style.trees[0].owner).toEqual(a);
		});
	});

	describe("for Orbit point cloud", () => {
		it("has a unique tree within a view", () => {
			const style = new Style();
			style.expectTrees([]);

			const a = imodel.transientIds.peekNext();
			style.attachOrbit("a");
			style.expectTrees([a]);

			const b = imodel.transientIds.peekNext();
			style.attachOrbit("b");
			style.expectTrees([a, b]);

			const bMask = imodel.transientIds.peekNext();
			style.attachOrbit("b", "1");
			style.expectTrees([a, b, bMask]);
		});

		it("shares compatible trees between views", () => {
			const s1 = new Style();
			const s2 = new Style();

			const a = imodel.transientIds.peekNext();
			s1.attachOrbit("a");
			s1.expectTrees([a]);

			const b = imodel.transientIds.peekNext();
			s1.attachOrbit("b");
			s1.expectTrees([a, b]);
			s2.attachOrbit("b");
			s2.expectTrees([b]);

			const bMask = imodel.transientIds.peekNext();
			s2.attachOrbit("b", "1");
			s2.expectTrees([b, bMask]);

			s1.attachOrbit("b", "1");
			s1.expectTrees([a, b, bMask]);

			s2.attachOrbit("a");
			s2.expectTrees([b, bMask, a]);
		});

		it("does not share trees with persistent reality models", () => {
			const style = new Style();
			const rdSourceKey = {
				provider: "ContextShare",
				format: "OPC",
				id: "a",
			};

			const getDisplaySettings = () => RealityModelDisplaySettings.defaults;
			const persistentRef1 = createOrbitGtTileTreeReference({
				source: style,
				iModel: imodel,
				modelId: "0x123",
				getDisplaySettings,
				rdSourceKey,
			});
			expect(persistentRef1.modelId).toEqual("0x123");

			const persistentRef2 = createOrbitGtTileTreeReference({
				source: style,
				iModel: imodel,
				modelId: "0x456",
				getDisplaySettings,
				rdSourceKey,
			});
			expect(persistentRef2.modelId).toEqual("0x456");
			expect(persistentRef2.treeOwner).not.toEqual(persistentRef1.treeOwner);

			const transientId = imodel.transientIds.peekNext();
			style.attachOrbit("a");
			style.expectTrees([transientId]);
			expect(style.trees[0].owner).not.toEqual(persistentRef1.treeOwner);
			expect(style.trees[0].owner).not.toEqual(persistentRef2.treeOwner);

			const transientRef = createOrbitGtTileTreeReference({
				source: style,
				iModel: imodel,
				modelId: transientId,
				getDisplaySettings,
				rdSourceKey,
			});
			expect(transientRef.modelId).toEqual(transientId);
			expect(transientRef.treeOwner).toEqual(style.trees[0].owner);
		});
	});
});
