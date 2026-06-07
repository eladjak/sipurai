
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Book } from "@/entities/Book";
import { Page } from "@/entities/Page";
import { useI18n } from "@/components/i18n/i18nProvider";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/components/ui/use-toast";
import {
  PlusCircle,
  Search,
  BookOpen,
  Filter,
  X,
  LayoutGrid,
  List,
  Sparkles,
  Wand2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import BookCard from "../components/library/BookCard";
import EmptyState from "../components/library/EmptyState";

export default function Library() {
  const { t, isRTL } = useI18n();
  const { toast } = useToast();
  const { user: hookUser } = useCurrentUser();
  const [books, setBooks] = useState([]);
  const [filteredBooks, setFilteredBooks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState({
    status: "all",
    genre: "all",
    age_range: "all",
    language: "all"
  });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadBooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hookUser]);

  useEffect(() => {
    filterBooks();
  }, [books, searchQuery, filters]);

  const loadBooks = async () => {
    try {
      setIsLoading(true);
      if (hookUser?.id) {
        const loadedBooks = await Book.filter({ created_by: hookUser.id });
        setBooks(loadedBooks);
      }
    } catch (error) {
      setLoadError(true);
      toast({ variant: "destructive", description: t("common.loadError") });
    } finally {
      setIsLoading(false);
    }
  };

  const filterBooks = () => {
    let results = [...books];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      results = results.filter(book =>
        (book.title || '').toLowerCase().includes(query) ||
        (book.child_name || '').toLowerCase().includes(query)
      );
    }

    if (filters.status !== "all") {
      results = results.filter(book => book.status === filters.status);
    }
    if (filters.genre !== "all") {
      results = results.filter(book => book.genre === filters.genre);
    }
    if (filters.age_range !== "all") {
      results = results.filter(book => book.age_range === filters.age_range);
    }
    if (filters.language !== "all") {
      results = results.filter(book => book.language === filters.language);
    }

    setFilteredBooks(results);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({ status: "all", genre: "all", age_range: "all", language: "all" });
    setSearchQuery("");
  };

  const duplicateBook = async (book) => {
    try {
      const { id, created_date, created_by, ...bookFields } = book;
      const newBook = await Book.create({
        ...bookFields,
        title: `${book.title} (${t("library.copy")})`,
        status: "complete",
      });

      try {
        const pages = await Page.filter({ book_id: book.id });
        if (pages.length > 0) {
          await Promise.all(
            pages.map((page) => {
              const { id: pageId, created_date: pageCreated, created_by: pageOwner, ...pageFields } = page;
              return Page.create({ ...pageFields, book_id: newBook.id });
            })
          );
        }
      } catch {
        // Page duplication is best-effort
      }

      toast({
        title: t("library.duplicated"),
        description: t("library.duplicatedDesc", { title: newBook.title }),
        className: "bg-green-100 text-green-900 dark:bg-green-900/50 dark:text-green-100",
      });

      await loadBooks();
    } catch {
      toast({
        variant: "destructive",
        title: t("library.duplicateError"),
      });
    }
  };

  const genreOptions = [
    { value: "all", label: t("library.allGenres") },
    { value: "adventure", label: t("library.genreOptions.adventure") },
    { value: "fairy_tale", label: t("library.genreOptions.fairy_tale") },
    { value: "educational", label: t("library.genreOptions.educational") },
    { value: "bedtime", label: t("library.genreOptions.bedtime") },
    { value: "fantasy", label: t("library.genreOptions.fantasy") },
    { value: "science", label: t("library.genreOptions.science") },
    { value: "animals", label: t("library.genreOptions.animals") },
    { value: "sports", label: t("library.genreOptions.sports") }
  ];

  const ageRangeOptions = [
    { value: "all", label: t("library.allAges") },
    { value: "2-4", label: t("library.ageRangeOptions.years_2_4") },
    { value: "5-7", label: t("library.ageRangeOptions.years_5_7") },
    { value: "8-10", label: t("library.ageRangeOptions.years_8_10") },
    { value: "11+", label: t("library.ageRangeOptions.years_11plus") }
  ];

  const languageOptions = [
    { value: "all", label: t("library.allLanguages") },
    { value: "english", label: t("library.languageOptions.english") },
    { value: "hebrew", label: t("library.languageOptions.hebrew") },
    { value: "yiddish", label: t("library.languageOptions.yiddish") }
  ];

  const hasActiveFilters = filters.status !== "all" || filters.genre !== "all" ||
    filters.age_range !== "all" || filters.language !== "all";

  return (
    <div className="max-w-6xl mx-auto pb-12" dir={isRTL ? "rtl" : "ltr"}>
      {/* Gradient header banner */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative mb-8 rounded-2xl overflow-hidden shadow-xl"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-indigo-600 to-violet-700" />
        <div className="absolute inset-0 bg-[url('/images/empty-library.jpg')] bg-cover bg-center opacity-10" />
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
        <Sparkles className="absolute top-5 left-8 h-5 w-5 text-white/20" />
        <Sparkles className="absolute bottom-5 right-12 h-4 w-4 text-white/15" />

        <div className={`relative flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 md:p-8 ${isRTL ? "md:flex-row-reverse" : ""}`}>
          <div className={isRTL ? "text-right" : "text-left"}>
            <h1 className="text-3xl font-bold text-white drop-shadow-sm">{t("library.title")}</h1>
            <p className="text-purple-100 mt-1 flex items-center gap-2">
              {t("library.subtitle")}
              {books.length > 0 && (
                <Badge className="bg-white/20 text-white border-white/30 text-sm">
                  {books.length}
                </Badge>
              )}
            </p>
          </div>
          <Link to={createPageUrl("BookWizard")}>
            <Button className="relative bg-white text-purple-700 hover:bg-purple-50 shadow-lg rounded-2xl px-5 gap-2 overflow-hidden group">
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-100/50 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <PlusCircle className="relative h-4 w-4" />
              <span className="relative">{t("library.createNewBook")}</span>
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Search + filter bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="mb-6 space-y-3"
      >
        <div className={`flex flex-col sm:flex-row gap-3 ${isRTL ? "sm:flex-row-reverse" : ""}`}>
          <div className="relative flex-1">
            <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-purple-400 h-4 w-4`} />
            <Input
              placeholder={t("library.search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label={t("library.search")}
              className={`${isRTL ? 'pr-10' : 'pl-10'} rounded-2xl border-purple-200 dark:border-purple-800 focus:border-purple-500 focus:ring-purple-500/20 dark:bg-gray-800 dark:text-white h-11`}
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className={`absolute ${isRTL ? 'left-1' : 'right-1'} top-1/2 -translate-y-1/2 h-7 w-7 text-gray-400 hover:text-purple-600`}
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Button
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            aria-controls="filter-panel"
            className={`rounded-2xl gap-2 ${
              showFilters || hasActiveFilters
                ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/20"
                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-purple-200 dark:border-purple-800 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20"
            }`}
          >
            <Filter className="h-4 w-4" />
            {t("library.filters")}
            {hasActiveFilters && (
              <Badge className="ms-1 bg-white/20 text-white border-0 text-xs px-1.5">
                {t("library.active")}
              </Badge>
            )}
          </Button>
        </div>

        {/* Filter panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              id="filter-panel"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <Card className="border border-purple-100 dark:border-purple-900 shadow-md rounded-2xl bg-purple-50/50 dark:bg-purple-900/10">
                <CardHeader className="pb-2 pt-4 px-5">
                  <div className={`flex justify-between items-center ${isRTL ? "flex-row-reverse" : ""}`}>
                    <CardTitle className="text-base text-gray-800 dark:text-white">{t("library.filters")}</CardTitle>
                    <Button variant="ghost" size="sm" onClick={resetFilters} className="text-purple-600 hover:text-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/30 text-sm">
                      {t("library.reset")}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { key: "status", label: t("library.status"), options: [
                        { value: "all", label: t("library.allStatus") },
                        { value: "draft", label: t("library.draft") },
                        { value: "generating", label: t("library.generating") },
                        { value: "complete", label: t("library.complete") },
                      ]},
                      { key: "genre", label: t("library.genre"), options: genreOptions },
                      { key: "age_range", label: t("library.ageRange"), options: ageRangeOptions },
                      { key: "language", label: t("library.language"), options: languageOptions },
                    ].map(({ key, label, options }) => (
                      <div key={key} className="space-y-1.5">
                        <label className={`text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide ${isRTL ? "text-right block" : ""}`}>{label}</label>
                        <Select value={filters[key]} onValueChange={(value) => handleFilterChange(key, value)}>
                          <SelectTrigger className="rounded-xl border-purple-200 dark:border-purple-800 dark:bg-gray-800 focus:ring-purple-500/20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                            {options.map(option => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* View toggle + count */}
      <Tabs defaultValue="grid" className="space-y-4">
        <div className={`flex justify-between items-center ${isRTL ? "flex-row-reverse" : ""}`}>
          <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            <span className="text-purple-600 dark:text-purple-400 font-bold">{filteredBooks.length}</span>
            {" "}{filteredBooks.length === 1 ? t("library.bookFound") : t("library.booksFound")}
          </div>
          {/* Pill-style grid/list toggle */}
          <TabsList className="bg-purple-100 dark:bg-purple-900/30 p-1 rounded-2xl gap-1">
            <TabsTrigger
              value="grid"
              className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md p-2"
              aria-label="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger
              value="list"
              className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md p-2"
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="grid" className="mt-0">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5" aria-busy="true" aria-label={t("common.loading") || "Loading books..."}>
              {Array(8).fill(0).map((_, index) => (
                <Card key={index} className="overflow-hidden border-0 shadow-md rounded-2xl" aria-hidden="true">
                  <div className="aspect-[3/4] bg-gray-100 dark:bg-gray-800">
                    <Skeleton className="h-full w-full" />
                  </div>
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </Card>
              ))}
            </div>
          ) : filteredBooks.length > 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5"
            >
              {filteredBooks.map((book, index) => (
                <motion.div
                  key={book.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.4) }}
                >
                  <BookCard book={book} viewType="grid" onDuplicate={duplicateBook} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/10 dark:to-indigo-900/10 rounded-2xl" />
              <div className="relative">
                <EmptyState
                  title={t("library.noBooks")}
                  description={searchQuery || hasActiveFilters
                    ? t("library.adjustFilters")
                    : t("library.createFirst")
                  }
                  icon={
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/40 dark:to-indigo-900/40 flex items-center justify-center mx-auto">
                      <BookOpen className="h-10 w-10 text-purple-400" />
                    </div>
                  }
                  actionLabel={t("library.createBook")}
                  actionLink={createPageUrl("BookWizard")}
                />
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="list" className="mt-0">
          {isLoading ? (
            <div className="space-y-3">
              {Array(8).fill(0).map((_, index) => (
                <Card key={index} className="overflow-hidden border-0 shadow-md rounded-2xl">
                  <div className="flex items-center gap-4 p-4">
                    <Skeleton className="h-16 w-12 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-4 w-1/4" />
                    </div>
                    <Skeleton className="h-8 w-24 rounded-xl" />
                  </div>
                </Card>
              ))}
            </div>
          ) : filteredBooks.length > 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3"
            >
              {filteredBooks.map((book, index) => (
                <motion.div
                  key={book.id}
                  initial={{ opacity: 0, x: isRTL ? 10 : -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.4) }}
                >
                  <BookCard book={book} viewType="list" onDuplicate={duplicateBook} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <EmptyState
              title={t("library.noBooks")}
              description={searchQuery || hasActiveFilters
                ? t("library.adjustFilters")
                : t("library.createFirst")
              }
              icon={<BookOpen className="h-12 w-12 text-gray-400" />}
              actionLabel={t("library.createBook")}
              actionLink={createPageUrl("BookWizard")}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
