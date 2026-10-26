import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          success: "group-[.toaster]:border-emerald-400 group-[.toaster]:bg-emerald-50 group-[.toaster]:text-emerald-950",
          error: "group-[.toaster]:border-red-400 group-[.toaster]:bg-red-50 group-[.toaster]:text-red-950",
          warning: "group-[.toaster]:border-amber-400 group-[.toaster]:bg-amber-50 group-[.toaster]:text-amber-950",
          info: "group-[.toaster]:border-blue-400 group-[.toaster]:bg-blue-50 group-[.toaster]:text-blue-950",
          loading: "group-[.toaster]:border-border group-[.toaster]:bg-background group-[.toaster]:text-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
