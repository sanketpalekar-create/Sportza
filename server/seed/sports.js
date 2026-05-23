const prisma = require('../lib/prisma');

const defaultSports = [
  {
    name: 'cricket',
    displayName: 'Cricket',
    formats: [
      { name: '11-a-side', playersPerTeam: 11, minTeams: 2, maxTeams: 2, description: 'Standard 11 players per side', config: { scoringType: 'cricket', oversPerInnings: 20 } },
      { name: '6-a-side', playersPerTeam: 6, minTeams: 2, maxTeams: 2, description: '6 players per side', config: { scoringType: 'cricket', oversPerInnings: 5 } }
    ],
    statFields: [
      { key: 'totalRuns', matchKey: 'runs', label: 'Runs', type: 'number', aggregate: 'sum', leaderboard: true },
      { key: 'totalWickets', matchKey: 'wickets', label: 'Wickets', type: 'number', aggregate: 'sum' },
      { key: 'totalBallsFaced', matchKey: 'ballsFaced', label: 'Balls faced', type: 'number', aggregate: 'sum' },
      { key: 'totalOversBowled', matchKey: 'oversBowled', label: 'Overs bowled', type: 'number', aggregate: 'sum' },
      { key: 'highestScore', matchKey: 'runs', label: 'Highest score', type: 'number', aggregate: 'max' }
    ]
  },
  {
    name: 'football',
    displayName: 'Football',
    formats: [
      { name: '11-a-side', playersPerTeam: 11, minTeams: 2, maxTeams: 2, description: 'Standard 11 players per side', config: { scoringType: 'simple' } },
      { name: '5-a-side', playersPerTeam: 5, minTeams: 2, maxTeams: 2, description: '5 players per side', config: { scoringType: 'simple' } },
      { name: '7-a-side', playersPerTeam: 7, minTeams: 2, maxTeams: 2, description: '7 players per side', config: { scoringType: 'simple' } }
    ],
    statFields: [
      { key: 'totalGoals', matchKey: 'goals', label: 'Goals', type: 'number', aggregate: 'sum', leaderboard: true },
      { key: 'totalAssists', matchKey: 'assists', label: 'Assists', type: 'number', aggregate: 'sum' }
    ]
  },
  {
    name: 'basketball',
    displayName: 'Basketball',
    formats: [
      { name: '5-a-side', playersPerTeam: 5, minTeams: 2, maxTeams: 2, description: '5 players per team' },
      { name: '3v3', playersPerTeam: 3, minTeams: 2, maxTeams: 2, description: '3 players per team' }
    ],
    statFields: [
      { key: 'totalPoints', matchKey: 'points', label: 'Points', type: 'number', aggregate: 'sum', leaderboard: true },
      { key: 'totalRebounds', matchKey: 'rebounds', label: 'Rebounds', type: 'number', aggregate: 'sum' },
      { key: 'totalAssists', matchKey: 'assists', label: 'Assists', type: 'number', aggregate: 'sum' }
    ]
  },
  {
    name: 'tennis',
    displayName: 'Tennis',
    formats: [
      { name: 'singles', playersPerTeam: 1, minTeams: 2, maxTeams: 2, description: '1v1', config: { scoringType: 'tennis' } },
      { name: 'doubles', playersPerTeam: 2, minTeams: 2, maxTeams: 2, description: '2v2', config: { scoringType: 'tennis' } }
    ],
    statFields: [
      { key: 'aces', matchKey: 'aces', label: 'Aces', type: 'number', aggregate: 'sum', leaderboard: true },
      { key: 'doubleFaults', matchKey: 'doubleFaults', label: 'Double faults', type: 'number', aggregate: 'sum' },
      { key: 'gamesWon', matchKey: 'gamesWon', label: 'Games won', type: 'number', aggregate: 'sum' }
    ]
  },
  {
    name: 'badminton',
    displayName: 'Badminton',
    formats: [
      { name: 'singles', playersPerTeam: 1, minTeams: 2, maxTeams: 2, description: '1v1', config: { scoringType: 'badminton' } },
      { name: 'doubles', playersPerTeam: 2, minTeams: 2, maxTeams: 2, description: '2v2', config: { scoringType: 'badminton' } }
    ],
    statFields: [
      { key: 'pointsScored', matchKey: 'points', label: 'Points', type: 'number', aggregate: 'sum', leaderboard: true },
      { key: 'smashes', matchKey: 'smashes', label: 'Smashes', type: 'number', aggregate: 'sum' }
    ]
  },
  {
    name: 'volleyball',
    displayName: 'Volleyball',
    formats: [
      { name: '6-a-side', playersPerTeam: 6, minTeams: 2, maxTeams: 2, description: '6 players per team', config: { scoringType: 'simple' } },
      { name: 'beach doubles', playersPerTeam: 2, minTeams: 2, maxTeams: 2, description: '2v2 beach', config: { scoringType: 'simple' } }
    ],
    statFields: [
      { key: 'totalPoints', matchKey: 'points', label: 'Points', type: 'number', aggregate: 'sum', leaderboard: true },
      { key: 'aces', matchKey: 'aces', label: 'Aces', type: 'number', aggregate: 'sum' },
      { key: 'blocks', matchKey: 'blocks', label: 'Blocks', type: 'number', aggregate: 'sum' }
    ]
  },
  {
    name: 'pickleball',
    displayName: 'Pickleball',
    formats: [
      { name: 'singles', playersPerTeam: 1, minTeams: 2, maxTeams: 2, description: '1v1 rally point scoring (every rally scores)', config: { scoringType: 'pickleball_rally', pointsToWin: 11 } },
      { name: 'doubles', playersPerTeam: 2, minTeams: 2, maxTeams: 2, description: '2v2 rally point scoring', config: { scoringType: 'pickleball_rally', pointsToWin: 11 } },
      { name: 'best-of-3', playersPerTeam: 2, minTeams: 2, maxTeams: 2, description: 'Best of 3 games to 11, rally scoring', config: { scoringType: 'pickleball_rally', pointsToWin: 11, bestOf: 3 } },
      { name: 'singles (service)', playersPerTeam: 1, minTeams: 2, maxTeams: 2, description: '1v1 service point scoring (only server can score)', config: { scoringType: 'pickleball_service', pointsToWin: 11 } },
      { name: 'doubles (service)', playersPerTeam: 2, minTeams: 2, maxTeams: 2, description: '2v2 service point scoring (traditional)', config: { scoringType: 'pickleball_service', pointsToWin: 11 } }
    ],
    statFields: [
      { key: 'pointsWon', matchKey: 'points', label: 'Points', type: 'number', aggregate: 'sum', leaderboard: true },
      { key: 'gamesWon', matchKey: 'gamesWon', label: 'Games won', type: 'number', aggregate: 'sum' }
    ]
  },
  {
    name: 'padel',
    displayName: 'Padel',
    formats: [
      { name: 'doubles', playersPerTeam: 2, minTeams: 2, maxTeams: 2, description: '2v2', config: { scoringType: 'padel' } },
      { name: 'singles', playersPerTeam: 1, minTeams: 2, maxTeams: 2, description: '1v1', config: { scoringType: 'padel' } }
    ],
    statFields: [
      { key: 'gamesWon', matchKey: 'gamesWon', label: 'Games won', type: 'number', aggregate: 'sum', leaderboard: true },
      { key: 'pointsWon', matchKey: 'points', label: 'Points', type: 'number', aggregate: 'sum' }
    ]
  }
];

