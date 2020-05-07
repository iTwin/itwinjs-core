/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chaiJestSnapshot from "chai-jest-snapshot";
import * as enzyme from "enzyme";

// configure enzyme (testing utils for React)
enzyme.configure({ adapter: new (require("enzyme-adapter-react-16"))() }); // tslint:disable-line:no-var-requires
chaiJestSnapshot.addSerializer(require("enzyme-to-json/serializer")); // tslint:disable-line:no-var-requires
