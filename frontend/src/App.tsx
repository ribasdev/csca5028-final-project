import Dashboard from './components/Dashboard';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="app-header">
        <h1>🔐 SSL Certificate Monitor</h1>
        <p>Midwest Universities Security Dashboard</p>
      </header>
      <main>
        <Dashboard />
      </main>
    </div>
  );
}

export default App;
