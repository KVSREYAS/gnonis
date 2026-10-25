"use client";

import { createContext, useContext, type ReactNode } from "react";

const LessonIdContext = createContext("");

export function LessonIdProvider({ id, children }: { id: string; children: ReactNode }) {
  return <LessonIdContext.Provider value={id}>{children}</LessonIdContext.Provider>;
}

export function useLessonId(): string {
  return useContext(LessonIdContext);
}