async function seedSports() {
  for (const s of defaultSports) {
    const { formats, ...sportData } = s;
    const existing = await prisma.sport.findFirst({ where: { name: s.name } });
    if (existing) {
      await prisma.sport.update({
        where: { id: existing.id },
        data: { ...sportData, statFields: sportData.statFields }
      });
      await prisma.sportFormat.deleteMany({ where: { sportId: existing.id } });
      if (formats && formats.length) {
        await prisma.sportFormat.createMany({
          data: formats.map(f => ({
            sportId: existing.id,
            name: f.name,
            playersPerTeam: f.playersPerTeam,
            minTeams: f.minTeams ?? 2,
            maxTeams: f.maxTeams ?? 2,
            description: f.description || null,
            config: f.config || null
          }))
        });
      }
    } else {
      await prisma.sport.create({
        data: {
          ...sportData,
          statFields: sportData.statFields,
          formats: {
            create: formats.map(f => ({
              name: f.name,
              playersPerTeam: f.playersPerTeam,
              minTeams: f.minTeams ?? 2,
              maxTeams: f.maxTeams ?? 2,
              description: f.description || null,
              config: f.config || null
            }))
          }
        }
      });
    }
  }
  console.log('Sports seeded:', defaultSports.length);
}

module.exports = { seedSports, defaultSports };
