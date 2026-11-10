import * as React from "react"
import { createContext, useContext, useCallback, useState } from "react"
import { cva } from "class-variance-authority"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

/** @type {React.Context<{ toast: (props?: any) => any, dismiss: (id?: any) => void, dismissAll: () => void }>} */
const ToastContext = createContext({
  toast: () => {},
  dismiss: () => {},
  dismissAll: () => {}
});

const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([])

  const toast = useCallback(
    (props) => {
      const id = Math.random().toString(36).substring(2, 9)
      setToasts((prev) => [...prev, { id, ...props }])
      return id
    },
    [setToasts]
  )

  const dismiss = useCallback(
    (id) => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
    },
    [setToasts]
  )

  const dismissAll = useCallback(() => {
    setToasts([])
  }, [setToasts])

  const value = {
    toast,
    dismiss,
    dismissAll,
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  )
}

const ToastContainer = ({ toasts, dismiss }) => {
  return (
    <div className="fixed bottom-0 right-0 z-50 flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
      ))}
    </div>
  )
}

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
  {
    variants: {
      variant: {
        default: "border bg-white dark:bg-slate-950 dark:border-slate-800",
        destructive:
          "destructive group border-red-600 bg-red-600 text-slate-50 dark:border-red-900 dark:bg-red-900",
        success:
          "success group border-green-600 bg-green-600 text-slate-50 dark:border-green-900 dark:bg-green-900",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Toast = ({ toast, onDismiss }) => {
  const { variant = "default", title, description, className } = toast
  const timerRef = React.useRef(0)

  React.useEffect(() => {
    timerRef.current = window.setTimeout(() => {
      onDismiss()
    }, 5000)

    return () => clearTimeout(timerRef.current)
  }, [onDismiss])

  return (
    <div className={cn(toastVariants({ variant }), className)}>
      <div className="grid gap-1">
        {title && <p className="text-sm font-semibold">{title}</p>}
        {description && <p className="text-sm opacity-90">{description}</p>}
      </div>
      <button
        onClick={onDismiss}
        className="absolute right-2 top-2 rounded-md p-1 text-slate-950/50 opacity-0 transition-opacity hover:text-slate-950 focus:opacity-100 group-hover:opacity-100 dark:text-slate-50/50 dark:hover:text-slate-50"
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </button>
    </div>
  )
}

const ToastActionElement = React.forwardRef(({ className, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-white transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:border-slate-800 dark:ring-offset-slate-950 dark:hover:bg-slate-800 dark:focus:ring-slate-300",
      className
    )}
    {...props}
  />
))
ToastActionElement.displayName = "ToastActionElement"

export { ToastProvider, ToastContext, ToastActionElement }

export function useToast() {
  const context = useContext(ToastContext)

  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider")
  }

  return context
}