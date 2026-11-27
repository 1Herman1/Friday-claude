// One worker route for both OPEN and CLOSED BingX positions; legacy MEXC stays separate.
export function reviewLaunchArgs(root: string, venue: string, tradeId: string, runningId: string): string[] {
  if (venue === "bingx") return [
    `${root}/journal/review/bingx_review.py`, "--trade", tradeId, "--capture", "--force",
    "--running-review-id", runningId, "--out", `${root}/journal/data/reports/review-jobs/${runningId}`,
  ];
  if (venue === "mexc") return [`${root}/journal/review/agent_pass.py`, "--trade", tradeId, "--force"];
  throw new Error(`Unsupported venue for visual review: ${venue}`);
}
