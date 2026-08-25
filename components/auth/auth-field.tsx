import { inputClasses } from "@/components/ui/field";

type AuthFieldProps = {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
  required?: boolean;
  placeholder?: string;
  minLength?: number;
  disabled?: boolean;
};

export function AuthField({ id, label, ...inputProps }: AuthFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={id}
        name={id}
        className={inputClasses}
        {...inputProps}
      />
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
    >
      {message}
    </p>
  );
}
