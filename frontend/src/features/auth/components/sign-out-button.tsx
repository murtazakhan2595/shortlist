import { Button } from "@/components/ui/button";
import { signOut } from "../actions";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="quiet">
        Sign out
      </Button>
    </form>
  );
}
