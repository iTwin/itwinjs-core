/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as bodyParser from "body-parser";
import * as express from "express";
import { QueryAgent } from "./QueryAgent";
import { QueryAgentConfig } from "./QueryAgentConfig";
import { AccessToken } from "@bentley/imodeljs-clients";
import { Issuer, Strategy, TokenSet, UserInfo, Client } from "openid-client";
import { OpenIdConnectTokenStore } from "./OpenIdConnectTokenStore";
import * as passport from "passport";
import * as session from "express-session";

/** Container class for web server and the iModelJS backend run in the QueryAgent */
export class QueryAgentWebServer {
    private _server: any;
    private _config: QueryAgentConfig;
    private _agent: QueryAgent;

    public constructor(app: express.Express, config: QueryAgentConfig = new QueryAgentConfig(), agent: QueryAgent = new QueryAgent(config)) {
        this._config = config;
        this._agent = agent;
        // Enable CORS for all apis
        app.all("/*", (_req, res, next) => {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "Authorization, X-Requested-With");
            next();
        });

        // parse application/x-www-form-urlencoded
        app.use(bodyParser.urlencoded({
            extended: false,
        }));

        this.setupAuthRoutes(app);

        app.get("/ping", (_request, response) => response.status(200).send("Success"));

        app.set("port", this._config.port);
    }

    public async start(app: express.Express) {
        this.setupAuthStrategy();

        // tslint:disable-next-line:no-console
        this._server = app.listen(app.get("port"), () => console.log("iModel Query Agent listening on http://localhost:" + app.get("port")));
    }

    private setupAuthRoutes(app: express.Express) {
        app.use(session({
            secret: "foo",
            resave: false,
            saveUninitialized: true,
            cookie: {
                secure: false,
            },
        }));

        app.use(passport.initialize());
        app.use(passport.session());

        passport.serializeUser((user, done) => {
            done(null, user);
        });

        passport.deserializeUser((user, done) => {
            done(null, user);
        });

        app.get("/login", passport.authenticate("oidc"));

        const isLoggedIn = (req: any, res: any, next: any) => {
            if (req.isAuthenticated()) {
                console.log("Is authenticated"); // tslint:disable-line:no-console
                return next();
            }
            console.log("Not Authenticated"); // tslint:disable-line:no-console
            res.redirect("/login");
        };

        app.get("/start", isLoggedIn, async (_request, response) => {
            response.status(200).send("iModel-query-agent: Logged in. See console for the output created by the sample");
            await this.run();
        });

        app.get("/loginFailure", async (_request, response) => {
            response.status(401).send(`iModel-query-agent: Error logging in`);
        });

        app.get("/signin-oidc", passport.authenticate("oidc", { successRedirect: "/start", failureRedirect: "/loginFailure" }));
        app.post("/signin-oidc", passport.authenticate("oidc", { successRedirect: "/start", failureRedirect: "/loginFailure" }));

        app.get("/logout", (req, res) => {
            req.logout();
            this.clearSession();
            res.redirect("/");
        });

        app.get("/", (req, res) => {
            if (req.isAuthenticated())
                res.redirect("/start");
            else
                res.redirect("/login");
        });
    }

    private _tokenStore?: OpenIdConnectTokenStore;

    private async setupAuthStrategy() {
        const issuer: Issuer = await Issuer.discover("https://qa-imsoidc.bentley.com/");

        const oidcClient: Client = new issuer.Client({
            client_id: "imodeljs-agent-hybrid-test-2686",
            client_secret: "PFgarffwuVkAwOomMpHmxQshrKtHUM2gwXxqYwdU/HOGlvgPVHBdKu8BSDJswJd/8s9VL5jHpT184Qs122sdug==",
        });

        const startParams = {
            redirect_uri: "http://localhost:3000/signin-oidc",
            scope: "openid email profile organization feature_tracking imodelhub rbac-service context-registry-service offline_access https://dev-wsg20-eus.cloudapp.net https://qa-connect-wsg20.bentley.com",
            response_type: "code id_token",
            response_mode: "form_post",
            response: ["userinfo"],
        };

        const strategySettings = {
            client: oidcClient,
            params: startParams,
        };

        const oidcStrategy = new Strategy(strategySettings, (tokenSet: TokenSet, userInfo: UserInfo, done: any) => {
            this._tokenStore = new OpenIdConnectTokenStore(tokenSet, oidcClient);

            // to do anything, we need to return a user.
            // if you are storing information in your application this would use some middlewhere and a database
            // the call would typically look like
            // User.findOrCreate(userInfo.sub, userInfo, (err, user) => { done(err, user); });
            // we'll just pass along the userInfo object as a simple 'user' object
            return done(null, userInfo);
        });

        passport.use("oidc", oidcStrategy);
    }

    private clearSession() {
        this._tokenStore = undefined;
    }

    public async run(): Promise<boolean> {
        if (!this._tokenStore)
            throw new Error("Error getting the access tokens and user profile. Perhaps the user hasn't logged in");

        const accessToken: AccessToken = await this._tokenStore.getAccessToken();
        console.log(accessToken); // tslint:disable-line:no-console

        // Initialize the iModelJS backend sitting behind this web server
        try {
            await this._agent.listenForAndHandleChangesets(this._tokenStore, this._config.listenTime);
        } catch (error) {
            return false;
        }
        return true;
    }

    public close(): void {
        try {
            this._server.close();
            this.clearSession();
        } catch (error) {
        }
    }
}

/*
 * Needs discussion -
 * Use of implicit workflow for SPA (issues: short lived access tokens, sending token to multiple servers, and using access token in front end)
 *
 * Minimum required before push -
 *   + Electron setup.
 *   + Mobile setup.
 *   + Hook up accessToken into entire workflow - need to extract TokenStore to avoid circular references.
 *   + Figure use of react-oidc in ui-test-app
 *   + Get suite of integration tests to work
 *      - Tests are currently broken - fix the issues there first.
 *      - Provide a way for silent login
 *   + Test that refresh tokens work by getting the correct access tokens.
 *   + Worry about the navigator use case before switching AccessTokens to use OIDC. (need a mechanism to allow navigator to fetch SAML tokens)
 *
 * Beyond push -
 *   + Figure why getting extended profile information doesn't work.
 *   + Consider persisting the session to avoid a login when the server restarts.
 *   + Setup better UI for logging in the user (this would be the future "deployment" mechanism of the agent).
 *   + Setup and debug use of certificates.
 *   + Improve oidc-client typedefinition - type more constructs (search and replace any use of "any")
 */
