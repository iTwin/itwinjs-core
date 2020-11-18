# @bentley/projectshare-client

Copyright © Bentley Systems, Incorporated. All rights reserved.

## Description

The __@bentley/projectshare-client__ package contains client wrappers for sending requests to the iTwin Project Share Service.

## Documentation

See the [iModel.js](https://www.imodeljs.org) documentation for more information.

## Create user for Modeljs integration tests especially for projectshareClient tests

1. Register new account. Use for it NON-Bentley email account.
2. Go to your computer Environment Variables. (On Win-10) search for "Edit the systems environment variables", then press "Environment Variables..." and add these user variables:
    - imjs_buddi_resolve_url_using_region=102
    - imjs_default_relying_party_uri=https://qa-connect-wsg20.bentley.com
    - imjs_oidc_browser_test_client_id=imodeljs-spa-test
    - imjs_oidc_browser_test_redirect_uri=http://localhost:3000/signin-callback
    - imjs_oidc_browser_test_scopes=openid email profile organization imodelhub context-registry-service:read-only imodeljs-router reality-data:read product-settings-service projectwise-share urlps-third-party
    - imjs_test_regular_user_name={your chosen user email adress}
    - imjs_test_regular_user_password={chosen user password}


3. Go to ProjectWise iModeljsIntegrationTest (press [here](https://qa-connect-rbacportal.bentley.com/projectrole?id=ec002f93-f0c1-4ab3-a407-351848eba233#/))
4. Add your client to "Team Members". Go to "Manage" on bottom of "Team Members" section and then press on "Add User". On "Add Team Member(s)" select "Email" from drop down list and write your registered email.
5. On CMD direct project location and run command: `rush test:integration -f "@bentley/projectshare-client"` for debuging use JavaScript Debug Terminal and run this command: `npm run test:integration -- --grep "@bentley/projectshare-client"`