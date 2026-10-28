import { expect, spyOn, test } from "bun:test";
import {
  getWeeklyPipelineStatus,
  runWeeklyPipeline,
  startWeeklyPipeline,
} from "../src/lib/weekly-pipeline";

test("pipeline berjalan di belakang respons dan permintaan bersamaan memakai satu proses", async () => {
  const originalSpawn = Bun.spawn;
  const errorLog = spyOn(console, "error").mockImplementation(() => {});
  let spawned = 0;
  let releaseFirst!: (code: number) => void;
  const firstExit = new Promise<number>((resolve) => { releaseFirst = resolve; });

  try {
    Bun.spawn = (() => {
      spawned += 1;
      return {
        exited: spawned === 1 ? firstExit : Promise.resolve(0),
        stdout: new Blob(["ok"]).stream(),
        stderr: new Blob([]).stream(),
      } as ReturnType<typeof Bun.spawn>;
    }) as typeof Bun.spawn;

    expect(startWeeklyPipeline().status).toBe("running");
    expect(startWeeklyPipeline().status).toBe("running");
    expect(spawned).toBe(1);

    releaseFirst(0);
    await runWeeklyPipeline();
    expect(spawned).toBe(4);
    expect(getWeeklyPipelineStatus().status).toBe("succeeded");
    expect(getWeeklyPipelineStatus().finished_at).not.toBeNull();

    Bun.spawn = (() => ({
      exited: Promise.resolve(1),
      stdout: new Blob([]).stream(),
      stderr: new Blob(["gagal"]).stream(),
    } as ReturnType<typeof Bun.spawn>)) as typeof Bun.spawn;

    expect(startWeeklyPipeline().status).toBe("running");
    await expect(runWeeklyPipeline()).rejects.toThrow("gagal");
    expect(getWeeklyPipelineStatus().status).toBe("failed");
  } finally {
    Bun.spawn = originalSpawn;
    errorLog.mockRestore();
  }
});
