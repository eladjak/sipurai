import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Moon, CalendarClock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";

/**
 * Shown when the server refuses a new book (monthly free limit, or the shared daily ceiling).
 * Calm and warm: this is a pause, not an error. Text arrives from the server, already in Hebrew.
 */
export default function QuotaLimitCard({ error, onBack }) {
  const monthly = error?.code === "monthly_limit";
  const Icon = monthly ? CalendarClock : Moon;
  return (
    <motion.div
      dir="rtl"
      role="status"
      aria-live="polite"
      className="mx-auto my-10 max-w-md rounded-3xl border border-amber-200 bg-amber-50/70 p-8 text-center shadow-sm"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
        <Icon className="h-8 w-8 text-amber-700" aria-hidden="true" />
      </div>
      <h2 className="mb-2 text-xl font-bold text-amber-950">
        {monthly ? "הספרים החינמיים של החודש נגמרו" : "היצירה נחה קצת"}
      </h2>
      <p className="mb-6 text-base leading-relaxed text-amber-900">{error?.message}</p>
      <div className="flex flex-col gap-3">
        {monthly && error?.canUpgrade && (
          <Button asChild className="min-h-[44px]">
            <Link to={createPageUrl("Pricing")}>
              <Sparkles className="ms-2 h-4 w-4" aria-hidden="true" />
              לראות את התוכניות
            </Link>
          </Button>
        )}
        <Button variant="outline" className="min-h-[44px]" onClick={onBack}>
          חזרה לספרייה
        </Button>
      </div>
    </motion.div>
  );
}
