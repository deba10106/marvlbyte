import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type Theme = "system" | "light" | "dark" | "nord" | "cyberpunk";

export const themes: { name: string; value: Theme }[] = [
  { name: "System", value: "system" },
  { name: "Light", value: "light" },
  { name: "Dark", value: "dark" },
  { name: "Nord", value: "nord" },
  { name: "Cyberpunk", value: "cyberpunk" },
];
