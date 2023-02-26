import logo from './logo.svg';
import './App.css';
import { useAuth } from './features/auth/Provider';

function App() {
  const {
    isAuthenticated,
    authenticate,
    provider
  } = useAuth();

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        {!isAuthenticated() &&
          <button onClick={() => authenticate(provider)}>Connect</button>
        }
      </header>
    </div >
  );
}

export default App;
