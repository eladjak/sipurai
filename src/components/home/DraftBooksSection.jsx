import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useI18n } from "@/components/i18n/i18nProvider";
import { Clock, BookOpen, Play } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const DraftBooksSection = React.memo(function DraftBooksSection({ draftBooks }) {
  const { t, isRTL } = useI18n();

  if (!draftBooks || draftBooks.length === 0) {
    return null;
  }

  return (
    <section className="px-4 md:px-6 lg:px-8 pb-2" dir={isRTL ? "rtl" : "ltr"}>
      <h2 className={`text-xl font-bold mb-4 flex items-center gap-2 ${isRTL ? "flex-row-reverse justify-end" : ""}`}>
        <Clock className="h-5 w-5 text-orange-500" />
        {t("home.drafts.title")}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {draftBooks.map(book => (
          <Card
            key={book.id}
            className="overflow-hidden border-orange-200 dark:border-orange-900/40 bg-orange-50/50 dark:bg-orange-950/10"
          >
            <CardContent className={`p-4 flex items-center gap-4 ${isRTL ? "flex-row-reverse" : ""}`}>
              <div className="w-14 h-14 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                {book.cover_image ? (
                  <img
                    src={book.cover_image}
                    alt={book.title}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <BookOpen className="h-6 w-6 text-orange-400" />
                )}
              </div>
              <div className={`flex-1 min-w-0 ${isRTL ? "text-right" : "text-left"}`}>
                <h3 className="font-medium text-sm truncate">{book.title || t("homeLegacy.untitled")}</h3>
                <Badge variant="outline" className="text-xs mt-1 bg-orange-100 text-orange-700 border-orange-200">
                  {book.status === "generating"
                    ? t("home.drafts.status.generating")
                    : t("home.drafts.status.draft")}
                </Badge>
              </div>
              <Link to={`${createPageUrl("BookCreation")}?id=${book.id}`} className="flex-shrink-0">
                <Button size="sm" variant="outline" className={`border-orange-300 text-orange-700 hover:bg-orange-100 gap-1 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <Play className="h-3 w-3" />
                  {t("home.drafts.continue")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
});

export default DraftBooksSection;
