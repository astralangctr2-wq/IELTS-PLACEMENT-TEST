import { withIds } from "./content";
import { getContentBank, getDefaultContentBank } from "./contentBanks";

// Returns content (WITH correct-answer keys, id-tagged) for a given
// content bank id, or the default bank when no id is given (this is
// what powers the fixed /test link). Server-only — never send the
// return value of this straight to the browser.
export async function getActiveContentWithAnswers(bankId) {
  const bank = bankId ? await getContentBank(bankId) : await getDefaultContentBank();
  if (!bank) throw new Error("Không tìm thấy bộ đề.");
  return withIds(bank.content);
}
