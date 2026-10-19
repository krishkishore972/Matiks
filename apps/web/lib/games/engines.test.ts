import { describe, expect, it } from "vitest";
import { createRng } from "../rng";
import { countSudokuSolutions, generateSudoku, solveSudoku, validateSudoku } from "./sudoku";
import { generateKenKen, solveKenKen, validateKenKen } from "./kenken";
import { generateCrossMath, validateCrossMath } from "./crossmath";
import { countMazePaths, generateMathMaze, validateMathMaze } from "./mathmaze";
import { generateHectoc, validateHectoc } from "./hectoc";
import { countQueensSolutions, generateQueens, validateQueens } from "./queens";
import { countTangoSolutions, generateTango, validateTango } from "./tango";
import { countZipPaths, generateZip, validateZip } from "./zip";
import { buildPipesWinRoute, generatePipes, validatePipes } from "./pipes";
import { generateWend, validateWend, wendLengthHint } from "./wend";
import {
  answerChoices,
  arithmeticQuestion,
  dmasQuestion,
  evaluateDmas,
  flashAnzanRound,
  mindSnapBoard,
  mindSnapPresetId,
  mindSnapScore,
  pinBallBoard,
  pinBallScore,
  sumOfSquares,
  validateSumOfSquares,
} from "./reflex";
import {
  accuracyFrom,
  blitzShape,
  countsForProgress,
  qualityBand,
  ratingDelta,
  scorePuzzle,
  xpFor,
} from "../scoring";

/** Evaluate display prompts (× ÷ −) using normal JS semantics. */
function evalPrompt(prompt: string): number {
  const normalised = prompt.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
  return Function(`"use strict";return (${normalised})`)() as number;
}

describe("rng", () => {
  it("is deterministic for a seed", () => {
    const a = createRng("matiks");
    const b = createRng("matiks");
    expect(Array.from({ length: 8 }, () => a.next())).toEqual(
      Array.from({ length: 8 }, () => b.next()),
    );
  });

  it("shuffles without losing elements", () => {
    const rng = createRng(7);
    const input = [1, 2, 3, 4, 5, 6];
    expect([...rng.shuffle(input)].sort((x, y) => x - y)).toEqual(input);
  });
});

describe("sudoku", () => {
  it("generates a uniquely solvable board", () => {
    const puzzle = generateSudoku("daily-sudoku", "easy");
    expect(puzzle.blanks).toBeGreaterThan(35);
    expect(countSudokuSolutions(puzzle.givens, 2)).toBe(1);
    expect(solveSudoku(puzzle.givens)).toEqual(puzzle.solution);
  });

  it("detects completion and mis-entries", () => {
    const puzzle = generateSudoku("conflict-check", "easy");
    expect(validateSudoku(puzzle.solution, puzzle.solution).solved).toBe(true);
    const blank = puzzle.givens.indexOf(0);
    const wrong = [...puzzle.solution];
    wrong[blank] = (puzzle.solution[blank] % 9) + 1;
    const broken = validateSudoku(wrong, puzzle.solution);
    expect(broken.solved).toBe(false);
    expect(broken.mistakes).toContain(blank);
  });
});

describe("kenken", () => {
  it("solves its own board and honours cages", () => {
    const puzzle = generateKenKen("daily-kenken", "easy");
    expect(solveKenKen(puzzle, new Array(puzzle.size * puzzle.size).fill(0), 1).length).toBeGreaterThan(0);
    expect(validateKenKen(puzzle, puzzle.solution).solved).toBe(true);
    const empty = validateKenKen(puzzle, new Array(puzzle.size * puzzle.size).fill(0));
    expect(empty.solved).toBe(false);
    expect(empty.filled).toBe(0);
  });

  it("gives single-cell cages their value", () => {
    const puzzle = generateKenKen("kenken-cages", "medium");
    for (const cage of puzzle.cages.filter((c) => c.cells.length === 1)) {
      expect(cage.op).toBe("=");
      expect(cage.target).toBe(puzzle.solution[cage.cells[0]]);
    }
  });
});

