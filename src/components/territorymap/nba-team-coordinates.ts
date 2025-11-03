export interface NBATeamCoordinate {
  abbr: string
  name: string
  city: string
  longitude: number
  latitude: number
  conference: 'Eastern' | 'Western'
  division: string
}

export const NBA_TEAM_COORDINATES: NBATeamCoordinate[] = [
  // Eastern Conference - Atlantic
  { abbr: 'BOS', name: 'Boston Celtics', city: 'Boston, MA', longitude: -71.0621, latitude: 42.3662, conference: 'Eastern', division: 'Atlantic' },
  { abbr: 'BKN', name: 'Brooklyn Nets', city: 'Brooklyn, NY', longitude: -73.9752, latitude: 40.6826, conference: 'Eastern', division: 'Atlantic' },
  { abbr: 'NYK', name: 'New York Knicks', city: 'New York, NY', longitude: -73.9934, latitude: 40.7505, conference: 'Eastern', division: 'Atlantic' },
  { abbr: 'PHI', name: 'Philadelphia 76ers', city: 'Philadelphia, PA', longitude: -75.1719, latitude: 39.9012, conference: 'Eastern', division: 'Atlantic' },
  { abbr: 'TOR', name: 'Toronto Raptors', city: 'Toronto, ON', longitude: -79.3791, latitude: 43.6435, conference: 'Eastern', division: 'Atlantic' },

  // Eastern Conference - Central
  { abbr: 'CHI', name: 'Chicago Bulls', city: 'Chicago, IL', longitude: -87.6742, latitude: 41.8807, conference: 'Eastern', division: 'Central' },
  { abbr: 'CLE', name: 'Cleveland Cavaliers', city: 'Cleveland, OH', longitude: -81.6882, latitude: 41.4965, conference: 'Eastern', division: 'Central' },
  { abbr: 'DET', name: 'Detroit Pistons', city: 'Detroit, MI', longitude: -83.0555, latitude: 42.3410, conference: 'Eastern', division: 'Central' },
  { abbr: 'IND', name: 'Indiana Pacers', city: 'Indianapolis, IN', longitude: -86.1555, latitude: 39.7640, conference: 'Eastern', division: 'Central' },
  { abbr: 'MIL', name: 'Milwaukee Bucks', city: 'Milwaukee, WI', longitude: -87.9171, latitude: 43.0436, conference: 'Eastern', division: 'Central' },

  // Eastern Conference - Southeast
  { abbr: 'ATL', name: 'Atlanta Hawks', city: 'Atlanta, GA', longitude: -84.3963, latitude: 33.7573, conference: 'Eastern', division: 'Southeast' },
  { abbr: 'CHA', name: 'Charlotte Hornets', city: 'Charlotte, NC', longitude: -80.8392, latitude: 35.2251, conference: 'Eastern', division: 'Southeast' },
  { abbr: 'MIA', name: 'Miami Heat', city: 'Miami, FL', longitude: -80.1870, latitude: 25.7814, conference: 'Eastern', division: 'Southeast' },
  { abbr: 'ORL', name: 'Orlando Magic', city: 'Orlando, FL', longitude: -81.3839, latitude: 28.5392, conference: 'Eastern', division: 'Southeast' },
  { abbr: 'WAS', name: 'Washington Wizards', city: 'Washington, DC', longitude: -77.0210, latitude: 38.8981, conference: 'Eastern', division: 'Southeast' },

  // Western Conference - Northwest
  { abbr: 'DEN', name: 'Denver Nuggets', city: 'Denver, CO', longitude: -104.9931, latitude: 39.7487, conference: 'Western', division: 'Northwest' },
  { abbr: 'MIN', name: 'Minnesota Timberwolves', city: 'Minneapolis, MN', longitude: -93.2761, latitude: 44.9795, conference: 'Western', division: 'Northwest' },
  { abbr: 'OKC', name: 'Oklahoma City Thunder', city: 'Oklahoma City, OK', longitude: -97.5151, latitude: 35.4634, conference: 'Western', division: 'Northwest' },
  { abbr: 'POR', name: 'Portland Trail Blazers', city: 'Portland, OR', longitude: -122.6668, latitude: 45.5316, conference: 'Western', division: 'Northwest' },
  { abbr: 'UTA', name: 'Utah Jazz', city: 'Salt Lake City, UT', longitude: -111.9011, latitude: 40.7683, conference: 'Western', division: 'Northwest' },

  // Western Conference - Pacific
  { abbr: 'GSW', name: 'Golden State Warriors', city: 'San Francisco, CA', longitude: -122.3874, latitude: 37.7680, conference: 'Western', division: 'Pacific' },
  { abbr: 'LAC', name: 'LA Clippers', city: 'Los Angeles, CA', longitude: -118.2673, latitude: 34.0430, conference: 'Western', division: 'Pacific' },
  { abbr: 'LAL', name: 'Los Angeles Lakers', city: 'Los Angeles, CA', longitude: -118.2673, latitude: 34.0430, conference: 'Western', division: 'Pacific' },
  { abbr: 'PHX', name: 'Phoenix Suns', city: 'Phoenix, AZ', longitude: -112.0712, latitude: 33.4457, conference: 'Western', division: 'Pacific' },
  { abbr: 'SAC', name: 'Sacramento Kings', city: 'Sacramento, CA', longitude: -121.4999, latitude: 38.5802, conference: 'Western', division: 'Pacific' },

  // Western Conference - Southwest
  { abbr: 'DAL', name: 'Dallas Mavericks', city: 'Dallas, TX', longitude: -96.8103, latitude: 32.7905, conference: 'Western', division: 'Southwest' },
  { abbr: 'HOU', name: 'Houston Rockets', city: 'Houston, TX', longitude: -95.3621, latitude: 29.7508, conference: 'Western', division: 'Southwest' },
  { abbr: 'MEM', name: 'Memphis Grizzlies', city: 'Memphis, TN', longitude: -90.0505, latitude: 35.1382, conference: 'Western', division: 'Southwest' },
  { abbr: 'NOP', name: 'New Orleans Pelicans', city: 'New Orleans, LA', longitude: -90.0821, latitude: 29.9490, conference: 'Western', division: 'Southwest' },
  { abbr: 'SAS', name: 'San Antonio Spurs', city: 'San Antonio, TX', longitude: -98.4375, latitude: 29.4270, conference: 'Western', division: 'Southwest' },
]

