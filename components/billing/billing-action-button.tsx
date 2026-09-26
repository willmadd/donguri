"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type Props = {
  action: () => Promise<void>;
  children: React.ReactNode;
  pendingText: string;
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
};

// A one-button form for the billing server actions (startCheckout,
// openBillingPortal), which redirect off to Stripe — so the button shows a
// pending state while the Stripe session is being created.
export function BillingActionButton({ action, ...props }: Props) {
  return (
    <form action={action} className={props.fullWidth ? "w-full" : undefined}>
      <PendingButton {...props} />
    </form>
  );
}

function PendingButton({ children, pendingText, variant, size, fullWidth }: Omit<Props, "action">) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} fullWidth={fullWidth} disabled={pending}>
      {pending ? pendingText : children}
    </Button>
  );
}