describe("cross math", () => {
  it("generates boards whose equations equal their targets", () => {
    for (const difficulty of ["easy", "hard"] as const) {
      const puzzle = generateCrossMath(`crossmath-${difficulty}`, difficulty);
      const solved = validateCrossMath(puzzle, puzzle.solution);
      expect(solved.solved).toBe(true);
      expect(solved.wrong).toEqual([]);
    }
  });

  it("reports wrong cells for an incorrect entry", () => {
    const puzzle = generateCrossMath("crossmath-wrong", "easy");
    const grid = [...puzzle.solution];
    const target = puzzle.hidden[0];
    grid[target] = grid[target] === 9 ? 1 : grid[target] + 1;
    const validation = validateCrossMath(puzzle, grid);
    expect(validation.solved).toBe(false);
    expect(validation.wrong.length).toBeGreaterThan(0);
  });
});

describe("math maze", () => {
  it("keeps the target reachable by exactly one path", () => {
    const puzzle = generateMathMaze("daily-mathmaze", "easy");
    const totals = countMazePaths(puzzle.size, puzzle.cells, puzzle.entryCol, puzzle.exitCol);
    expect(totals.get(puzzle.target)).toBe(1);
  });

  it("validates its solution and rejects illegal steps", () => {
    const puzzle = generateMathMaze("mathmaze-validate", "easy");
    const solved = validateMathMaze(puzzle, puzzle.solutionPath);
    expect(solved.solved).toBe(true);
    expect(solved.sum).toBe(puzzle.target);
    const illegal = [...puzzle.solutionPath];
    illegal[1] = (illegal[0] + 2) % puzzle.size;
    const broken = validateMathMaze(puzzle, illegal);
    expect(broken.solved).toBe(false);
    expect(broken.illegalSteps.length).toBeGreaterThan(0);
  });
});

describe("hectoc", () => {
  it("generates solvable six-digit boards", () => {
    const puzzle = generateHectoc("daily-hectoc", "easy");
    expect(puzzle.digits).toHaveLength(6);
    expect(validateHectoc(puzzle, puzzle.solution).ok).toBe(true);
  });

  it("rejects wrong totals and reordered digits", () => {
    const puzzle = generateHectoc("hectoc-validate", "medium");
    expect(validateHectoc(puzzle, puzzle.digits.join("+")).ok).toBe(false);
    expect(validateHectoc(puzzle, [...puzzle.digits].reverse().join("+")).reason).toBe("digits");
  });

  it("judges exact rational answers, not floating point", () => {
    const puzzle = generateHectoc("hectoc-exact", "easy");
    const verdict = validateHectoc(puzzle, puzzle.solution);
    expect(verdict.ok).toBe(true);
    expect(verdict.value).toBe(100);
  });
});

describe("queens", () => {
  it("generates puzzles with exactly one placement", () => {
    const puzzle = generateQueens("infinite-queens");
    expect(countQueensSolutions(puzzle.size, puzzle.regions, 2)).toBe(1);
  });

  it("accepts its solution and rejects touching queens", () => {
    const puzzle = generateQueens("queens-validate");
    const cells = puzzle.solution.map((col, row) => row * puzzle.size + col);
    expect(validateQueens(puzzle, cells).solved).toBe(true);
    const broken = cells.map((cell) => cell);
    expect(validateQueens(puzzle, [...broken, broken[0]]).solved).toBe(false);
  });

  it("places one queen per region and column", () => {
    const puzzle = generateQueens("queens-structure");
    expect(new Set(puzzle.solution).size).toBe(puzzle.size);
    expect(
      new Set(puzzle.solution.map((col, row) => puzzle.regions[row * puzzle.size + col])).size,
    ).toBe(puzzle.size);
  });
});

describe("tango", () => {
  it("generates a uniquely solvable board", () => {
    const puzzle = generateTango("infinite-tango");
    expect(countTangoSolutions(puzzle.size, puzzle.givens, puzzle.constraints, 2)).toBe(1);
  });

  it("accepts the solution and detects a triple", () => {
    const puzzle = generateTango("tango-validate");
    const grid = puzzle.solution.map((value) => value as 0 | 1 | null);
    expect(validateTango(puzzle, grid).solved).toBe(true);
    const broken = [...grid];
    broken[0] = 1;
    broken[1] = 1;
    broken[2] = 1;
    expect(validateTango(puzzle, broken).solved).toBe(false);
  });
});

