type SelectFieldProps = {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  required?: boolean;
  errors?: string[];
};

export function SelectField({
  label,
  name,
  options,
  required = true,
  errors,
}: SelectFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium text-sumi-soft">
        {label}
      </label>
      <select
        id={name}
        name={name}
        required={required}
        aria-invalid={errors && errors.length > 0}
        defaultValue=""
        className="rounded-lg border border-sumi/15 bg-washi px-4 py-2.5 text-sumi outline-none transition focus:border-ai focus:ring-2 focus:ring-ai-soft"
      >
        <option value="" disabled>
          Select…
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {errors?.map((error) => (
        <p key={error} className="text-sm text-shu">
          {error}
        </p>
      ))}
    </div>
  );
}
