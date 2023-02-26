import { Button } from "baseui/button";
import { useAuth } from "./Provider";

export default function Login() {
  const { provider, authenticate } = useAuth();
  return (
    <Button onClick={() => authenticate(provider)}>Login</Button>
  );
};