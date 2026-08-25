type AuthFieldProps = {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
  required?: boolean;
  placeholder?: string;
  minLength?: number;
};

export function AuthField({ id, label, ...inputProps }: AuthFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        className="h-11 rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-100"
        {...inputProps}
      />
    </div>
  );
}
