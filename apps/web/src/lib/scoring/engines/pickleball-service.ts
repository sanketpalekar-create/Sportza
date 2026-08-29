import type {
  ScoringEngine, MatchConfig, ScoreDisplay,
  ScoringAction, SecondaryAction, ConfigOption,
} from "../types";

export interface PickleballServiceConfig extends MatchConfig {
  sport: "pickleball_service";
  games: number;
  pointsToWin: number;
  winBy: number;
  /** Doubles uses Server 1/2 and 0-0-2 for the first team to serve each game */
  doubles: boolean;
  /** Team that serves first in game 1 (subsequent games: loser of prior game serves first) */
  firstServeTeam: "A" | "B";
}

export type RallyLogEntry = {
  seq: number;
  at: string;
  eventType: string;
  gameIndex: number;
  detail?: Record<string, unknown>;
};

export interface PickleballServiceState {
  config: PickleballServiceConfig;
  gamesWon: { A: number; B: number };
  completedGames: Array<{ A: number; B: number }>;
  currentGame: { A: number; B: number };
  serving: "A" | "B";
  /** 1 or 2 for doubles announce; singles always 1 */
  serverNumber: 1 | 2;
  /** Index 0 or 1 into team’s listed players — who is serving until fault */
  currentServerPlayerIndex: 0 | 1;
  /** At team score 0, which player index is on the right (even) side */
  starterRightPlayerIndex: { A: 0 | 1; B: 0 | 1 };
  /** First team to serve this game — determines who started 0-0-2 at game open */
  firstServeTeamThisGame: "A" | "B";
  /** True only while the very first 0-0-2 possession of the current game is still in progress.
   *  Cleared the moment the opener scores or loses serve. Resets each new game. */
  openingZeroZeroTwoActive: boolean;
  winner: "A" | "B" | null;
  setupComplete: boolean;
  /** Doubles: each side must confirm who starts on the right before Lock setup */
  setupBaselineAck: { A: boolean; B: boolean };
  /**
   * True after Lock setup (configure path). False after Skip — scoreline keeps
   * 0-0-2 / 0-0-1 but no player/side tracking in the UI.
   */
  trackPositions: boolean;
  rallyLog: RallyLogEntry[];
  nextSeq: number;
}

function rightPlayerAtTeamScore(starterRight: 0 | 1, teamScore: number): 0 | 1 {
  return (teamScore % 2 === 0 ? starterRight : (starterRight === 0 ? 1 : 0)) as 0 | 1;
}

/** Minimal post-state snapshot for rallyLog / replay */
export function snapshotPickleballService(s: PickleballServiceState): Record<string, unknown> {
  return {
    currentGame: { ...s.currentGame },
    gamesWon: { ...s.gamesWon },
    serving: s.serving,
    serverNumber: s.serverNumber,
    currentServerPlayerIndex: s.currentServerPlayerIndex,
    starterRightPlayerIndex: { ...s.starterRightPlayerIndex },
    firstServeTeamThisGame: s.firstServeTeamThisGame,
    openingZeroZeroTwoActive: s.openingZeroZeroTwoActive,
    setupComplete: s.setupComplete,
    setupBaselineAck: { ...s.setupBaselineAck },
    trackPositions: s.trackPositions,
    winner: s.winner,
    completedGamesCount: s.completedGames.length,
  };
}

function pushLog(
  s: PickleballServiceState,
  eventType: string,
  detail?: Record<string, unknown>,
): void {
  const gameIndex = s.completedGames.length;
  const postState = snapshotPickleballService(s);
  s.rallyLog.push({
    seq: s.nextSeq++,
    at: new Date().toISOString(),
    eventType,
    gameIndex,
    detail: { ...detail, postState },
  });
  if (s.rallyLog.length > 600) s.rallyLog.splice(0, s.rallyLog.length - 600);
}

/**
 * True only during the very first possession of the game for the opening team.
 * The flag `openingZeroZeroTwoActive` is cleared the moment that team scores or
 * loses serve, so subsequent 0-0 serves always use normal 0-0-1 (first server, right).
 */
function openingZeroZeroTwo(state: PickleballServiceState): boolean {
  return (
    state.config.doubles
    && state.openingZeroZeroTwoActive
    && state.serving === state.firstServeTeamThisGame
  );
}

