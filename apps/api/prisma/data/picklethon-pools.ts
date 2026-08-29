/**
 * Picklethon August — pool roster + official Draws schedule
 * Sourced from Picklethon August Groups.pdf, Teams sheet, and Draws spreadsheet.
 */

export interface PicklethonTeam {
  name: string;
  player1: string;
  player2: string;
}

export const PICKLETHON_AUGUST_POOLS: Record<"A" | "B" | "C" | "D", PicklethonTeam[]> = {
  A: [
    { name: "Acers", player1: "Niranjan", player2: "Suyash" },
    { name: "Fighters", player1: "Dharmesh", player2: "Pawan" },
    { name: "Tararara", player1: "Haresh", player2: "Nikhil" },
    { name: "The Volleyboys", player1: "Nikunj", player2: "Jatin" },
    { name: "Hybrid Hitters", player1: "Ajinkya", player2: "Rohan" },
  ],
  B: [
    { name: "Outer Team", player1: "Rishabh", player2: "Pushkar" },
    { name: "Alchemist", player1: "Aditya", player2: "Saurabh" },
    { name: "Josh", player1: "Ankit", player2: "Afresh" },
    { name: "Net Ninjas", player1: "Ayush", player2: "Rashmi" },
    { name: "Valerian 1", player1: "Ajinkya", player2: "Roshan" },
  ],
  C: [
    { name: "Amarmanil", player1: "Amarpreet", player2: "Manil" },
    { name: "Masters", player1: "Shahrukh Sayyed", player2: "Raza Shaikh" },
    { name: "Team name", player1: "Anjali", player2: "Saurabh" },
    { name: "JS", player1: "Junaid Kokni", player2: "Samir Shaikh" },
    { name: "Dropshots", player1: "Pawan", player2: "Akash" },
  ],
  D: [
    { name: "AK", player1: "Ash", player2: "Akash" },
    { name: "The Jadu", player1: "Aadith", player2: "Aarav" },
    { name: "SA strikers", player1: "Abhishek", player2: "Siddharth" },
    { name: "Pickleball Paradise", player1: "Sudarshan", player2: "Prathamesh" },
    { name: "Fingine", player1: "Prashant", player2: "Mukti" },
  ],
};

export const PICKLETHON_GROUP_LETTERS = ["A", "B", "C", "D"] as const;

/** Official group-stage schedule (M01–M40) from the Draws sheet. */
export interface PicklethonGroupMatch {
  matchId: string;
  matchOrder: number;
  group: (typeof PICKLETHON_GROUP_LETTERS)[number];
  court: string;
  team1: string;
  team2: string;
}

