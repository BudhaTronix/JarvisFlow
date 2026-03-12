import type { BrainstormResponse } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

export async function fetchBrainstorm(topic: string): Promise<BrainstormResponse> {
  const response = await fetch(`${API_BASE_URL}/api/brainstorm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ topic }),
  });

  if (!response.ok) {
    throw new Error("Unable to load brainstorming topics right now.");
  }

  return (await response.json()) as BrainstormResponse;
}
