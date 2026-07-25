import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useI18n } from "@/components/i18n/i18nProvider";
import { BookOpen, Play, PenTool, Wand2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

function translateGenre(genre, t) {
  const translated = t(`community.genreTags.${genre}`);
  return translated !== `community.genreTags.${genre}` ? translated : genre;
}

function BookCardItem({ book, isRTL, t, index = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07 }}
    >
      <Card className="overflow-hidden hover:shadow-2xl transition-all duration-300 h-full group border-0 shadow-md">
        <div className="aspect-square bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 relative overflow-hidden">
          {book.cover_image ? (
            <img
              src={book.cover_image}
              alt={book.title}
              className="w-full h-full object-cover group-hover:scale-105 group-focus-within:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="h-16 w-16 text-purple-300" />
            </div>
          )}
          {/* Gradient overlay on cover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>
        <CardContent className={`p-4 ${isRTL ? "text-right" : "text-left"}`}>
          <h3 className="font-bold text-base mb-1 line-clamp-1">{book.title}</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-3 line-clamp-2">{book.description}</p>

          <div className={`flex items-center justify-between mt-auto ${isRTL ? "flex-row-reverse" : ""}`}>
            <div className={`flex gap-1.5 flex-wrap ${isRTL ? "flex-row-reverse" : ""}`}>
              {book.genre && (
                <Badge className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-0 capitalize">
                  {translateGenre(book.genre, t)}
                </Badge>
              )}
              {book.age_range && (
                <Badge className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border-0">
                  {book.age_range}
                </Badge>
              )}
            </div>

            {book.isSample ? (
              <Link to={createPageUrl("BookWizard")}>
                <Button size="sm" className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-0 hover:from-purple-700 hover:to-indigo-700 gap-1">
                  <Wand2 className="h-3.5 w-3.5" />
                  {t("home.create.button")}
                </Button>
              </Link>
            ) : (
              <Link to={`${createPageUrl("BookView")}?id=${book.id}`}>
                <Button size="sm" className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-0 hover:from-purple-700 hover:to-indigo-700 gap-1">
                  <Play className="h-3.5 w-3.5" />
                  {t("home.book.read")}
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

const FeaturedBooksSection = React.memo(function FeaturedBooksSection({ featuredBooks, recentBooks, isLoading }) {
  const { isRTL, t } = useI18n();
  const [activeTab, setActiveTab] = useState("featured");

  return (
    <section className="p-4 md:p-6 lg:p-8">
      <Tabs defaultValue="featured" onValueChange={setActiveTab}>
        <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 ${isRTL ? "sm:flex-row-reverse" : ""}`}>
          <h2 className="text-2xl font-bold">
            {activeTab === "featured" ? t("home.tabs.featured") : t("home.tabs.recent")}
          </h2>
          <TabsList className="bg-purple-100 dark:bg-purple-900/30 p-1 rounded-2xl gap-1">
            <TabsTrigger
              value="featured"
              className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md px-4"
            >
              {t("home.tabs.featured")}
            </TabsTrigger>
            <TabsTrigger
              value="recent"
              className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md px-4"
            >
              {t("home.tabs.recent")}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="featured">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {isLoading ? (
              Array(3).fill(0).map((_, index) => (
                <Card key={index} className="overflow-hidden border-0 shadow-md" aria-hidden="true">
                  <Skeleton className="aspect-square w-full" />
                  <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <div className="flex justify-between items-center pt-1">
                      <div className="flex gap-2">
                        <Skeleton className="h-5 w-20 rounded-full" />
                        <Skeleton className="h-5 w-14 rounded-full" />
                      </div>
                      <Skeleton className="h-8 w-24 rounded-xl" />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : featuredBooks.map((book, index) => (
              <BookCardItem key={book.id} book={book} isRTL={isRTL} t={t} index={index} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="recent">
          {recentBooks.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {recentBooks.map((book, index) => (
                <motion.div
                  key={book.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: index * 0.07 }}
                >
                  <Card className="overflow-hidden hover:shadow-2xl transition-all duration-300 h-full group border-0 shadow-md">
                    <div className="aspect-[4/3] bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 relative overflow-hidden">
                      {book.cover_image ? (
                        <img
                          src={book.cover_image}
                          alt={book.title}
                          className="w-full h-full object-cover group-hover:scale-105 group-focus-within:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BookOpen className="h-16 w-16 text-purple-300" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                    <CardContent className={`p-4 ${isRTL ? "text-right" : "text-left"}`}>
                      <h3 className="font-bold text-base mb-2">{book.title}</h3>
                      <div className={`flex justify-between items-start mb-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                        <div className="flex gap-1.5">
                          {book.genre && (
                            <Badge className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-0 capitalize">
                              {translateGenre(book.genre, t)}
                            </Badge>
                          )}
                        </div>
                        <Badge className="text-xs bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 border-0">
                          {book.updated_date && new Date(book.updated_date).toLocaleDateString()}
                        </Badge>
                      </div>

                      <div className={`flex justify-between mt-auto gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                        <Link to={`${createPageUrl("BookView")}?id=${book.id}`}>
                          <Button size="sm" className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-0 hover:from-purple-700 hover:to-indigo-700 gap-1">
                            <Play className="h-3.5 w-3.5" />
                            {t("home.book.continue")}
                          </Button>
                        </Link>

                        <Link to={`${createPageUrl("BookCreation")}?id=${book.id}`}>
                          <Button size="sm" variant="outline" className="border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 gap-1">
                            <PenTool className="h-3.5 w-3.5" />
                            {t("home.book.edit")}
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <Card className="border-2 border-dashed border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10">
              <CardContent className="p-8 md:p-12 text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/40 dark:to-indigo-900/40 flex items-center justify-center">
                  <BookOpen className="h-10 w-10 text-purple-400" />
                </div>
                <h3 className="text-xl font-bold mb-2">{t("home.noBooks.title")}</h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  {t("home.noBooks.subtitle")}
                </p>
                <Link to={createPageUrl("BookWizard")}>
                  <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white gap-2 px-6">
                    <Wand2 className="h-4 w-4" />
                    {t("home.create.button")}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
});

export default FeaturedBooksSection;
