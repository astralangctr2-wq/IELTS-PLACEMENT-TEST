import { getStaff } from "@/lib/staff";
import HomeContent from "./components/HomeContent";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const loggedIn = Boolean(await getStaff());
  return <HomeContent loggedIn={loggedIn} />;
}
