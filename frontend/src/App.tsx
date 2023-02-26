import './App.css';
import { useAuth } from './features/auth/Provider';
import Header from './components/Header';
import { Table } from 'baseui/table-semantic';
import { useStyletron } from 'baseui';

const COLUMNS = [`To Do's`];

function App() {
  const {
    walletAvailable
  } = useAuth();
  const [css] = useStyletron();

  return (
    <div className="App">
      <Header />
      <div
        className={css({
          paddingInlineEnd: '64px',
          paddingInlineStart: '64px'
        })}
      >
        <div
          className={css({
            maxWidth: '1280px',
            paddingBlockEnd: '18px',
            paddingBlockStart: '18px',
            margin: 'auto'
          })}
        >
          <Table columns={COLUMNS} data={[]} emptyMessage={walletAvailable ? "No To Do created yet" : "Need to authenticate to see Wallet's To Do list"} />
        </div>
      </div>
    </div >
  );
}

export default App;
