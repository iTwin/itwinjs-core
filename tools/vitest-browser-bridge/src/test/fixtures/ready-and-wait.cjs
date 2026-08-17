const sessionId = process.env.VITEST_BROWSER_BRIDGE_SESSION_ID || "unknown";
console.log(`[vitest-browser-bridge:${sessionId}] ready`);
setInterval(() => {}, 1_000);
