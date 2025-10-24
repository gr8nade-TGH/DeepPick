// Test NBA Stats API directly
async function testNBAApi() {
  const teamId = 1610612743; // Denver Nuggets
  const season = '2024-25';
  
  const url = `https://stats.nba.com/stats/teamdashboardbygeneralsplits?DateFrom=&DateTo=&GameSegment=&LastNGames=0&LeagueID=00&Location=&MeasureType=Advanced&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlusMinus=N&Rank=N&Season=${encodeURIComponent(season)}&SeasonSegment=&SeasonType=Regular+Season&ShotClockRange=&TeamID=${teamId}&VsConference=&VsDivision=`;
  
  console.log('Testing NBA Stats API...');
  console.log('URL:', url.substring(0, 200) + '...');
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.nba.com/',
        'Origin': 'https://www.nba.com',
        'x-nba-stats-origin': 'stats',
        'x-nba-stats-token': 'true',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const text = await response.text();
    console.log('Response length:', text.length);
    console.log('First 500 chars:', text.substring(0, 500));
    
    if (response.ok) {
      const json = JSON.parse(text);
      console.log('JSON structure:', Object.keys(json));
      if (json.resultSets && json.resultSets[0]) {
        console.log('Result sets:', json.resultSets.length);
        console.log('Headers:', json.resultSets[0].headers);
        console.log('Row count:', json.resultSets[0].rowSet ? json.resultSets[0].rowSet.length : 0);
        if (json.resultSets[0].rowSet && json.resultSets[0].rowSet[0]) {
          console.log('First row:', json.resultSets[0].rowSet[0]);
        }
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testNBAApi();
