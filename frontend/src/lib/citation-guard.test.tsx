// frontend/src/lib/citation-guard.test.tsx

import { CitationGuard } from "./citation-guard"

test("sanitize redacts uncited numbers", () => {
  const result = CitationGuard.sanitize("Stock rose 5.2% today")
  expect(result).toContain("[REDACTED: uncited numeric]")
})