import { FULL_TEST_CONFIG } from "@/lib/testSessions";
import TestRunner from "./TestRunner";

export default function TestPage() {
  return <TestRunner config={{ ...FULL_TEST_CONFIG, sessionId: null }} />;
}
