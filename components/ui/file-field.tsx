type FileFieldProps = {
  label: string;
  name: string;
  accept?: string;
  required?: boolean;
  errors?: string[];
  onChange?: (file: File | null) => void;
};

export function FileField({
  label,
  name,
  accept,
  required = false,
  errors,
  onChange,
}: FileFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium text-sumi-soft">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="file"
        accept={accept}
        required={required}
        aria-invalid={errors && errors.length > 0}
        onChange={(e) => onChange?.(e.target.files?.[0] ?? null)}
        className="rounded-lg border border-sumi/15 bg-washi px-4 py-2.5 text-sumi outline-none transition file:mr-3 file:rounded-full file:border-0 file:bg-ai/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ai-dark focus:border-ai focus:ring-2 focus:ring-ai-soft"
      />
      {errors?.map((error) => (
        <p key={error} className="text-sm text-shu">
          {error}
        </p>
      ))}
    </div>
  );
}
