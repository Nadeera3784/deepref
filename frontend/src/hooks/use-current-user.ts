"use client";

import { useQuery } from "@tanstack/react-query";

import { queries } from "@/lib/queries";

export function useCurrentUser() {
  return useQuery(queries.me());
}
