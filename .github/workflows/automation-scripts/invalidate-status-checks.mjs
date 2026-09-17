// Invalidate all iTwin.js build status checks when master has a change to core/backend/package.json
// This is specifically to catch changes to @bentley/imodeljs-native and should only invalidate PRs that target master branch
// This will also invalidate PRs if there's a new nightly build, however our 3 hour rule should also invalidate the same PRs

const owner = "iTwin";
const repo = "itwinjs-core";
const token = process.env.GITHUB_TOKEN;

const headers = {
  "Authorization": `token ${token}`,
  "Accept": "application/vnd.github.v3+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "itwinjs-core-invalidate-open-prs",
};

const MAX_RETRIES = 4;
const RETRYABLE_STATUS_CODES = new Set([408, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function exponentialBackoffMs(attempt) {
  return 2 ** attempt * 1000;
}

// Falls back to exponential backoff if no rate-limit headers or secondary rate limit message are present.
function getRetryDelayMs(response, attempt, isSecondaryRateLimit) {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter !== null && !Number.isNaN(Number(retryAfter)))
    return Number(retryAfter) * 1000;

  const rateLimitRemaining = response.headers.get("x-ratelimit-remaining");
  const rateLimitReset = response.headers.get("x-ratelimit-reset");
  if (rateLimitRemaining === "0" && rateLimitReset !== null && !Number.isNaN(Number(rateLimitReset)))
    return Math.max(0, Number(rateLimitReset) * 1000 - Date.now());

  if (isSecondaryRateLimit) {
    // Wait at least one minute: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api#exceeding-the-rate-limit
    const minSecondaryRateLimitDelayMs = 60 * 1000;
    return Math.max(minSecondaryRateLimitDelayMs, exponentialBackoffMs(attempt));
  }

  return exponentialBackoffMs(attempt);
}

// GitHub doesn't always set Retry-After/x-ratelimit-remaining for secondary rate limits, so fall back to the message.
function isSecondaryRateLimitMessage(bodyText) {
  const secondaryRateLimitMessage = /secondary rate limit/i;
  return typeof bodyText === "string" && secondaryRateLimitMessage.test(bodyText);
}

function isRateLimited(response, isSecondaryRateLimit) {
  if (response.status === 429)
    return true;
  if (response.status !== 403)
    return false;
  // 403 covers primary limit exhausted, secondary/abuse limit, or secondary limit with no headers set.
  return response.headers.get("x-ratelimit-remaining") === "0"
    || response.headers.get("retry-after") !== null
    || isSecondaryRateLimit;
}

function isRetryableStatus(response, isSecondaryRateLimit) {
  return RETRYABLE_STATUS_CODES.has(response.status) || isRateLimited(response, isSecondaryRateLimit);
}

function buildStatusError(url, response, bodyText) {
  return new Error(`GitHub API request to ${url} failed with ${response.status} ${response.statusText}: ${bodyText}`);
}

async function githubRequest(url, options = {}) {
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let response;
    try {
      response = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
    } catch (networkError) {
      lastError = new Error(`GitHub API request to ${url} failed after ${attempt + 1} attempts: ${networkError.message}`);
      if (attempt < MAX_RETRIES)
        await sleep(exponentialBackoffMs(attempt));
      continue;
    }

    if (response.ok)
      return response;

    const bodyText = await response.text();
    const isSecondaryRateLimit = isSecondaryRateLimitMessage(bodyText);

    if (!isRetryableStatus(response, isSecondaryRateLimit))
      throw buildStatusError(url, response, bodyText);

    lastError = buildStatusError(url, response, bodyText);
    if (attempt < MAX_RETRIES)
      await sleep(getRetryDelayMs(response, attempt, isSecondaryRateLimit));
  }

  throw lastError;
}

const pullRequestsResponse = await githubRequest(`https://api.github.com/repos/${owner}/${repo}/pulls`);
const pullRequests = await pullRequestsResponse.json();

for (const pullRequest of pullRequests) {
  if (!pullRequest.draft && pullRequest.base.ref === "master") {
    await githubRequest(`https://api.github.com/repos/${owner}/${repo}/statuses/${pullRequest.head.sha}`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        state: "failure",
        description: "@bentley/imodeljs-native may be out of date with master, please merge",
        context: "iTwin.js",
      }),
    });
  }
}