describe("zip", () => {
  it("validates its own hamiltonian path", () => {
    const puzzle = generateZip("infinite-zip");
    expect(validateZip(puzzle, puzzle.solution).solved).toBe(true);
    expect(puzzle.solution.length).toBe(puzzle.size * puzzle.size);
  });

  it("rejects a path that misses cells", () => {
    const puzzle = generateZip("zip-incomplete");
    const partial = validateZip(puzzle, puzzle.solution.slice(0, 4));
    expect(partial.solved).toBe(false);
    expect(partial.reason).toBe("incomplete");
  });

  it("counts paths consistently with the checkpoints", () => {
    const puzzle = generateZip("zip-count");
    const { count, budgetExhausted } = countZipPaths(puzzle, 2, 250_000);
    expect(count === 1 || budgetExhausted).toBe(true);
  });
});

describe("pipes", () => {
  it("solves once every tile is on its winning rotation", () => {
    const puzzle = generatePipes("infinite-pipes");
    buildPipesWinRoute(puzzle).forEach((rotation, index) => {
      puzzle.cells[index].rotation = rotation;
    });
    const validation = validatePipes(puzzle);
    expect(validation.solved).toBe(true);
    expect(validation.leaks).toEqual([]);
    expect(validation.components).toBe(1);
  });

  it("starts unsolved with wrong rotations reported", () => {
    const puzzle = generatePipes("pipes-start");
    expect(validatePipes(puzzle).solved).toBe(false);
  });
});

describe("wend", () => {
  it("accepts every published word path", () => {
    const puzzle = generateWend("infinite-wend");
    const validation = validateWend(puzzle, puzzle.words.map((w) => w.path));
    expect(validation.solved).toBe(true);
    expect(validation.invalid).toEqual([]);
  });

  it("rejects a trace spelling something that is not a target", () => {
    const puzzle = generateWend("wend-invalid");
    const flipped = [...puzzle.words[0].path].reverse();
    expect(validateWend(puzzle, [flipped]).solved).toBe(false);
  });

  it("hints with sorted word lengths only", () => {
    const puzzle = generateWend("wend-hint");
    const lengths = wendLengthHint(puzzle);
    expect(lengths).toEqual([...lengths].sort((a, b) => a - b));
    expect(lengths.length).toBe(puzzle.words.length);
  });
});

describe("reflex games", () => {
  it("arithmetic questions have the advertised answer", () => {
    const rng = createRng("arith");
    for (let i = 0; i < 60; i++) {
      const question = arithmeticQuestion(rng, 3);
      expect(evalPrompt(question.prompt)).toBe(question.answer);
      expect(Number.isInteger(question.answer)).toBe(true);
      expect(question.answer).toBeGreaterThanOrEqual(0);
    }
  });

  it("DMAS questions respect operator precedence", () => {
    const rng = createRng("dmas");
    for (let i = 0; i < 60; i++) {
      const question = dmasQuestion(rng, 2);
      expect(evaluateDmas(question.prompt)).toBe(question.answer);
    }
  });

  it("offers four distinct choices including the answer", () => {
    const choices = answerChoices(createRng("choices"), 42);
    expect(choices).toContain(42);
    expect(new Set(choices).size).toBe(choices.length);
  });

  it("flash anzan rounds sum their flashed numbers", () => {
    const round = flashAnzanRound(createRng("anzan"), { count: 6, digits: 2, subtract: true });
    expect(round.numbers.reduce((a, b) => a + b, 0)).toBe(round.answer);
    expect(round.numbers).toHaveLength(6);
  });

  it("mind snap formats its preset id and scores +1 / -1 per tap", () => {
    const board = mindSnapBoard(createRng("mindsnap"), 5, 9);
    expect(board.presetId).toBe(mindSnapPresetId(5, 9));
    expect(board.presetId).toBe("25G(9S)");
    expect(board.highlighted).toHaveLength(9);
    expect(mindSnapScore(board.highlighted, board.highlighted).points).toBe(9);

    const wrongCell = Array.from({ length: 25 }, (_, i) => i).find(
      (cell) => !board.highlighted.includes(cell),
    ) as number;
    expect(mindSnapScore([board.highlighted[0], wrongCell], board.highlighted).points).toBe(0);
    const tooMany = mindSnapScore([...board.highlighted, board.highlighted[0]], board.highlighted);
    expect(tooMany.extraTaps).toBe(1);
    expect(tooMany.points).toBe(8);
  });

  it("pin ball recall scores exact 1, adjacent 0.5", () => {
    const board = pinBallBoard(createRng("pinball"), 5, 5, 6);
    expect(board.columns).toHaveLength(5);
    expect(board.columns[0]).toBe(board.startColumn);
    expect(board.columns[4]).toBe(board.exitColumn);
    expect(pinBallScore(board.exitColumn, board.exitColumn)).toBe(1);
    const adjacent = board.exitColumn + 1 < board.width ? board.exitColumn + 1 : board.exitColumn - 1;
    expect(pinBallScore(adjacent, board.exitColumn)).toBe(0.5);
    expect(pinBallScore((board.exitColumn + 3) % board.width, board.exitColumn)).toBe(0);
  });

  it("sum of squares accepts any decomposition and flags overshoot", () => {
    const puzzle = sumOfSquares(createRng("sos"), 3, 12);
    expect(puzzle.solutions.length).toBeGreaterThan(0);
    expect(validateSumOfSquares(puzzle, puzzle.solutions[0]).ok).toBe(true);
    const overshoot = validateSumOfSquares(
      puzzle,
      Array.from({ length: puzzle.terms }, () => 40),
    );
    expect(overshoot.over).toBe(true);
    expect(overshoot.ok).toBe(false);
  });
});