export const PICKLETHON_GROUP_SCHEDULE: PicklethonGroupMatch[] = [
  { matchId: "M01", matchOrder: 1, group: "A", court: "Court 1", team1: "Hybrid Hitters", team2: "Fighters" },
  { matchId: "M02", matchOrder: 2, group: "A", court: "Court 2", team1: "Acers", team2: "The Volleyboys" },
  { matchId: "M03", matchOrder: 3, group: "B", court: "Court 3", team1: "Outer Team", team2: "Alchemist" },
  { matchId: "M04", matchOrder: 4, group: "B", court: "Court 1", team1: "Josh", team2: "Net Ninjas" },
  { matchId: "M05", matchOrder: 5, group: "C", court: "Court 2", team1: "Amarmanil", team2: "Masters" },
  { matchId: "M06", matchOrder: 6, group: "C", court: "Court 3", team1: "Team name", team2: "JS" },
  { matchId: "M07", matchOrder: 7, group: "D", court: "Court 1", team1: "AK", team2: "The Jadu" },
  { matchId: "M08", matchOrder: 8, group: "D", court: "Court 2", team1: "SA strikers", team2: "Pickleball Paradise" },
  { matchId: "M09", matchOrder: 9, group: "A", court: "Court 3", team1: "Hybrid Hitters", team2: "Tararara" },
  { matchId: "M10", matchOrder: 10, group: "A", court: "Court 1", team1: "Fighters", team2: "Acers" },
  { matchId: "M11", matchOrder: 11, group: "B", court: "Court 2", team1: "Outer Team", team2: "Valerian 1" },
  { matchId: "M12", matchOrder: 12, group: "B", court: "Court 3", team1: "Alchemist", team2: "Josh" },
  { matchId: "M13", matchOrder: 13, group: "C", court: "Court 1", team1: "Amarmanil", team2: "Dropshots" },
  { matchId: "M14", matchOrder: 14, group: "C", court: "Court 2", team1: "Masters", team2: "Team name" },
  { matchId: "M15", matchOrder: 15, group: "D", court: "Court 3", team1: "AK", team2: "Fingine" },
  { matchId: "M16", matchOrder: 16, group: "D", court: "Court 1", team1: "The Jadu", team2: "SA strikers" },
  { matchId: "M17", matchOrder: 17, group: "A", court: "Court 2", team1: "Hybrid Hitters", team2: "The Volleyboys" },
  { matchId: "M18", matchOrder: 18, group: "A", court: "Court 3", team1: "Tararara", team2: "Acers" },
  { matchId: "M19", matchOrder: 19, group: "B", court: "Court 1", team1: "Outer Team", team2: "Net Ninjas" },
  { matchId: "M20", matchOrder: 20, group: "B", court: "Court 2", team1: "Valerian 1", team2: "Josh" },
  { matchId: "M21", matchOrder: 21, group: "C", court: "Court 3", team1: "Amarmanil", team2: "JS" },
  { matchId: "M22", matchOrder: 22, group: "C", court: "Court 1", team1: "Dropshots", team2: "Team name" },
  { matchId: "M23", matchOrder: 23, group: "D", court: "Court 2", team1: "AK", team2: "Pickleball Paradise" },
  { matchId: "M24", matchOrder: 24, group: "D", court: "Court 3", team1: "Fingine", team2: "SA strikers" },
  { matchId: "M25", matchOrder: 25, group: "A", court: "Court 1", team1: "Hybrid Hitters", team2: "Acers" },
  { matchId: "M26", matchOrder: 26, group: "A", court: "Court 2", team1: "The Volleyboys", team2: "Tararara" },
  { matchId: "M27", matchOrder: 27, group: "B", court: "Court 3", team1: "Outer Team", team2: "Josh" },
  { matchId: "M28", matchOrder: 28, group: "B", court: "Court 1", team1: "Net Ninjas", team2: "Valerian 1" },
  { matchId: "M29", matchOrder: 29, group: "C", court: "Court 2", team1: "Amarmanil", team2: "Team name" },
  { matchId: "M30", matchOrder: 30, group: "C", court: "Court 3", team1: "JS", team2: "Dropshots" },
  { matchId: "M31", matchOrder: 31, group: "D", court: "Court 1", team1: "AK", team2: "SA strikers" },
  { matchId: "M32", matchOrder: 32, group: "D", court: "Court 2", team1: "Pickleball Paradise", team2: "Fingine" },
  { matchId: "M33", matchOrder: 33, group: "A", court: "Court 3", team1: "Fighters", team2: "Tararara" },
  { matchId: "M34", matchOrder: 34, group: "A", court: "Court 1", team1: "The Volleyboys", team2: "Fighters" },
  { matchId: "M35", matchOrder: 35, group: "B", court: "Court 2", team1: "Alchemist", team2: "Valerian 1" },
  { matchId: "M36", matchOrder: 36, group: "B", court: "Court 3", team1: "Net Ninjas", team2: "Alchemist" },
  { matchId: "M37", matchOrder: 37, group: "C", court: "Court 1", team1: "Masters", team2: "Dropshots" },
  { matchId: "M38", matchOrder: 38, group: "C", court: "Court 2", team1: "JS", team2: "Masters" },
  { matchId: "M39", matchOrder: 39, group: "D", court: "Court 3", team1: "The Jadu", team2: "Fingine" },
  { matchId: "M40", matchOrder: 40, group: "D", court: "Court 1", team1: "Pickleball Paradise", team2: "The Jadu" },
];

export interface PicklethonKnockoutMatch {
  matchId: string;
  round: number;
  matchOrder: number;
  court: string;
  team1Type: "team" | "winner" | "loser";
  team1: Record<string, unknown>;
  team2Type: "team" | "winner" | "loser";
  team2: Record<string, unknown>;
}

