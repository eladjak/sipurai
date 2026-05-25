import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import LazyImage from "@/components/shared/LazyImage";
import {
  Card,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Eye,
  Clock,
  CheckCircle,
  RotateCw,
  Edit,
  MessageSquare,
  Share2,
  Copy,
  Loader2
} from "lucide-react";
import { motion } from "framer-motion";
import { useI18n } from "@/components/i18n/i18nProvider";

function BookCard({ book, viewType = "grid", onDuplicate }) {
  const { t, isRTL } = useI18n();
  const [isHovered, setIsHovered] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  const handleDuplicate = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onDuplicate || isDuplicating) return;
    setIsDuplicating(true);
    try {
      await onDuplicate(book);
    } finally {
      setIsDuplicating(false);
    }
  };
  
  const statusIcons = {
    draft: <Clock className="h-4 w-4 text-yellow-500" aria-hidden="true" />,
    generating: <RotateCw className="h-4 w-4 text-blue-500 animate-spin" aria-hidden="true" />,
    complete: <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />
  };

  const statusStyles = {
    draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800",
    generating: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    complete: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800"
  };

  const formatGenre = (genre) => {
    if (!genre) return '';
    const translated = t(`community.genreTags.${genre}`);
    return translated !== `community.genreTags.${genre}` ? translated : genre.replace(/_/g, ' ');
  };
  
  const statusLabels = {
    draft: t("bookCard.draft"),
    generating: t("bookCard.generating"),
    complete: t("bookCard.complete")
  };

  if (viewType === "grid") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        whileHover={{ scale: 1.02, y: -4 }}
        dir={isRTL ? "rtl" : "ltr"}
      >
        <Card
          className="overflow-hidden transition-all duration-200 shadow-md hover:shadow-2xl border-gray-200 dark:border-gray-800 hover:border-purple-300 dark:hover:border-purple-700"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <Link to={`${createPageUrl("BookView")}?id=${book.id}`}>
            <div className="aspect-[3/4] relative overflow-hidden bg-gradient-to-br from-purple-100 via-indigo-50 to-violet-100 dark:from-purple-950 dark:via-indigo-950 dark:to-gray-900">
              {book.cover_image ? (
                <>
                  <LazyImage
                    src={book.cover_image}
                    alt={book.title}
                    className="w-full h-full transition-transform duration-200 hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-purple-200 via-indigo-100 to-violet-200 dark:from-purple-900 dark:via-indigo-950 dark:to-violet-900">
                  <div className="rounded-full bg-white/60 dark:bg-gray-800/60 p-4 mb-3 shadow-inner">
                    <BookOpen className="h-12 w-12 text-purple-500 dark:text-purple-400" />
                  </div>
                  <p className="font-medium text-purple-700 dark:text-purple-300 text-sm">{book.title || "Untitled Book"}</p>
                </div>
              )}
              <Badge className={`absolute top-2 ${isRTL ? 'left-2' : 'right-2'} shadow-md ${statusStyles[book.status]}`}>
                <span className="flex items-center gap-1">
                  {statusIcons[book.status]}
                  {statusLabels[book.status]}
                </span>
              </Badge>
              
              {isHovered && (
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end justify-center p-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="w-full">
                    <p className="text-white font-bold truncate mb-1">{book.title}</p>
                    <p className="text-white/80 text-sm">{t("bookCard.for")} {book.child_name}</p>
                  </div>
                </motion.div>
              )}
            </div>
          </Link>
          <CardFooter className="p-4 flex-col items-start">
            <div className="space-y-1 mb-3 w-full">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                {book.title}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t("bookCard.for")} {book.child_name}, {book.child_age} {t("bookCard.years")}
              </p>
              <div className="flex flex-wrap gap-2 mt-1">
                <Badge variant="outline" className="text-xs border-purple-200 dark:border-purple-900 text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30">
                  {formatGenre(book.genre)}
                </Badge>
                {book.language && book.language !== "english" && (
                  <Badge variant="outline" className="text-xs border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30">
                    {t(`common.languageNames.${book.language}`) || book.language}
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 w-full">
              <Link to={`${createPageUrl("BookView")}?id=${book.id}`} className="flex-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1 hover:bg-purple-50 dark:hover:bg-purple-900/30 border-purple-200 dark:border-purple-900 hover:text-purple-700 dark:hover:text-purple-300"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>{t("bookCard.view")}</span>
                </Button>
              </Link>

              {book.status !== "generating" && (
                <Link to={`${createPageUrl("BookCreation")}?id=${book.id}`} className="flex-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-900 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    <span>{t("bookCard.edit")}</span>
                  </Button>
                </Link>
              )}

              {onDuplicate && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDuplicate}
                  disabled={isDuplicating}
                  className="gap-1 hover:bg-amber-50 dark:hover:bg-amber-900/30 border-amber-200 dark:border-amber-900 hover:text-amber-700 dark:hover:text-amber-300"
                  aria-label={t("bookCard.duplicate")}
                >
                  {isDuplicating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>
      </motion.div>
    );
  }
  
  // List view
  return (
    <motion.div
      initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      dir={isRTL ? "rtl" : "ltr"}
    >
      <Card className={`mb-4 overflow-hidden hover:shadow-md transition-all duration-200 border-gray-200 dark:border-gray-800 hover:border-purple-200 dark:hover:border-purple-800`}>
        <div className="flex flex-col sm:flex-row">
          <div className="sm:w-36 md:w-48 aspect-[4/3] overflow-hidden bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-gray-900">
            {book.cover_image ? (
              <LazyImage
                src={book.cover_image}
                alt={book.title}
                className="w-full h-full transition-transform duration-300 hover:scale-105"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <BookOpen className="h-12 w-12 text-purple-300 dark:text-purple-800" />
              </div>
            )}
          </div>
          
          <div className="flex-1 p-4">
            <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
              <div>
                <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                  {book.title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t("bookCard.for")} {book.child_name}, {book.child_age} {t("bookCard.years")}
                </p>
              </div>
              <Badge className={`${statusStyles[book.status]}`}>
                <span className="flex items-center gap-1">
                  {statusIcons[book.status]}
                  {statusLabels[book.status]}
                </span>
              </Badge>
            </div>
            
            <div className="flex flex-wrap gap-2 my-3">
              <Badge variant="outline" className="text-xs border-purple-200 dark:border-purple-900 text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30">
                {formatGenre(book.genre)}
              </Badge>
              {book.art_style && (
                <Badge variant="outline" className="text-xs border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30">
                  {book.art_style}
                </Badge>
              )}
              {book.language && book.language !== "english" && (
                <Badge variant="outline" className="text-xs border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30">
                  {t(`common.languageNames.${book.language}`) || book.language}
                </Badge>
              )}
            </div>
            
            <div className="flex flex-wrap gap-2 mt-4">
              <Link to={`${createPageUrl("BookView")}?id=${book.id}`}>
                <Button 
                  size="sm"
                  className="gap-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-sm hover:shadow transition-all duration-200"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>{t("bookCard.view")}</span>
                </Button>
              </Link>
              
              {book.status !== "generating" && (
                <Link to={`${createPageUrl("BookCreation")}?id=${book.id}`}>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="gap-1 border-purple-200 dark:border-purple-900 hover:bg-purple-50 dark:hover:bg-purple-900/30"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    <span>{t("bookCard.edit")}</span>
                  </Button>
                </Link>
              )}
              
              <Link to={`${createPageUrl("Feedback")}?id=${book.id}`}>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="gap-1 border-blue-200 dark:border-blue-900 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>{t("bookCard.feedback")}</span>
                </Button>
              </Link>
              
              {book.status === "complete" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 border-green-200 dark:border-green-900 hover:bg-green-50 dark:hover:bg-green-900/30"
                >
                  <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t("bookCard.share")}</span>
                </Button>
              )}

              {onDuplicate && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDuplicate}
                  disabled={isDuplicating}
                  className="gap-1 border-amber-200 dark:border-amber-900 hover:bg-amber-50 dark:hover:bg-amber-900/30"
                  aria-label={t("bookCard.duplicate")}
                >
                  {isDuplicating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>{t("bookCard.duplicate")}</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export default React.memo(BookCard);