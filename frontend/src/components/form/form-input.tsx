"use client";

import { Controller, type FieldValues } from "react-hook-form";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { FormInputProps } from "@/types";

export function FormInput<
  T extends FieldValues,
  TContext = unknown,
  TOutput extends FieldValues = T,
>({ control, name, label, description, id = name, ...inputProps }: FormInputProps<T, TContext, TOutput>) {
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