/** Official knockout bracket from the Draws sheet (top 4 per group → R16). */
export const PICKLETHON_KNOCKOUT_BRACKET: PicklethonKnockoutMatch[] = [
  // Round of 16
  {
    matchId: "R16-1", round: 1, matchOrder: 1, court: "Court 1",
    team1Type: "team", team1: { name: "Winner Group A (1A)", seed: "1A" },
    team2Type: "team", team2: { name: "4th Place Group D (4D)", seed: "4D" },
  },
  {
    matchId: "R16-2", round: 1, matchOrder: 2, court: "Court 2",
    team1Type: "team", team1: { name: "Runner-up Group B (2B)", seed: "2B" },
    team2Type: "team", team2: { name: "3rd Place Group C (3C)", seed: "3C" },
  },
  {
    matchId: "R16-3", round: 1, matchOrder: 3, court: "Court 3",
    team1Type: "team", team1: { name: "Winner Group C (1C)", seed: "1C" },
    team2Type: "team", team2: { name: "4th Place Group B (4B)", seed: "4B" },
  },
  {
    matchId: "R16-4", round: 1, matchOrder: 4, court: "Court 1",
    team1Type: "team", team1: { name: "Runner-up Group D (2D)", seed: "2D" },
    team2Type: "team", team2: { name: "3rd Place Group A (3A)", seed: "3A" },
  },
  {
    matchId: "R16-5", round: 1, matchOrder: 5, court: "Court 2",
    team1Type: "team", team1: { name: "Winner Group B (1B)", seed: "1B" },
    team2Type: "team", team2: { name: "4th Place Group C (4C)", seed: "4C" },
  },
  {
    matchId: "R16-6", round: 1, matchOrder: 6, court: "Court 3",
    team1Type: "team", team1: { name: "Runner-up Group A (2A)", seed: "2A" },
    team2Type: "team", team2: { name: "3rd Place Group D (3D)", seed: "3D" },
  },
  {
    matchId: "R16-7", round: 1, matchOrder: 7, court: "Court 1",
    team1Type: "team", team1: { name: "Winner Group D (1D)", seed: "1D" },
    team2Type: "team", team2: { name: "4th Place Group A (4A)", seed: "4A" },
  },
  {
    matchId: "R16-8", round: 1, matchOrder: 8, court: "Court 2",
    team1Type: "team", team1: { name: "Runner-up Group C (2C)", seed: "2C" },
    team2Type: "team", team2: { name: "3rd Place Group B (3B)", seed: "3B" },
  },
  // Quarter-finals (winner refs use within-round match numbers, matching knockoutBracket)
  {
    matchId: "QF1", round: 2, matchOrder: 1, court: "Court 1",
    team1Type: "winner", team1: { stage: 2, round: 1, match: 1 },
    team2Type: "winner", team2: { stage: 2, round: 1, match: 2 },
  },
  {
    matchId: "QF2", round: 2, matchOrder: 2, court: "Court 2",
    team1Type: "winner", team1: { stage: 2, round: 1, match: 3 },
    team2Type: "winner", team2: { stage: 2, round: 1, match: 4 },
  },
  {
    matchId: "QF3", round: 2, matchOrder: 3, court: "Court 3",
    team1Type: "winner", team1: { stage: 2, round: 1, match: 5 },
    team2Type: "winner", team2: { stage: 2, round: 1, match: 6 },
  },
  {
    matchId: "QF4", round: 2, matchOrder: 4, court: "Court 1",
    team1Type: "winner", team1: { stage: 2, round: 1, match: 7 },
    team2Type: "winner", team2: { stage: 2, round: 1, match: 8 },
  },
  // Semi-finals
  {
    matchId: "SF1", round: 3, matchOrder: 1, court: "Court 2",
    team1Type: "winner", team1: { stage: 2, round: 2, match: 1 },
    team2Type: "winner", team2: { stage: 2, round: 2, match: 2 },
  },
  {
    matchId: "SF2", round: 3, matchOrder: 2, court: "Court 3",
    team1Type: "winner", team1: { stage: 2, round: 2, match: 3 },
    team2Type: "winner", team2: { stage: 2, round: 2, match: 4 },
  },
  // 3rd place + final
  {
    matchId: "3RD", round: 4, matchOrder: 1, court: "Court 2",
    team1Type: "loser", team1: { stage: 2, round: 3, match: 1, loserOf: "SF1" },
    team2Type: "loser", team2: { stage: 2, round: 3, match: 2, loserOf: "SF2" },
  },
  {
    matchId: "FIN", round: 4, matchOrder: 2, court: "Court 1",
    team1Type: "winner", team1: { stage: 2, round: 3, match: 1 },
    team2Type: "winner", team2: { stage: 2, round: 3, match: 2 },
  },
];

export const PICKLETHON_STAGES = [
  {
    stageOrder: 1,
    name: "Group Stage",
    format: "round_robin",
    groupCount: 4,
    advancePerGroup: 4,
    bestOf: 1,
    singleFormat: false,
    scoringSystem: "service",
    playersPerTeam: 2,
  },
  {
    stageOrder: 2,
    name: "Knockout",
    format: "knockout",
    groupCount: 1,
    advancePerGroup: 1,
    bestOf: 3,
    singleFormat: false,
    scoringSystem: "service",
    playersPerTeam: 2,
  },
];
