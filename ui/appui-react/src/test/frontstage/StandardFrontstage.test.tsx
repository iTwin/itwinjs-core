/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { StageUsage, StandardContentLayouts } from "@itwin/appui-abstract";
import {
  BackstageAppButton,
  ContentGroup,
  ContentGroupProps,
  ContentGroupProvider,
  ContentProps,
  CoreTools, FrontstageManager, FrontstageProps,
} from "../../appui-react";
import TestUtils from "../TestUtils";
import { StandardFrontstageProps, StandardFrontstageProvider } from "../../appui-react/frontstage/StandardFrontstageProvider";

async function getSavedViewLayoutProps() {
  return Promise.resolve({
    contentGroupProps: {
      id: "main-content-group",
      layout: StandardContentLayouts.singleView,
      contents: [
        {
          id: "savedContent",
          classId: "saved_class",
        },
      ],
    },
  });
}

class BasicContentGroupProvider extends ContentGroupProvider {
  private initialContentGroupProps: ContentGroupProps = {
    id: "main-content-group",
    layout: StandardContentLayouts.singleView,
    contents: [
      {
        id: "primaryContent",
        classId: "test_class",
        applicationData: {
          isInitialContentTestData: true,
        },
      },
    ],
  };

  public async provideContentGroup(_props: FrontstageProps): Promise<ContentGroup> {
    return new ContentGroup(this.initialContentGroupProps);
  }
}

class TestContentGroupProvider extends ContentGroupProvider {
  private hasSavedData = false;
  private initialContentGroupProps: ContentGroupProps = {
    id: "main-content-group",
    layout: StandardContentLayouts.singleView,
    contents: [
      {
        id: "primaryContent",
        classId: "test_class",
        applicationData: {
          isInitialContentTestData: true,
        },
      },
    ],
  };

  public override prepareToSaveProps(contentGroupProps: ContentGroupProps) {
    this.hasSavedData = true;
    const newContentsArray = contentGroupProps.contents.map((content: ContentProps) => {
      const newContent = { ...content };
      if (newContent.applicationData)
        delete newContent.applicationData;
      return newContent;
    });
    return { ...contentGroupProps, contents: newContentsArray };
  }

  public override applyUpdatesToSavedProps(contentGroupProps: ContentGroupProps) {
    const newContentsArray = contentGroupProps.contents.map((content: ContentProps) => {
      const newAppData = {
        ...content.applicationData,
        supports: ["issueResolutionMarkers", "viewIdSelection", "3dModels", "2dModels"],
        isInitialContentTestData: false,
      };
      return { ...content, applicationData: newAppData };
    });
    return { ...contentGroupProps, contents: newContentsArray };
  }

  public async provideContentGroup(_props: FrontstageProps): Promise<ContentGroup> {
    if (this.hasSavedData) {
      const savedViewLayoutProps = await getSavedViewLayoutProps();
      if (savedViewLayoutProps) {
        const contentGroupProps = this.applyUpdatesToSavedProps(savedViewLayoutProps.contentGroupProps);
        return new ContentGroup(contentGroupProps);
      }
    }

    return new ContentGroup(this.initialContentGroupProps);
  }
}

