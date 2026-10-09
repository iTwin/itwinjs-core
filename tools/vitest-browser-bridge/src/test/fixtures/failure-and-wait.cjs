const configuration = JSON.parse(process.env.VITEST_BROWSER_BRIDGE_SESSION);
process.send?.({ type: "failure", sessionId: configuration.sessionId, message: "fixture startup failure" }, () => process.disconnect());
setInterval(() => {}, 1_000);