/** Set serverNumber + currentServer for whoever is now in `s.serving`. */
function configureServingState(s: PickleballServiceState, servingTeam: "A" | "B"): void {
  const score = s.currentGame[servingTeam];
  // S1 is whoever is physically on the right at the current score. In service scoring
  // the right-side player always serves first after a side-out (from the right).
  // Score parity tracks which player that is at any given moment.
  s.currentServerPlayerIndex = rightPlayerAtTeamScore(
    s.starterRightPlayerIndex[servingTeam],
    score,
  );
  // Opening 0-0-2: only the original first-serve team, only while the flag is still active.
  const isOpening = s.config.doubles
    && s.openingZeroZeroTwoActive
    && servingTeam === s.firstServeTeamThisGame;
  s.serverNumber = isOpening ? 2 : 1;
}

function applySideOut(s: PickleballServiceState, fromTeam: "A" | "B"): void {
  const next: "A" | "B" = fromTeam === "A" ? "B" : "A";
  s.serving = next;
  configureServingState(s, next);
  pushLog(s, "side_out", { from: fromTeam, to: next, serverNumber: s.serverNumber });
}

function maybeEndGame(s: PickleballServiceState): void {
  const a = s.currentGame.A;
  const b = s.currentGame.B;
  const { pointsToWin, winBy } = s.config;
  let gameWinner: "A" | "B" | null = null;
  if (a >= pointsToWin && a - b >= winBy) gameWinner = "A";
  else if (b >= pointsToWin && b - a >= winBy) gameWinner = "B";
  if (!gameWinner) return;

  s.gamesWon[gameWinner]++;
  s.completedGames.push({ A: a, B: b });
  pushLog(s, "game_complete", { winner: gameWinner, score: { A: a, B: b } });

  const needed = Math.ceil(s.config.games / 2);
  if (s.gamesWon[gameWinner] >= needed) {
    s.winner = gameWinner;
    pushLog(s, "match_complete", { winner: gameWinner });
    return;
  }

  s.currentGame = { A: 0, B: 0 };
  const loser: "A" | "B" = gameWinner === "A" ? "B" : "A";
  s.firstServeTeamThisGame = loser;
  s.serving = loser;
  s.openingZeroZeroTwoActive = s.config.doubles;
  // Initial setup only — never re-gate between games (skip or configure).
  s.setupComplete = true;
  configureServingState(s, loser);
  pushLog(s, "new_game", { firstServe: loser, serverNumber: s.serverNumber });
}

function serverWinsPoint(s: PickleballServiceState): void {
  // Consume the opening 0-0-2 flag on the first point scored by the opener.
  if (openingZeroZeroTwo(s)) s.openingZeroZeroTwoActive = false;
  const srv = s.serving;
  s.currentGame[srv]++;
  pushLog(s, "rally_point_serving", { team: srv });
  maybeEndGame(s);
}

function servingTeamFault(s: PickleballServiceState, faultMeta?: Record<string, unknown>): void {
  const srv = s.serving;
  pushLog(s, "rally_fault", faultMeta ?? { kind: "serve_fault" });

  if (!s.config.doubles) {
    applySideOut(s, srv);
    maybeEndGame(s);
    return;
  }

  if (openingZeroZeroTwo(s)) {
    s.openingZeroZeroTwoActive = false;
    applySideOut(s, srv);
    maybeEndGame(s);
    return;
  }

  if (s.serverNumber === 1) {
    s.serverNumber = 2;
    s.currentServerPlayerIndex = (s.currentServerPlayerIndex === 0 ? 1 : 0) as 0 | 1;
    pushLog(s, "serve_rotate_s1_to_s2", { team: srv });
    return;
  }

  applySideOut(s, srv);
  maybeEndGame(s);
}

/** Human-readable serve line using optional player names (index 0/1 per team). */
export function formatPickleballServeLine(
  state: PickleballServiceState,
  names: { A: string; B: string },
  playersA: string[],
  playersB: string[],
): string {
  const srv = state.serving;
  const recv: "A" | "B" = srv === "A" ? "B" : "A";
  const triple = state.config.doubles
    ? `${state.currentGame[srv]}–${state.currentGame[recv]}–${state.serverNumber}`
    : `${state.currentGame[srv]}–${state.currentGame[recv]}`;
  const teamLabel = names[srv] ?? srv;
  // Skip path: keep 0-0-2 / 0-0-1 scoreline, omit player and court side.
  if (state.config.doubles && !state.trackPositions) {
    return `${triple} · Serve ${state.serverNumber} · ${teamLabel}`;
  }
  const plist = srv === "A" ? playersA : playersB;
  const pname = plist[state.currentServerPlayerIndex] ?? `P${state.currentServerPlayerIndex + 1}`;
  const rightPlayer = rightPlayerAtTeamScore(state.starterRightPlayerIndex[srv], state.currentGame[srv]);
  const court = state.config.doubles
    ? (state.currentServerPlayerIndex === rightPlayer ? "right" : "left")
    : (state.currentGame[srv] % 2 === 0 ? "right" : "left");
  const serveBit = state.config.doubles
    ? `Serve ${state.serverNumber} · ${pname} (${court}) · ${teamLabel}`
    : `Serve · ${pname} (${court}) · ${teamLabel}`;
  return `${triple} · ${serveBit}`;
}

