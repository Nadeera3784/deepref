"use client";

import type { ComponentProps } from "react";
import { type Control, Controller, type FieldPath, type FieldValues } from "react-hook-form";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

// TOutput differs from T when the schema transforms values (e.g. "" -> null).
type Props<T extends FieldValues, TContext, TOutput extends FieldValues> = {
  control: Control<T, TContext, TOutput>;
  name: FieldPath<T>;
  label: string;
  description?: string;
} & Omit<ComponentProps<typeof Input>, "name" | "value" | "onChange" | "onBlur" | "defaultValue">;

/** A labelled shadcn Input bound to React Hook Form, with accessible error wiring. */
export function FormInput<
  T extends FieldValues,
  TContext = unknown,
  TOutput extends FieldValues = T,
>({ control, name, label, description, id = name, ...inputProps }: Props<T, TContext, TOutput>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const describedBy = [
          description && `${id}-description`,
          fieldState.invalid && `${id}-error`,
        ].filter(Boolean);
        return (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <Input
              {...inputProps}
              {...field}
              id={id}
              value={field.value ?? ""}
              aria-invalid={fieldState.invalid}
              aria-describedby={describedBy.join(" ") || undefined}
            />
            {description && !fieldState.invalid && (
              <FieldDescription id={`${id}-description`}>{description}</FieldDescription>
            )}
            {fieldState.invalid && <FieldError id={`${id}-error`} errors={[fieldState.error]} />}
          </Field>
        );
      }}
    />
  );
}
