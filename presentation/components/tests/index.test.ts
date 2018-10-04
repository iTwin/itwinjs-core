/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as enzyme from "enzyme";
import * as chaiJestSnapshot from "chai-jest-snapshot";

// configure enzyme (testing utils for React)
enzyme.configure({ adapter: new (require("enzyme-adapter-react-16"))() }); // tslint:disable-line:no-var-requires
chaiJestSnapshot.addSerializer(require("enzyme-to-json/serializer")); // tslint:disable-line:no-var-requires
