import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/components/i18n/i18nProvider";
import { Community } from "@/entities/Community";
import { Book } from "@/entities/Book";
import { User } from "@/entities/User";
import { Comment } from "@/entities/Comment";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import useGamification from "@/hooks/useGamification";
import { captureError } from "@/lib/errorTracking";
import { verifyParentalPin, isPinSet } from "@/utils/content-moderation";
import {
  Search,
  Filter,
  Award,
  Heart,
  MessageSquare,
  Users,
  Tag,
  BookOpen,
  Star,
  ChevronDown,
  X,
  Sparkles,
  Lock,
  Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import CommunityPost from "../components/community/CommunityPost";
import FeaturedStory from "../components/community/FeaturedStory";
import ShareBookModal from "../components/community/ShareBookModal";

export default function CommunityPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const gamification = useGamification();
  const { user: hookUser } = useCurrentUser();
  const [posts, setPosts] = useState([]);
  const [featuredPosts, setFeaturedPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentTab, setCurrentTab] = useState("all");
  const [currentFilter, setCurrentFilter] = useState("recent");
  const [selectedTags, setSelectedTags] = useState([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [likedPostsKey, setLikedPostsKey] = useState("likedPosts_anonymous");
  const [likedPosts, setLikedPosts] = useState([]);
  const { t, isRTL } = useI18n();

  // For pagination
  const [page, setPage] = useState(1);
  const postsPerPage = 10;

  // Parental PIN approval state
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [pendingShareData, setPendingShareData] = useState(null);

  // Batch enhance posts to avoid N+1 queries
  const batchEnhancePosts = async (posts) => {
    if (posts.length === 0) return [];

    const bookIds = [...new Set(posts.map(p => p.book_id).filter(Boolean))];
    const userIds = [...new Set(posts.map(p => p.user_id).filter(Boolean))];

    const [books, users, allComments] = await Promise.all([
      Promise.all(bookIds.map(id => Book.get(id).catch(() => null))),
      Promise.all(userIds.map(id => User.get(id).catch(() => null))),
      Promise.all(posts.map(p => Comment.filter({ community_id: p.id }).catch(() => [])))
    ]);

    const bookMap = {};
    books.forEach(b => { if (b) bookMap[b.id] = b; });
    const userMap = {};
    users.forEach(u => { if (u) userMap[u.id] = u; });

    return posts.map((post, i) => ({
      ...post,
      book: bookMap[post.book_id] || null,
      user: userMap[post.user_id] || null,
      commentCount: allComments[i]?.length || 0
    }));
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadFilteredPosts();
  }, [searchQuery, currentTab, currentFilter, selectedTags, page]);

  const loadInitialData = async () => {
    try {
      setIsLoading(true);

      if (hookUser) {
        setCurrentUser(hookUser);
        const userId = hookUser?.id || hookUser?.email;
        if (userId) {
          const key = `liked_posts_${userId}`;
          setLikedPostsKey(key);
          try {
            setLikedPosts(JSON.parse(localStorage.getItem(key) || "[]"));
          } catch {
            setLikedPosts([]);
          }
        }
      }

      const featured = await Community.filter({ is_featured: true }, "-featured_date", 3);
      const enhancedFeatured = await batchEnhancePosts(featured);
      setFeaturedPosts(enhancedFeatured);

      await loadFilteredPosts();
    } catch (error) {
      captureError(error, { context: 'Community.loadInitialData' });
      toast({
        variant: "destructive",
        description: t("community.toast.loadError"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadFilteredPosts = async () => {
    try {
      setIsLoading(true);

      let filter = { visibility: "public" };

      if (currentTab === "my-posts" && currentUser) {
        filter.user_id = currentUser.id;
      }

      let sortOrder = "-created_date";
      if (currentFilter === "popular") {
        sortOrder = "-likes";
      }

      const filteredPosts = await Community.filter(filter, sortOrder, postsPerPage, (page - 1) * postsPerPage);
      const enhancedPosts = await batchEnhancePosts(filteredPosts);

      let searchResults = enhancedPosts;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        searchResults = enhancedPosts.filter(post =>
          post.title.toLowerCase().includes(query) ||
          post.description.toLowerCase().includes(query) ||
          post.book?.title.toLowerCase().includes(query) ||
          post.user?.full_name.toLowerCase().includes(query)
        );
      }

      if (selectedTags.length > 0) {
        searchResults = searchResults.filter(post =>
          post.tags && post.tags.some(tag => selectedTags.includes(tag))
        );
      }

      setPosts(searchResults);
    } catch (error) {
      captureError(error, { context: 'Community.loadFilteredPosts' });
      toast({
        variant: "destructive",
        description: t("community.toast.postsError"),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTagSelect = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
    setPage(1);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedTags([]);
    setCurrentFilter("recent");
    setPage(1);
  };

  const handleLikePost = async (postId) => {
    try {
      const postIndex = posts.findIndex(p => p.id === postId);
      if (postIndex === -1) return;

      const alreadyLiked = likedPosts.includes(postId);

      const freshPost = await Community.get(postId);
      const currentLikes = (freshPost?.likes ?? posts[postIndex].likes) || 0;

      const newLikeCount = alreadyLiked
        ? Math.max(0, currentLikes - 1)
        : currentLikes + 1;

      await Community.update(postId, { likes: newLikeCount });

      const newLikedPosts = alreadyLiked
        ? likedPosts.filter(id => id !== postId)
        : [...likedPosts, postId];
      setLikedPosts(newLikedPosts);
      localStorage.setItem(likedPostsKey, JSON.stringify(newLikedPosts));

      const applyUpdate = (list) =>
        list.map(p => p.id === postId ? { ...p, likes: newLikeCount } : p);
      setPosts(applyUpdate);
      setFeaturedPosts(applyUpdate);

      toast({
        description: alreadyLiked ? t("community.toast.likeRemoved") : t("community.toast.likeAdded"),
      });
    } catch (error) {
      captureError(error, { context: 'Community.handleLikePost', postId });
      toast({
        variant: "destructive",
        description: t("community.toast.likeError"),
      });
    }
  };

  const doShareBook = async (bookData) => {
    try {
      const postData = {
        book_id: bookData.bookId,
        user_id: currentUser.id,
        title: bookData.title,
        description: bookData.description,
        tags: bookData.tags,
        visibility: "public",
        likes: 0,
      };

      await Community.create(postData);

      // Mark the book public so its direct link is readable by anon visitors.
      // books.is_public is the source of truth for sharing (owner-only update).
      if (bookData.bookId) {
        try { await Book.update(bookData.bookId, { is_public: true }); } catch { /* non-fatal */ }
      }

      gamification.awardXP("community_share");
      gamification.incrementStat("totalShares");

      await loadFilteredPosts();

      setShowShareModal(false);

      toast({
        description: t("community.toast.shareSuccess"),
      });
    } catch (error) {
      captureError(error, { context: 'Community.doShareBook' });
      toast({
        variant: "destructive",
        description: t("community.toast.shareError"),
      });
    }
  };

  const handleShareBook = async (bookData) => {
    let controls = {};
    try {
      controls = JSON.parse(localStorage.getItem("parentalControls") || "{}");
    } catch {
      controls = {};
    }

    const requireApproval = controls.requireApprovalBeforePublish ?? true;

    if (requireApproval && isPinSet()) {
      setPendingShareData(bookData);
      setPinInput("");
      setPinError("");
      setShowPinDialog(true);
    } else {
      await doShareBook(bookData);
    }
  };

  const handlePinSubmit = async () => {
    const ok = await verifyParentalPin(pinInput);
    if (ok) {
      setShowPinDialog(false);
      setPinError("");
      if (pendingShareData) {
        await doShareBook(pendingShareData);
        setPendingShareData(null);
      }
    } else {
      setPinError(t("community.incorrectPin"));
    }
  };

  const popularTags = [
    "adventure", "fantasy", "education", "animals", "family",
    "friendship", "science", "magic", "nature", "values"
  ];

  const getTagDisplay = (tag) => {
    return t(`community.genreTags.${tag}`) || tag;
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  };

  return (
    <div className="max-w-6xl mx-auto" dir={isRTL ? "rtl" : "ltr"}>
      {/* Hero gradient banner */}
      <motion.div
        className="relative mb-8 rounded-2xl overflow-hidden shadow-xl"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 p-7 md:p-10">
          <div className="absolute inset-0 bg-[url('/images/community-sharing.jpg')] bg-cover bg-center opacity-15" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgba(255,255,255,0.12)_0%,transparent_70%)]" />

          {/* Community stats row */}
          <div className={`relative flex flex-wrap gap-3 mb-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
            {[
              { icon: Globe, label: t("community.sharedBooks"), value: String(posts.length) },
              { icon: Users, label: t("community.activeAuthors"), value: String(new Set(posts.map(p => p.user_id)).size) },
            ].map((stat, i) => (
              <motion.div
                key={i}
                className={`flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 border border-white/20 ${isRTL ? 'flex-row-reverse' : ''}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + i * 0.1 }}
              >
                <stat.icon className="h-4 w-4 text-white/80" />
                <span className="text-white/90 text-sm font-medium">{stat.value} {stat.label}</span>
              </motion.div>
            ))}
          </div>

          <div className={`relative flex flex-col md:flex-row md:items-end justify-between gap-4 ${isRTL ? 'md:flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : ''}>
              <h1 className="text-3xl md:text-4xl font-bold text-white drop-shadow-sm">
                {t("community.title")}
              </h1>
              <p className="text-purple-100 mt-2 text-lg max-w-xl">
                {t("community.subtitle")}
              </p>
            </div>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Button
                onClick={() => setShowShareModal(true)}
                className="bg-white text-purple-700 hover:bg-purple-50 shadow-lg font-semibold px-6 py-2.5 rounded-2xl gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {t("community.shareYourBook")}
              </Button>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Featured Stories Section */}
      {featuredPosts.length > 0 && (
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <div className={`flex items-center mb-4 gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Sparkles className="h-5 w-5 text-amber-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {t("community.featuredStories")}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {isLoading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="flex-1">
                  <Skeleton className="w-full aspect-[3/2] rounded-2xl" />
                  <div className="mt-3 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              ))
            ) : (
              featuredPosts.map((post, i) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="relative rounded-2xl overflow-hidden border-2 border-transparent
                    hover:border-purple-300 dark:hover:border-purple-700
                    shadow-md hover:shadow-xl transition-all duration-200
                    bg-gradient-to-br from-white to-purple-50/40 dark:from-gray-800 dark:to-purple-900/10"
                  style={{
                    backgroundImage: "linear-gradient(white, white), linear-gradient(135deg, #a78bfa, #818cf8)",
                    backgroundOrigin: "border-box",
                    backgroundClip: "padding-box, border-box"
                  }}
                >
                  <FeaturedStory
                    post={post}
                    onLike={() => handleLikePost(post.id)}
                    isLiked={likedPosts.includes(post.id)}
                  />
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      )}

      {/* Main Content */}
      <motion.div
        className="space-y-5"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Search and Sort */}
        <motion.div variants={itemVariants} className={`flex flex-col md:flex-row gap-3 ${isRTL ? 'md:flex-row-reverse' : ''}`}>
          <div className="relative flex-1">
            <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none`} />
            <Input
              placeholder={t("community.search")}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className={`${isRTL ? 'pr-9' : 'pl-9'} rounded-2xl border-purple-100 dark:border-purple-900/30
                focus:ring-2 focus:ring-purple-400/40 focus:border-purple-400 dark:focus:border-purple-500 h-11`}
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className={`absolute ${isRTL ? 'left-1' : 'right-1'} top-1/2 -translate-y-1/2 h-7 w-7`}
                onClick={() => setSearchQuery("")}
                aria-label={t("community.clearFilters")}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex gap-2 rounded-2xl border-purple-100 dark:border-purple-900/30 h-11">
                <Filter className="h-4 w-4 text-purple-500" />
                {currentFilter === "recent" ? t("community.mostRecent") : t("community.mostPopular")}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isRTL ? "start" : "end"} className="rounded-xl">
              <DropdownMenuItem onClick={() => setCurrentFilter("recent")}>
                {t("community.mostRecent")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCurrentFilter("popular")}>
                {t("community.mostPopular")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </motion.div>

        {/* Tag Pills */}
        <motion.div variants={itemVariants} className="flex flex-wrap gap-2">
          {popularTags.map(tag => (
            <motion.button
              key={tag}
              onClick={() => handleTagSelect(tag)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium
                transition-all duration-150 cursor-pointer border
                ${selectedTags.includes(tag)
                  ? "bg-gradient-to-r from-purple-500 to-indigo-500 text-white border-transparent shadow-md shadow-purple-200 dark:shadow-purple-900/30"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-purple-100 dark:border-purple-900/30 hover:border-purple-300 dark:hover:border-purple-700"
                }`}
            >
              <Tag className="h-3 w-3" />
              {getTagDisplay(tag)}
            </motion.button>
          ))}

          {(selectedTags.length > 0 || searchQuery || currentFilter !== "recent") && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm
                text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <X className="h-3 w-3" />
              {t("community.clearFilters")}
            </button>
          )}
        </motion.div>

        {/* Tabs */}
        <motion.div variants={itemVariants}>
          <Tabs defaultValue="all" value={currentTab} onValueChange={(value) => {
            setCurrentTab(value);
            setPage(1);
          }}>
            <TabsList className="mb-5 rounded-2xl p-1 bg-purple-50 dark:bg-purple-900/20">
              <TabsTrigger
                value="all"
                className="flex items-center gap-2 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white"
              >
                <Users className="h-4 w-4" />
                {t("community.allStories")}
              </TabsTrigger>
              <TabsTrigger
                value="my-posts"
                className="flex items-center gap-2 rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white"
              >
                <Star className="h-4 w-4" />
                {t("community.mySharedStories")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              {isLoading ? (
                <div className="space-y-3">
                  {Array(4).fill(0).map((_, i) => (
                    <div key={i} className="p-4 border border-purple-100 dark:border-purple-900/20 rounded-2xl">
                      <div className="flex gap-4">
                        <Skeleton className="h-24 w-24 rounded-xl" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-6 w-3/4" />
                          <Skeleton className="h-4 w-1/2" />
                          <div className="flex gap-2">
                            <Skeleton className="h-5 w-16 rounded-full" />
                            <Skeleton className="h-5 w-16 rounded-full" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : posts.length > 0 ? (
                <AnimatePresence>
                  <motion.div className="space-y-3" variants={containerVariants} initial="hidden" animate="visible">
                    {posts.map((post, i) => (
                      <motion.div
                        key={post.id}
                        variants={itemVariants}
                        className="rounded-2xl overflow-hidden border border-purple-100/60 dark:border-purple-900/20
                          shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                      >
                        <CommunityPost
                          post={post}
                          onLike={() => handleLikePost(post.id)}
                          isLiked={likedPosts.includes(post.id)}
                          onReport={(postId) => {
                            const reported = JSON.parse(localStorage.getItem("reportedPosts") || "[]");
                            if (!reported.includes(postId)) {
                              localStorage.setItem("reportedPosts", JSON.stringify([...reported, postId]));
                            }
                            toast({ description: t("community.reportSubmitted") });
                          }}
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-14 px-4 border border-dashed border-purple-200 dark:border-purple-800/40
                    rounded-2xl bg-gradient-to-br from-purple-50/60 to-indigo-50/40 dark:from-purple-900/20 dark:to-indigo-900/10"
                >
                  <div className="rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/40 dark:to-indigo-900/30 p-4 inline-flex mb-4 shadow-sm">
                    <Users className="h-10 w-10 text-purple-400" />
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                    {t("community.noStories")}
                  </h3>
                  <p className="mt-2 text-gray-500 dark:text-gray-400">
                    {searchQuery || selectedTags.length > 0
                      ? t("community.adjustFilters")
                      : t("community.beFirst")}
                  </p>
                  <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="inline-block mt-5">
                    <Button
                      className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white shadow-md rounded-2xl px-6"
                      onClick={() => setShowShareModal(true)}
                    >
                      <Sparkles className="h-4 w-4 me-2" />
                      {t("community.shareYourStory")}
                    </Button>
                  </motion.div>
                </motion.div>
              )}

              {posts.length > 0 && (
                <div className={`flex justify-center mt-6 gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <Button
                    variant="outline"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-2xl border-purple-100 dark:border-purple-900/30"
                  >
                    {t("community.previous")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setPage(p => p + 1)}
                    disabled={posts.length < postsPerPage}
                    className="rounded-2xl border-purple-100 dark:border-purple-900/30"
                  >
                    {t("community.next")}
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="my-posts" className="space-y-4">
              {isLoading ? (
                <div className="space-y-3">
                  {Array(3).fill(0).map((_, i) => (
                    <div key={i} className="p-4 border border-purple-100 dark:border-purple-900/20 rounded-2xl">
                      <div className="flex gap-4">
                        <Skeleton className="h-24 w-24 rounded-xl" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-6 w-3/4" />
                          <Skeleton className="h-4 w-1/2" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : posts.length > 0 ? (
                <motion.div className="space-y-3" variants={containerVariants} initial="hidden" animate="visible">
                  {posts.map((post) => (
                    <motion.div
                      key={post.id}
                      variants={itemVariants}
                      className="rounded-2xl overflow-hidden border border-purple-100/60 dark:border-purple-900/20
                        shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                    >
                      <CommunityPost
                        post={post}
                        onLike={() => handleLikePost(post.id)}
                        isLiked={likedPosts.includes(post.id)}
                        isOwner={true}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-14 px-4 border border-dashed border-purple-200 dark:border-purple-800/40 rounded-2xl
                    bg-gradient-to-br from-purple-50/60 to-indigo-50/40 dark:from-purple-900/20 dark:to-indigo-900/10"
                >
                  <div className="rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/40 dark:to-indigo-900/30 p-4 inline-flex mb-4 shadow-sm">
                    <BookOpen className="h-10 w-10 text-purple-400" />
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                    {t("community.noSharedYet")}
                  </h3>
                  <p className="mt-2 text-gray-500 dark:text-gray-400">
                    {t("community.notSharedYet")}
                  </p>
                  <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="inline-block mt-5">
                    <Button
                      className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white shadow-md rounded-2xl px-6"
                      onClick={() => setShowShareModal(true)}
                    >
                      <Sparkles className="h-4 w-4 me-2" />
                      {t("community.shareFirstStory")}
                    </Button>
                  </motion.div>
                </motion.div>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>
      </motion.div>

      {/* Share Book Modal */}
      <ShareBookModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        onShare={handleShareBook}
      />

      {/* Parental PIN Dialog */}
      <Dialog open={showPinDialog} onOpenChange={(open) => {
        if (!open) {
          setShowPinDialog(false);
          setPendingShareData(null);
          setPinInput("");
          setPinError("");
        }
      }}>
        <DialogContent dir={isRTL ? "rtl" : "ltr"} className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Lock className="h-5 w-5 text-purple-600" />
              </div>
              {t("community.parentApproval")}
            </DialogTitle>
            <DialogDescription>
              {t("community.parentApprovalDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder={t("community.enterPin")}
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value);
                setPinError("");
              }}
              onKeyDown={(e) => { if (e.key === "Enter") handlePinSubmit(); }}
              autoFocus
              className={`${isRTL ? "text-right" : "text-left"} rounded-xl`}
            />
            {pinError && (
              <p className="text-sm text-red-500">{pinError}</p>
            )}
          </div>

          <DialogFooter className={isRTL ? "flex-row-reverse" : ""}>
            <Button variant="outline" className="rounded-xl" onClick={() => {
              setShowPinDialog(false);
              setPendingShareData(null);
              setPinInput("");
              setPinError("");
            }}>
              {t("community.parentApprovalCancel")}
            </Button>
            <Button onClick={handlePinSubmit} className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 rounded-xl">
              {t("community.parentApprovalConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
