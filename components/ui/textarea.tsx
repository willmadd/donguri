type TextareaFieldProps = {
  label: string;
  name: string;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  defaultValue?: string;
  errors?: string[];
};

export function TextareaField({
  label,
  name,
  placeholder,
  rows = 3,
  required = false,
  defaultValue,
  errors,
}: TextareaFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium text-sumi-soft">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        placeholder={placeholder}
        rows={rows}
        required={required}
        defaultValue={defaultValue}
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
