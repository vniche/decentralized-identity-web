import { useAuth } from '../features/auth/Provider';
import Login from '../features/auth/Login';
import { withStyle } from 'baseui';
import {
  AppNavBar,
  StyledRoot as StyledNavBarRoot
} from 'baseui/app-nav-bar';

const NavBarRoot = withStyle(StyledNavBarRoot, () => ({
  borderBottomWidth: '0px'
}));

const mainItems = [
  { label: 'Login' }
];

const userItems = [
  { label: 'Logout' },
];

export default function Header() {
  const { session, wallet, logout, walletAvailable } = useAuth();

  return (
    <AppNavBar
      overrides={{
        Root: NavBarRoot
      }}
      title="Decentralized Identity"
      mainItems={session === undefined ? mainItems : undefined}
      userItems={session !== undefined ? userItems : undefined}
      mapItemToNode={({ label }) => {
        switch (label) {
          case 'Login':
            return <Login />;
          default:
            return (
              <div>
                {label}
              </div>
            );
        }
      }}
      onUserItemSelect={({ label }) => {
        switch (label) {
          case 'Logout':
            logout();
        }
      }}
      username={walletAvailable ? wallet?.address : undefined}
    />
  );
};