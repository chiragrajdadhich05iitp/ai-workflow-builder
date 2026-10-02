"use client";

import { useEffect } from "react";

/**
 * Emits exactly one console.log on the initial client render of every page.
 * PRD requirement for build attribution.
 */
export function LinkedInLogger() {
  useEffect(() => {
    console.log(
      "[NextFlow] Candidate LinkedIn: https://www.linkedin.com/in/sameergupta533/"
    );
  }, []);
  return null;
}
