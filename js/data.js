/**
 * Initial Data for Hastma Cup #3 2026
 * Default tournament data with teams, players, and matches
 */

const DEFAULT_TOURNAMENT_DATA = {
  "teams": [
    {
      "id": "2014",
      "name": "Tim 2014",
      "group": "A",
      "color": "#e74c3c",
      "players": [
        { "number": 1, "name": "Kiper" },
        { "number": 4, "name": "Bek" },
        { "number": 7, "name": "Gelandang" },
        { "number": 10, "name": "Penyerang" }
      ]
    },
    {
      "id": "2017",
      "name": "Tim 2017",
      "group": "A",
      "color": "#3498db",
      "players": [
        { "number": 1, "name": "Kiper" },
        { "number": 4, "name": "Bek" },
        { "number": 7, "name": "Gelandang" },
        { "number": 10, "name": "Penyerang" }
      ]
    },
    {
      "id": "u2011",
      "name": "U-2011",
      "group": "A",
      "color": "#2ecc71",
      "players": [
        { "number": 1, "name": "Kiper" },
        { "number": 4, "name": "Bek" },
        { "number": 7, "name": "Gelandang" },
        { "number": 10, "name": "Penyerang" }
      ]
    },
    {
      "id": "2018",
      "name": "Tim 2018",
      "group": "B",
      "color": "#9b59b6",
      "players": [
        { "number": 1, "name": "Kiper" },
        { "number": 4, "name": "Bek" },
        { "number": 7, "name": "Gelandang" },
        { "number": 10, "name": "Penyerang" }
      ]
    },
    {
      "id": "2019",
      "name": "Tim 2019",
      "group": "B",
      "color": "#f39c12",
      "players": [
        { "number": 1, "name": "Kiper" },
        { "number": 4, "name": "Bek" },
        { "number": 7, "name": "Gelandang" },
        { "number": 10, "name": "Penyerang" }
      ]
    },
    {
      "id": "2016",
      "name": "Tim 2016",
      "group": "B",
      "color": "#1abc9c",
      "players": [
        { "number": 1, "name": "Kiper" },
        { "number": 4, "name": "Bek" },
        { "number": 7, "name": "Gelandang" },
        { "number": 10, "name": "Penyerang" }
      ]
    }
  ],
  "matches": [
    // --- Group Stage (Interleaved for Rest Times) ---
    {
      "id": "A1",
      "stage": "group",
      "group": "A",
      "homeTeam": "2014",
      "awayTeam": "u2011",
      "date": "2026-01-31",
      "time": "16:00",
      "endTime": "16:16",
      "venue": "Mini Soccer",
      "status": "scheduled",
      "homeScore": 2,
      "awayScore": 1,
      "events": [
        { "type": "goal", "teamId": "2014", "player": "Budi", "playerName": "Budi", "minute": 5 },
        { "type": "goal", "teamId": "u2011", "player": "Andi", "playerName": "Andi", "minute": 12 },
        { "type": "goal", "teamId": "2014", "player": "Budi", "playerName": "Budi", "minute": 45 }
      ]
    },
    {
      "id": "B1",
      "stage": "group",
      "group": "B",
      "homeTeam": "2018",
      "awayTeam": "2016",
      "date": "2026-01-31",
      "time": "16:18",
      "endTime": "16:34",
      "venue": "Mini Soccer",
      "status": "scheduled",
      "homeScore": 0,
      "awayScore": 0,
      "events": []
    },
    {
      "id": "A2",
      "stage": "group",
      "group": "A",
      "homeTeam": "2017",
      "awayTeam": "2014",
      "date": "2026-01-31",
      "time": "16:36",
      "endTime": "16:52",
      "venue": "Mini Soccer",
      "status": "scheduled",
      "homeScore": 0,
      "awayScore": 0,
      "events": []
    },
    {
      "id": "B2",
      "stage": "group",
      "group": "B",
      "homeTeam": "2019",
      "awayTeam": "2018",
      "date": "2026-01-31",
      "time": "16:54",
      "endTime": "17:10",
      "venue": "Mini Soccer",
      "status": "scheduled",
      "homeScore": 0,
      "awayScore": 0,
      "events": []
    },
    {
      "id": "A3",
      "stage": "group",
      "group": "A",
      "homeTeam": "u2011",
      "awayTeam": "2017",
      "date": "2026-01-31",
      "time": "17:12",
      "endTime": "17:28",
      "venue": "Mini Soccer",
      "status": "scheduled",
      "homeScore": 0,
      "awayScore": 0,
      "events": []
    },
    {
      "id": "B3",
      "stage": "group",
      "group": "B",
      "homeTeam": "2016",
      "awayTeam": "2019",
      "date": "2026-01-31",
      "time": "17:30",
      "endTime": "17:46",
      "venue": "Mini Soccer",
      "status": "scheduled",
      "homeScore": 0,
      "awayScore": 0,
      "events": []
    },

    // --- Semi Finals ---
    {
      "id": "SF1",
      "stage": "semi",
      "group": null,
      "homeTeam": null,
      "awayTeam": null,
      "date": "2026-01-31",
      "time": "18:45",
      "endTime": "19:01",
      "venue": "Mini Soccer",
      "status": "scheduled",
      "homeScore": 0,
      "awayScore": 0,
      "events": []
    },
    {
      "id": "SF2",
      "stage": "semi",
      "group": null,
      "homeTeam": null,
      "awayTeam": null,
      "date": "2026-01-31",
      "time": "19:05",
      "endTime": "19:21",
      "venue": "Mini Soccer",
      "status": "scheduled",
      "homeScore": 0,
      "awayScore": 0,
      "events": []
    },

    // --- Finals ---
    {
      "id": "M3RD",
      "stage": "3rd_place",
      "group": null,
      "homeTeam": null,
      "awayTeam": null,
      "date": "2026-01-31",
      "time": "19:25",
      "endTime": "19:43",
      "venue": "Mini Soccer",
      "status": "scheduled",
      "homeScore": 0,
      "awayScore": 0,
      "events": []
    },
    {
      "id": "F1",
      "stage": "final",
      "group": null,
      "homeTeam": null,
      "awayTeam": null,
      "date": "2026-01-31",
      "time": "19:47",
      "endTime": "20:05",
      "venue": "Mini Soccer",
      "status": "scheduled",
      "homeScore": 0,
      "awayScore": 0,
      "events": []
    }
  ],
  "metadata": {
    "tournamentName": "HASTMA CUP #3 2026",
    "subtitle": "Mini Soccer Tournament",
    "startDate": "2026-08-01",
    "lastUpdated": new Date().toISOString()
  }
};

// Admin configuration
const ADMIN_CONFIG = {
  "password": "hastma2026",
  "sessionTimeout": 3600000, // 1 hour in milliseconds
  "autoRefreshInterval": 30000 // 30 seconds
};
