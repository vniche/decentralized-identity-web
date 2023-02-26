import { Button } from "baseui/button";
import { useAuth } from "./Provider";

export default function Logout() {
  const { logout } = useAuth();
  return (
    <Button onClick={() => logout()}>Logout</Button>
  );
};