export const pickleballServiceEngine: ScoringEngine<PickleballServiceState> = {
  init(config: MatchConfig): PickleballServiceState {
    const fst = (config.firstServeTeam === "B" ? "B" : "A") as "A" | "B";
    const doubles = config.doubles !== false;
    const cfg: PickleballServiceConfig = {
      ...(config as object),
      sport: "pickleball_service",
      games: Number((config as MatchConfig).games) || 3,
      pointsToWin: Number((config as MatchConfig).pointsToWin) || 11,
      winBy: 2,
      doubles,
      firstServeTeam: fst,
    };
    const starter: { A: 0 | 1; B: 0 | 1 } = {
      A: (Number(config.starterRightA) === 1 ? 1 : 0) as 0 | 1,
      B: (Number(config.starterRightB) === 1 ? 1 : 0) as 0 | 1,
    };
    const state: PickleballServiceState = {
      config: cfg,
      gamesWon: { A: 0, B: 0 },
      completedGames: [],
      currentGame: { A: 0, B: 0 },
      serving: fst,
      serverNumber: doubles ? 2 : 1,
      currentServerPlayerIndex: rightPlayerAtTeamScore(starter[fst], 0),
      starterRightPlayerIndex: starter,
      firstServeTeamThisGame: fst,
      openingZeroZeroTwoActive: doubles,
      winner: null,
      setupComplete: !doubles,
      setupBaselineAck: doubles ? { A: false, B: false } : { A: true, B: true },
      trackPositions: false,
      rallyLog: [],
      nextSeq: 1,
    };
    pushLog(state, "setup_init", {
      firstServeTeam: fst,
      doubles,
      starterRightPlayerIndex: starter,
    });
    return state;
  },

  applyEvent(state: PickleballServiceState, team: "A" | "B", eventType: string): PickleballServiceState {
    if (state.winner) return state;

    const s = structuredClone(state) as PickleballServiceState;

    if (eventType === "set_starter_right_0" || eventType === "set_starter_right_1") {
      const side = team === "B" ? "B" : "A";
      const val = (eventType === "set_starter_right_1" ? 1 : 0) as 0 | 1;
      s.starterRightPlayerIndex[side] = val;
      s.setupBaselineAck[side] = true;
      if (s.serving === side && s.config.doubles) {
        configureServingState(s, side);
      }
      pushLog(s, "set_starter_right", { team: side, rightPlayerIndex: val });
      return s;
    }

    if (eventType === "confirm_setup") {
      if (s.config.doubles && (!s.setupBaselineAck.A || !s.setupBaselineAck.B)) {
        return state;
      }
      s.setupComplete = true;
      s.trackPositions = true;
      if (s.config.doubles) {
        configureServingState(s, s.serving);
      }
      pushLog(s, "setup_confirm", { trackPositions: true });
      return s;
    }

    if (eventType === "skip_setup") {
      s.setupComplete = true;
      s.trackPositions = false;
      if (s.config.doubles) {
        configureServingState(s, s.serving);
      }
      pushLog(s, "setup_skip", { trackPositions: false });
      return s;
    }

    if (eventType === "swap_starter_right") {
      const side = team === "B" ? "B" : "A";
      s.starterRightPlayerIndex[side] = (s.starterRightPlayerIndex[side] === 0 ? 1 : 0) as 0 | 1;
      if (s.serving === side && s.config.doubles) {
        configureServingState(s, side);
      }
      pushLog(s, "swap_starter_right", { team: side });
      return s;
    }

    if (eventType === "switch_serve") {
      const prev = s.serving;
      const next: "A" | "B" = prev === "A" ? "B" : "A";
      s.serving = next;
      // During setup the switch is used to pick who serves first, so update the
      // first-serve attribution so the 0-0-2 opening is assigned to the right team.
      if (!s.setupComplete && s.config.doubles) {
        s.firstServeTeamThisGame = next;
        s.openingZeroZeroTwoActive = true;
      }
      configureServingState(s, next);
      pushLog(s, "switch_serve", { previous: prev, serving: next });
      return s;
    }

    if (eventType === "fault" || eventType === "kitchen_fault") {
      servingTeamFault(s, { kind: eventType });
      return s;
    }

    if (eventType === "point" || eventType === "rally" || eventType === "ace") {
      if (!s.setupComplete) return state;
      if (team === s.serving) {
        serverWinsPoint(s);
      } else {
        servingTeamFault(s, { kind: "receiver_won_rally", by: team });
      }
      return s;
    }

    return state;
  },

  display(state: PickleballServiceState, teamNames: Record<"A" | "B", string>): ScoreDisplay {
    const gameNum = state.completedGames.length + 1;

    if (state.winner) {
      return {
        primary: `${state.gamesWon.A} – ${state.gamesWon.B}`,
        secondary: state.completedGames.map((g) => `${g.A}-${g.B}`).join(", "),
        period: "Final",
        winner: state.winner,
        isComplete: true,
      };
    }

    const srv = state.serving;
    const recv: "A" | "B" = srv === "A" ? "B" : "A";
    const triple = state.config.doubles
      ? `${state.currentGame[srv]}–${state.currentGame[recv]}–${state.serverNumber}`
      : `${state.currentGame[srv]}–${state.currentGame[recv]}`;
    const name = teamNames[srv] ?? srv;
    const serveLine = state.config.doubles
      ? (state.trackPositions
        ? `Serve ${state.serverNumber} · ${name} (P${state.currentServerPlayerIndex + 1})`
        : `Serve ${state.serverNumber} · ${name}`)
      : `Serve · ${name}`;

    return {
      primary: `${state.currentGame.A} – ${state.currentGame.B}`,
      secondary: `${triple} · ${serveLine}`,
      tertiary: state.gamesWon.A + state.gamesWon.B > 0
        ? `${state.gamesWon.A} – ${state.gamesWon.B} games`
        : undefined,
      period: `Game ${gameNum}`,
      isComplete: false,
      serve: state.serving,
    };
  },

  getActions(state: PickleballServiceState): ScoringAction[] {
    if (state.winner) return [];
    if (!state.setupComplete) {
      if (state.config.doubles && (!state.setupBaselineAck.A || !state.setupBaselineAck.B)) {
        return [];
      }
      return [{ label: "Lock setup & begin", eventType: "confirm_setup", value: 0, style: "primary" }];
    }
    return [{ label: "Point / Rally", eventType: "point", value: 1, style: "primary" }];
  },

  getSecondaryActions(state: PickleballServiceState): SecondaryAction[] {
    if (state.winner) return [];
    if (!state.setupComplete) return [];
    const base: SecondaryAction[] = [
      { label: "Fault", eventType: "fault", value: 0, style: "danger", team: "both" },
      { label: "Kitchen fault", eventType: "kitchen_fault", value: 0, style: "danger", team: "both" },
      { label: "Switch serve (fix)", eventType: "switch_serve", value: 0, style: "secondary" },
    ];
    if (state.config.doubles && state.trackPositions) {
      base.unshift({
        label: "Swap who is on right (pick team tab)",
        eventType: "swap_starter_right",
        value: 0,
        style: "secondary",
        team: "both",
      });
    }
    return [
      { label: "Ace", eventType: "ace", value: 1, style: "secondary" },
      ...base,
    ];
  },

  isComplete(state: PickleballServiceState): boolean {
    return state.winner !== null;
  },

  configOptions(): ConfigOption[] {
    return [
      {
        key: "games",
        label: "Games",
        type: "select",
        options: [
          { value: 1, label: "Best of 1" },
          { value: 3, label: "Best of 3" },
          { value: 5, label: "Best of 5" },
        ],
        default: 3,
      },
      {
        key: "pointsToWin",
        label: "Points to win",
        type: "select",
        options: [
          { value: 11, label: "11 (standard)" },
          { value: 15, label: "15" },
          { value: 21, label: "21" },
        ],
        default: 11,
      },
      {
        key: "doubles",
        label: "Doubles",
        type: "toggle",
        default: true,
      },
      {
        key: "firstServeTeam",
        label: "First serve (game 1)",
        type: "select",
        options: [
          { value: "A", label: "Team A" },
          { value: "B", label: "Team B" },
        ],
        default: "A",
      },
    ];
  },
};
