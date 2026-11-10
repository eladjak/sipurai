// Plain-JS components written as React.forwardRef(({ className, ...props }, ref) => ...) have no
// props annotation, so React's default (P = {}) types their props as the EMPTY object and then
// reports every className / children / onClick at every call site (about 1,000 errors, none of
// them bugs). In a JS project the honest type of an unannotated prop bag is `any`.
// This changes type checking only; nothing here exists at runtime.
import 'react';

declare module 'react' {
  function forwardRef<T = any, P = any>(
    render: ForwardRefRenderFunction<T, P>,
  ): ForwardRefExoticComponent<P & RefAttributes<T>>;
}
