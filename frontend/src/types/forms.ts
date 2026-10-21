import type { ComponentProps } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

export type FormInputProps<T extends FieldValues, TContext, TOutput extends FieldValues> = {
  control: Control<T, TContext, TOutput>;
  name: FieldPath<T>;
  label: string;
  description?: string;
} & Omit<ComponentProps<"input">, "name" | "value" | "onChange" | "onBlur" | "defaultValue">;