describe("ContentGroupProvider", () => {
  before(async () => {
    await NoRenderApp.startup();
    await TestUtils.initializeUiFramework();
    FrontstageManager.clearFrontstageDefs();
  });

  after(async () => {
    TestUtils.terminateUiFramework();
    await IModelApp.shutdown();
  });

  beforeEach(() => {
    sinon.stub(FrontstageManager, "activeToolSettingsProvider").get(() => undefined);
    FrontstageManager.clearFrontstageDefs();
  });

  it("should exercise base Content Group Provider", async () => {
    const provider = new BasicContentGroupProvider();
    const contentGroup = await provider.provideContentGroup({ id: "test", usage: "General", defaultTool: CoreTools.selectElementCommand, contentGroup: provider });
    const savedContentGroupProps = provider.prepareToSaveProps(contentGroup.toJSON());
    expect(savedContentGroupProps).to.exist;
    const retrievedContentGroupProps = provider.applyUpdatesToSavedProps(savedContentGroupProps);
    expect(retrievedContentGroupProps).to.exist;
  });

  it("Should provide Content Group", async () => {
    const provider = new TestContentGroupProvider();

    const frontstageProps: FrontstageProps = {
      id: "test",
      usage: "General",
      defaultTool: CoreTools.selectElementCommand,
      contentGroup: provider,
      applicationData: {
        isTestStageData: true,
      },
    };

    expect(provider).to.exist;
    const contentGroup = await provider.provideContentGroup(frontstageProps);
    expect(contentGroup).to.exist;

    expect(contentGroup.groupId).to.contain("main-content-group-");
    expect(contentGroup.propsId).to.eql("main-content-group");
    expect(contentGroup.contentPropsList.length).to.eql(1);
    expect(contentGroup.contentPropsList[0].applicationData?.isInitialContentTestData).to.be.true;

    const savedContentGroupProps = provider.prepareToSaveProps(contentGroup.toJSON());
    expect(savedContentGroupProps).to.exist;
    expect(savedContentGroupProps.contents[0].applicationData).to.not.exist;

    const retrievedContentGroupProps = provider.applyUpdatesToSavedProps(savedContentGroupProps);
    expect(retrievedContentGroupProps.contents[0].applicationData).to.exist;
  });

  it("openStandardFrontstage with no corner items", async () => {
    const ui2StageProps: StandardFrontstageProps = {
      id: "Ui2",
      version: 1.1,
      contentGroupProps: new TestContentGroupProvider(),
      hideNavigationAid: true,
      cornerButton: undefined,
      usage: StageUsage.General,
      applicationData: {
        isTestStageData: true,
      },
    };

    const standardFrontstageProvider = new StandardFrontstageProvider(ui2StageProps);
    FrontstageManager.addFrontstageProvider(standardFrontstageProvider);
    await FrontstageManager.setActiveFrontstage(standardFrontstageProvider.id);
    setImmediate(async () => {
      await TestUtils.flushAsyncOperations();

      expect(FrontstageManager.activeFrontstageId).to.eq(standardFrontstageProvider.id);
    });
  });

  it("openStandardFrontstage with corner items", async () => {
    const cornerButton = <BackstageAppButton key="ui2-backstage" icon={"icon-bentley-systems"} />;

    const ui2StageProps: StandardFrontstageProps = {
      id: "Ui2",
      version: 1.1,
      contentGroupProps: new TestContentGroupProvider(),
      hideNavigationAid: false,
      cornerButton,
      usage: StageUsage.General,
      applicationData: {
        isTestStageData: true,
      },
    };

    const standardFrontstageProvider = new StandardFrontstageProvider(ui2StageProps);
    FrontstageManager.addFrontstageProvider(standardFrontstageProvider);
    await FrontstageManager.setActiveFrontstage(standardFrontstageProvider.id);
    setImmediate(async () => {
      await TestUtils.flushAsyncOperations();

      expect(FrontstageManager.activeFrontstageId).to.eq(standardFrontstageProvider.id);
    });
  });

  it("openStandardFrontstage with corner items", async () => {
    const testGroupProps: ContentGroupProps = {
      id: "main-content-group",
      layout: StandardContentLayouts.singleView,
      contents: [
        {
          id: "primaryContent",
          classId: "test_class",
          applicationData: {
            isInitialContentTestData: true,
          },
        },
      ],
    };

    const testStageProps: StandardFrontstageProps = {
      id: "test",
      contentGroupProps: testGroupProps,
      hideStatusBar: true,
      usage: StageUsage.Private,
    };

    const standardFrontstageProvider = new StandardFrontstageProvider(testStageProps);
    FrontstageManager.addFrontstageProvider(standardFrontstageProvider);
    await FrontstageManager.setActiveFrontstage(standardFrontstageProvider.id);
    setImmediate(async () => {
      await TestUtils.flushAsyncOperations();
      expect(FrontstageManager.activeFrontstageId).to.eq(standardFrontstageProvider.id);
    });
  });

});
