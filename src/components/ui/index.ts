import type { ComponentPropsWithoutRef, ReactNode } from "react";

/**
 * Baseline presentation UI interfaces and contracts.
 * Purely presentational: forbidden from importing from src/server/ or src/features/.
 */
export interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
}

export interface CardProps extends ComponentPropsWithoutRef<"div"> {
  title?: string;
  children: ReactNode;
}

export interface InputProps extends ComponentPropsWithoutRef<"input"> {
  label?: string;
  error?: string;
}
