const workflow = "analysis-pipeline.yml";

export async function dispatchAnalysisAction(stage: "draft" | "train", runId: string): Promise<void> {
  const token = process.env.GITHUB_ACTIONS_TOKEN?.trim();
  const repository = process.env.GITHUB_ACTIONS_REPOSITORY?.trim();
  if (!token || !repository || !/^[\w.-]+\/[\w.-]+$/.test(repository)) {
    throw new Error("GitHub Actions belum dikonfigurasi pada API Worker");
  }
  const response = await fetch(`https://api.github.com/repos/${repository}/actions/workflows/${workflow}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "daisuki-api",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ ref: "main", inputs: { stage, run_id: runId } }),
  });
  if (!response.ok) throw new Error(`GitHub Actions menolak job (${response.status})`);
}
