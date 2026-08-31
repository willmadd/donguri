type TextFieldProps = {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  errors?: string[];
};

export function TextField({
  label,
  name,
  type = "text",
  placeholder,
  autoComplete,
  required = true,
  errors,
}: TextFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={name}
        className="text-sm font-medium text-sumi-soft"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        aria-invalid={errors && errors.length > 0}
        className="rounded-lg border border-sumi/15 bg-washi px-4 py-2.5 text-sumi placeholder:text-sumi-soft/50 outline-none transition focus:border-ai focus:ring-2 focus:ring-ai-soft"
      />
      {errors?.map((error) => (
        <p key={error} className="text-sm text-shu">
          {error}
        </p>
      ))}
    </div>
  );
}
