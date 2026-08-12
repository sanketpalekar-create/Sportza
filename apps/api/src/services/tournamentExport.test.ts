import { describe, expect, it } from "vitest";
import { formatScoreDetail, tournamentExportFilename } from "./tournamentExport";

describe("formatScoreDetail", () => {
  it("flattens simple A/B scores", () => {
    const r = formatScoreDetail({ A: 2, B: 1 });
    expect(r.displayA).toBe("2");
    expect(r.displayB).toBe("1");
    expect(r.pointsForA).toBe("2");
    expect(r.pointsForB).toBe("1");
    expect(r.setDetail).toBe("");
  });

  it("reads nested setsWon", () => {
    const r = formatScoreDetail({ setsWon: { A: 2, B: 0 } });
    expect(r.displayA).toBe("2");
    expect(r.displayB).toBe("0");
  });

  it("formats completedGames as set detail", () => {
    const r = formatScoreDetail({
      completedGames: [
        { A: 11, B: 9 },
        { A: 8, B: 11 },
        { A: 11, B: 7 },
      ],
    });
    expect(r.setDetail).toBe("Set1: 11-9, Set2: 8-11, Set3: 11-7");
    expect(r.pointsForA).toBe("30");
    expect(r.pointsForB).toBe("27");
  });

  it("handles nested scores object", () => {
    const r = formatScoreDetail({ scores: { A: 3, B: 2 } });
    expect(r.displayA).toBe("3");
    expect(r.displayB).toBe("2");
  });
});

describe("tournamentExportFilename", () => {
  it("slugifies tournament name and includes id fallback", () => {
    const name = tournamentExportFilename({ id: 5, name: "Summer Cup 2026!" });
    expect(name).toMatch(/^sportza-summer-cup-2026-\d{4}-\d{2}-\d{2}\.xlsx$/);
  });

  it("uses id when name slug is empty", () => {
    const name = tournamentExportFilename({ id: 12, name: "!!!" });
    expect(name).toContain("tournament-12");
  });
});
