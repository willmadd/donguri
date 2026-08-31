type SubmitButtonProps = {
  pending: boolean;
  children: React.ReactNode;
  pendingText?: string;
};

export function SubmitButton({
  pending,
  children,
  pendingText = "Please wait…",
}: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 inline-flex h-11 items-center justify-center rounded-full bg-ai px-6 font-medium text-washi transition hover:bg-ai-dark disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingText : children}
    </button>
  );
}