describe("scoring", () => {
  const base = {
    gameId: "mindsnap" as const,
    durationMs: 30_000,
    accuracy: 1,
    solved: true,
    at: "2026-01-01T00:00:00.000Z",
  };

  it("applies the minimum-score rule from the quest rules string", () => {
    expect(countsForProgress({ ...base, score: 59 })).toBe(false);
    expect(countsForProgress({ ...base, score: 60 })).toBe(true);
    expect(countsForProgress({ ...base, gameId: "sudoku", score: 2 })).toBe(true);
    expect(countsForProgress({ ...base, gameId: "sudoku", score: 1 })).toBe(false);
  });

  it("scores puzzles from difficulty, accuracy and speed", () => {
    const fast = scorePuzzle({ difficulty: "hard", solved: true, accuracy: 1, durationMs: 60_000 });
    const slow = scorePuzzle({ difficulty: "hard", solved: true, accuracy: 1, durationMs: 600_000 });
    expect(fast).toBeGreaterThan(slow);
    expect(scorePuzzle({ difficulty: "hard", solved: false, accuracy: 0, durationMs: 1_000 })).toBe(0);
    expect(scorePuzzle({ difficulty: "hard", solved: true, accuracy: 0.4, durationMs: 60_000 })).toBeLessThan(fast);
  });

  it("maps solve times onto the five quality bands", () => {
    expect(qualityBand(10_000, 100_000)).toBe("ZAP");
    expect(qualityBand(80_000, 100_000)).toBe("FLOW");
    expect(qualityBand(130_000, 100_000)).toBe("GRIND");
    expect(qualityBand(200_000, 100_000)).toBe("CHOKE");
    expect(qualityBand(500_000, 100_000)).toBe("FREEZE");
  });

  it("names blitz shapes from the lead across three windows", () => {
    const dominator = blitzShape([
      { player: 5, opponent: 1 },
      { player: 5, opponent: 2 },
      { player: 5, opponent: 1 },
    ]);
    expect(dominator.shape).toBe("Dominator");
    expect(dominator.won).toBe(true);

    const comeback = blitzShape([
      { player: 1, opponent: 5 },
      { player: 4, opponent: 3 },
      { player: 6, opponent: 2 },
    ]);
    expect(comeback.shape).toBe("Comeback");

    const slipUp = blitzShape([
      { player: 5, opponent: 1 },
      { player: 2, opponent: 4 },
      { player: 1, opponent: 6 },
    ]);
    expect(slipUp.shape).toBe("Slip up");
    expect(slipUp.won).toBe(false);
  });

  it("keeps rating swings larger for new players", () => {
    expect(ratingDelta(1200, 1200, true, 0)).toBeGreaterThan(ratingDelta(1200, 1200, true, 500));
    expect(ratingDelta(1200, 2000, true, 0)).toBeGreaterThan(ratingDelta(1200, 800, true, 0));
  });

  it("computes accuracy from every attempt, not just the last", () => {
    expect(accuracyFrom(9, 0)).toBe(1);
    expect(accuracyFrom(3, 1)).toBeCloseTo(0.75);
    expect(accuracyFrom(0, 0)).toBe(1);
  });

  it("scales XP with the booster multiplier", () => {
    const result = { ...base, score: 1000 };
    expect(xpFor(result, 2)).toBe(xpFor(result, 1) * 2);
  });
});
