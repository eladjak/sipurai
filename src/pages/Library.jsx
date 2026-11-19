
import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Book } from "@/entities/Book";
import { Page } from "@/entities/Page";
import { readablePages } from "@/lib/bookProgress";
import { useI18n } from "@/components/i18n/i18nProvider";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useToast } from "@/components/ui/use-toast";
import {
  PlusCircle,
  Search,
  Filter,
  X,
  LayoutGrid,
  List,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import BookCard from "../components/library/BookCard";
import EmptyState from "../components/library/EmptyState";

export default function Library() {
  const { t, isRTL } = useI18n();
  const { toast } = useToast();
  const { user: hookUser } = useCurrentUser();
  const ownerId = hookUser?.id;
  const owner = useRef(ownerId);
  owner.current = ownerId;
  const request = useRef(0);
  const [snapshot, setSnapshot] = useState({ owner: null, books: [], error: false });
  const [loading, setLoading] = useState(true);
  const bookOwnerMatches = snapshot.owner === ownerId;
  const books = bookOwnerMatches ? snapshot.books : [];
  const isLoading = loading || (Boolean(ownerId) && !bookOwnerMatches);
  const loadError = bookOwnerMatches && snapshot.error;
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
    return () => { request.current += 1; };
  }, [ownerId]);

  const loadBooks = async () => {
    if (owner.current !== ownerId) return;
    const active = ++request.current;
    if (!ownerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const found = await Book.filter({ created_by: ownerId });
      if (request.current === active && owner.current === ownerId) {
        setSnapshot({ owner: ownerId, books: Array.isArray(found) ? found : [], error: false });
      }
    } catch {
      if (request.current === active && owner.current === ownerId) {
        setSnapshot({ owner: ownerId, books: [], error: true });
      }
    } finally {
      if (request.current === active && owner.current === ownerId) setLoading(false);
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

    return results;
  };

  const filteredBooks = filterBooks();

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

      // Only pages that have words. A half-built book can be duplicated, but
      // its skeleton rows are a work queue, not content — copying them would
      // give the new book blank pages and no run that will ever fill them.
      // Read them BEFORE creating the copy so `total_pages` describes what the
      // copy will actually contain; a copy claiming ten pages while holding
      // three would present itself as interrupted forever.
      let pages = [];
      try {
        pages = readablePages(await Page.filter({ book_id: book.id }));
      } catch {
        pages = [];
      }

      const newBook = await Book.create({
        ...bookFields,
        title: `${book.title} (${t("library.copy")})`,
        status: "complete",
        total_pages: pages.length,
      });

      try {
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

  const hasQuery = Boolean(searchQuery || hasActiveFilters);
  const clearQuery = () => {
    setSearchQuery("");
    resetFilters();
  };
  const bookState = isLoading ? (
    <EmptyState title={t("shelf.loading")} status="status" />
  ) : loadError ? (
    <EmptyState title={t("shelf.errorTitle")} description={t("shelf.error")} status="alert"
      actionLabel={t("shelf.retry")} onAction={loadBooks} />
  ) : hasQuery ? (
    <EmptyState title={t("shelf.noMatchesTitle")} description={t("library.adjustFilters")}
      actionLabel={t("shelf.clearFilters")} onAction={clearQuery} />
  ) : (
    <EmptyState title={t("library.noBooks")} description={t("library.createFirst")}
      actionLabel={t("library.createBook")} actionLink={createPageUrl("BookWizard")} />
  );

  return (
    <div className="sp-shell max-w-6xl mx-auto pb-12" dir={isRTL ? "rtl" : "ltr"}>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 px-1 pt-2">
        <div>
          <h1 className="font-sp-display text-3xl font-semibold text-gray-950 dark:text-white">{t("library.title")}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-gray-600 dark:text-gray-300">
            <p>{t("library.subtitle")}</p>
            {books.length > 0 && <Badge variant="secondary" className=""><bdi dir="ltr">{books.length}</bdi></Badge>}
          </div>
        </div>
        <Button asChild className="min-h-11 rounded-xl bg-purple-700 text-white hover:bg-purple-800">
          <Link to={createPageUrl("BookWizard")}><PlusCircle aria-hidden="true" />{t("library.createNewBook")}</Link>
        </Button>
      </header>

      {/* Search + filter bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="mb-6 space-y-3"
      >
        <div className={`flex flex-col sm:flex-row gap-3 ${isRTL ? "sm:flex-row-reverse" : ""}`}>
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-purple-400 h-4 w-4" />
            <Input
              placeholder={t("library.search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label={t("library.search")}
              className="ps-10 rounded-2xl border-purple-200 dark:border-purple-800 focus:border-purple-500 focus:ring-purple-500/20 dark:bg-gray-800 dark:text-white h-11"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute end-1 top-1/2 -translate-y-1/2 h-7 w-7 text-gray-400 hover:text-purple-600"
                onClick={() => setSearchQuery("")}
                aria-label={t("libraryLegacy.clearSearch")}
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
                  <div className="flex justify-between items-center">
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
                        { value: "partial", label: t("library.partial") },
                        { value: "failed", label: t("library.failed") },
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
      <Tabs defaultValue="grid" dir={isRTL ? "rtl" : "ltr"} className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-500 dark:text-gray-400 font-medium" aria-live="polite">
            {!isLoading && !loadError && <>
              <bdi dir="ltr" className="font-bold text-purple-700 dark:text-purple-300">{filteredBooks.length}</bdi>
              {" "}{filteredBooks.length === 1 ? t("library.bookFound") : t("library.booksFound")}
            </>}
          </div>
          {/* Pill-style grid/list toggle */}
          <TabsList className="bg-purple-100 dark:bg-purple-900/30 p-1 rounded-2xl gap-1">
            <TabsTrigger
              value="grid"
              className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md p-2"
              aria-label={t("libraryLegacy.gridView")}
            >
              <LayoutGrid className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger
              value="list"
              className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md p-2"
              aria-label={t("libraryLegacy.listView")}
            >
              <List className="h-4 w-4" />
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="grid" className="mt-0">
          {!isLoading && !loadError && filteredBooks.length > 0 ? (
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
                  <BookCard book={book} viewType="grid" onDuplicate={duplicateBook} onChanged={loadBooks} />
                </motion.div>
              ))}
            </motion.div>
          ) : bookState}
        </TabsContent>

        <TabsContent value="list" className="mt-0">
          {!isLoading && !loadError && filteredBooks.length > 0 ? (
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
                  <BookCard book={book} viewType="list" onDuplicate={duplicateBook} onChanged={loadBooks} />
                </motion.div>
              ))}
            </motion.div>
          ) : bookState}
        </TabsContent>
      </Tabs>
    </div>
  );
}
