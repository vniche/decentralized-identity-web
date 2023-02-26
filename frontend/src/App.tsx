import logo from './logo.svg';
import './App.css';
import { useAuth } from './features/auth/Provider';

function App() {
  const {
    isAuthenticated,
    authenticate,
    logout,
    provider,
    wallet
  } = useAuth();

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        {!isAuthenticated() &&
          <button onClick={() => authenticate(provider)}>Login</button>
        }
        {wallet &&
          <>
            <span>authenticated as {wallet.address}</span>
            <span>(this info was loaded from auth service)</span>
            <button onClick={() => logout()}>Logout</button>
          </>
        }
      </header>
    </div >
  );
}

export default App;
