/**
 * Simple test version of App to verify React is working
 */

import './App.css';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>⚔️ Battle Bets V3</h1>
        <p>Testing React + TypeScript Setup</p>
      </header>

      <main className="app-main">
        <div className="info-panel">
          <h3>🎯 System Check</h3>
          <ul>
            <li>✅ React is working!</li>
            <li>✅ TypeScript is working!</li>
            <li>✅ Vite HMR is working!</li>
            <li>🔄 Loading PixiJS canvas...</li>
          </ul>
        </div>

        <button onClick={() => alert('Button works!')} className="reset-button">
          Test Button
        </button>
      </main>
    </div>
  );
}

export default App;

