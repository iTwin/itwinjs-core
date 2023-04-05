/**
 *  Because ADO evaluates Agent.OS at runtime,
 *  we cannot use it in build-time expressions.
 *  Instead, set the RUSH_BUILD_CACHE_WRITE_ALLOWED here during runtime.
 */

const acceptableReasons = ["IndividualCI", "Manual"]
let useRushWriteCache = 0

if (process.env.AGENT_OS === 'Linux' && acceptableReasons.includes(process.env.BUILD_REASON))
  useRushWriteCache = 1

console.log(`setting RUSH_BUILD_CACHE_WRITE_ALLOWED to ${useRushWriteCache}`)
console.log(`##vso[task.setvariable variable=RUSH_BUILD_CACHE_WRITE_ALLOWED;]${useRushWriteCache}`)