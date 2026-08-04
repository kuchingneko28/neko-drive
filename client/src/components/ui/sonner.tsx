import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  // Try to use next-themes if available, or fall back to manual prop/system
  // Since we might not have next-themes installed, we'll check imports or just use props.
  // Actually, the user's App.tsx manually manages theme in state.
  // We should accept theme as a prop or rely on the parent to pass it.

  return (
    <Sonner
      className="toaster group"
      richColors
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:shadow-2xl group-[.toaster]:backdrop-blur-3xl group-[.toaster]:rounded-2xl font-sans",
          description: "group-[.toast]:text-muted-foreground font-medium",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground font-bold",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground font-bold",
        },
        style: {
          fontFamily: '"Plus Jakarta Sans", sans-serif',
          // Normal
          "--normal-bg": "var(--card)",
          "--normal-border": "var(--border)",
          "--normal-text": "var(--foreground)",
          // Success (Green Glass)
          "--success-bg": "rgba(34, 197, 94, 0.15)",
          "--success-border": "rgba(34, 197, 94, 0.2)",
          "--success-text": "var(--foreground)",
          // Error (Red Glass)
          "--error-bg": "rgba(239, 68, 68, 0.15)",
          "--error-border": "rgba(239, 68, 68, 0.2)",
          "--error-text": "var(--foreground)",
        } as React.CSSProperties,
      }}
      {...props}
    />
  );
};

export { Toaster };
