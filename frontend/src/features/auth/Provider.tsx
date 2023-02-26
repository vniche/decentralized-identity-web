import { createContext, ReactNode, useContext } from "react";
import { useNavigate } from "react-router-dom";
import Cookies from 'js-cookie';
import { useMeQuery, Wallet } from "./api";
import { BrowserProvider, ethers } from 'ethers';
import { CompactEncrypt, importSPKI } from 'jose';
import { Buffer } from 'buffer';

type Auth = {
  session: string | undefined;
  walletAvailable: boolean;
  provider: BrowserProvider | undefined;
  wallet: Wallet | undefined;
  authenticate: Function;
  isAuthenticated: Function;
  logout: Function;
};

export const defaultAuth: Auth = {
  session: undefined,
  walletAvailable: false,
  provider: undefined,
  wallet: undefined,
  authenticate: () => { },
  isAuthenticated: () => { },
  logout: () => { },
};

export const AuthContext = createContext<Auth>(defaultAuth);

export const useAuth = () => {
  return useContext(AuthContext);
};

type AuthProviderProps = {
  children: ReactNode
};

const {
  REACT_APP_AUTH_API_PUBLIC_KEY,
  REACT_APP_AUTH_API_HOST
} = process.env;

const publicKeyRaw = Buffer.from(REACT_APP_AUTH_API_PUBLIC_KEY || '', 'base64')

const AuthProvider = ({ children }: AuthProviderProps) => {
  const sessionToken = Cookies.get('WALLET_SESSION_ID');
  const { data: wallet, isSuccess: walletSuccess } = useMeQuery();
  const navigate = useNavigate();

  const authenticate = async (provider: BrowserProvider) => {
    const publicKey = await importSPKI(publicKeyRaw.toString(), 'RSA-OAEP-256');

    // ensure an wallet is connected to the web application
    await provider.send("eth_requestAccounts", []);

    const signer = await provider.getSigner();

    // requests wallet to sign message
    const signature = await signer.signMessage(signer.address);

    const payload = {
      address: signer.address,
      signature
    };

    const jwe = await new CompactEncrypt(new TextEncoder().encode(JSON.stringify(payload)))
      .setProtectedHeader({ alg: "RSA-OAEP-256", enc: "A256GCM" })
      .encrypt(publicKey);

    window.location.assign(`${REACT_APP_AUTH_API_HOST}/v1/authenticate?jwe=${encodeURIComponent(jwe)}`)
  };

  const handleIsAuthenticated = () => {
    return sessionToken !== undefined;
  };

  const handleLogout = () => {
    Cookies.remove('WALLET_SESSION_ID');
    window.location.assign('/');
  };

  const value = {
    session: sessionToken,
    walletAvailable: !window.ethereum,
    provider: new ethers.BrowserProvider(window.ethereum),
    wallet: walletSuccess ? wallet : defaultAuth.wallet,
    authenticate: authenticate,
    isAuthenticated: handleIsAuthenticated,
    logout: handleLogout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;