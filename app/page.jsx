import { isTeacherLoggedIn } from "@/lib/auth";
import HomeContent from "./components/HomeContent";

export default function HomePage() {
  const loggedIn = isTeacherLoggedIn();
  return <HomeContent loggedIn={loggedIn} />;
}
