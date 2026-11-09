const configuration = JSON.parse(process.env.VITEST_BROWSER_BRIDGE_SESSION);
process.send?.({ type: "ready", sessionId: configuration.sessionId });
process.on("message", (message) => {
  if (message && message.type === "shutdown")
    process.exit(0);
});
setInterval(() => {}, 1_000);
