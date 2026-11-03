/**
 * What keeps working with no network. Lessons and exercises are already on the page.
 * The calculator is local. The PC runner is a loopback request, so it is attempted
 * even when the browser says it is offline and only used if it answers.
 * Everything else talks to a server or another site.
 */
export function offlinePolicy(online: boolean) {
  return {
    chat: online,
    webSearch: online,
    highlightAsk: online,
    openInChatgpt: online,
    cloudCpp: online,
    signIn: online,
    calculator: true,
    clientChecks: true,
  };
}
