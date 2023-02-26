import { createContext, ReactNode, useContext } from "react";
import Cookies from 'js-cookie';
import { useMeQuery, Wallet } from "./api";
import { BrowserProvider, ethers } from 'ethers';
import { CompactEncrypt, importSPKI } from 'jose';
import { Buffer } from 'buffer';

type Auth = {
  session: string | undefined;
  providerAvailable: boolean;
  provider: BrowserProvider | undefined;
  walletAvailable: boolean;
  wallet: Wallet | undefined;
  authenticate: Function;
  logout: Function;
};

export const defaultAuth: Auth = {
  session: undefined,
  providerAvailable: false,
  provider: undefined,
  walletAvailable: false,
  wallet: undefined,
  authenticate: () => { },
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
  const { data: wallet, isSuccess: walletSuccess, isFetching: walletFetching } = useMeQuery();

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

  const handleLogout = () => {
    Cookies.remove('WALLET_SESSION_ID');
    window.location.assign('/');
  };

  const value = {
    session: sessionToken,
    providerAvailable: !window.ethereum,
    provider: new ethers.BrowserProvider(window.ethereum),
    walletAvailable: (!walletFetching && walletSuccess) ? true : false,
    wallet: walletSuccess ? wallet : defaultAuth.wallet,
    authenticate: authenticate,
    logout: handleLogout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;