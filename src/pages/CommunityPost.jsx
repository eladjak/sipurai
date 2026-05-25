import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useI18n } from "@/components/i18n/i18nProvider";
import { Community } from "@/entities/Community";
import { Comment } from "@/entities/Comment";
import { User } from "@/entities/User";
import { Book } from "@/entities/Book";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import FollowButton from "@/components/social/FollowButton";
import { moderateInput } from "@/utils/content-moderation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Heart,
  MessageSquare,
  Share2,
  Tag,
  Calendar,
  Send,
  BookOpen,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import CommentItem from "../components/community/CommentItem";

export default function CommunityPost() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { t, isRTL } = useI18n();
  const { user: hookUser } = useCurrentUser();
  const [post, setPost] = useState(null);
  const [book, setBook] = useState(null);
  const [author, setAuthor] = useState(null);
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  // Get post ID from URL
  const postId = searchParams.get("id");
  
  useEffect(() => {
    if (!postId) {
      navigate(createPageUrl("Community"));
      return;
    }
    
    loadData();
  }, [postId]);
  
  const loadData = async () => {
    try {
      setIsLoading(true);

      // Set current user from hook
      if (hookUser) {
        setCurrentUser(hookUser);
      }

      // Load post data
      const postData = await Community.get(postId);
      setPost(postData);
      
      // Load book data
      if (postData.book_id) {
        const bookData = await Book.get(postData.book_id);
        setBook(bookData);
      }
      
      // Load author data
      if (postData.user_id) {
        const userData = await User.get(postData.user_id);
        setAuthor(userData);
      }
      
      // Load comments
      await loadComments();
      
    } catch (error) {
      toast({
        variant: "destructive",
        description: t("communityPost.loadError"),
      });
      navigate(createPageUrl("Community"));
    } finally {
      setIsLoading(false);
    }
  };
  
  const loadComments = async () => {
    try {
      // Get all comments for this post
      const commentData = await Comment.filter(
        { community_id: postId },
        "-created_date"
      );
      
      // Enhance comments with user data
      const enhancedComments = await Promise.all(
        commentData.map(async (comment) => {
          try {
            const user = await User.get(comment.user_id);
            return {
              ...comment,
              user
            };
          } catch (error) {
            return {
              ...comment,
              user: { full_name: t("common.unknownUser") }
            };
          }
        })
      );
      
      // Group comments by parent/child
      const rootComments = enhancedComments.filter(c => !c.parent_id);
      
      const commentTree = rootComments.map(rootComment => {
        const replies = enhancedComments.filter(c => c.parent_id === rootComment.id);
        return {
          ...rootComment,
          replies
        };
      });
      
      setComments(commentTree);
    } catch (error) {
      toast({
        variant: "destructive",
        description: t("communityPost.loadCommentsError"),
      });
    }
  };
  
  const handleLike = async () => {
    try {
      if (!post) return;

      // Per-user like dedup via localStorage
      const likeKey = `post_liked_${postId}_${hookUser?.email || 'anon'}`;
      if (localStorage.getItem(likeKey)) {
        toast({ description: t("communityPost.alreadyLiked") });
        return;
      }

      // Increment like count
      const newLikeCount = (post.likes || 0) + 1;
      await Community.update(postId, { likes: newLikeCount });
      localStorage.setItem(likeKey, '1');

      // Update post in state
      setPost({
        ...post,
        likes: newLikeCount
      });

      toast({
        description: t("communityPost.likeSuccess"),
      });
    } catch (error) {
      toast({
        variant: "destructive",
        description: t("communityPost.likeError"),
      });
    }
  };
  
  const handleSubmitComment = async () => {
    try {
      if (!commentText.trim() || !currentUser) return;

      // Moderate the comment before submitting
      const modResult = moderateInput(commentText, 'comment');
      if (modResult.blocked) {
        toast({
          variant: "destructive",
          title: t("communityPost.inappropriateTitle"),
          description: t("communityPost.inappropriateDesc")
        });
        return;
      }

      setIsSubmitting(true);

      // Create comment
      const commentData = {
        community_id: postId,
        user_id: currentUser.id,
        content: modResult.sanitized,
        parent_id: null // Root comment
      };

      await Comment.create(commentData);
      
      // Refresh comments
      await loadComments();
      
      // Clear form
      setCommentText('');
      
      toast({
        description: t("communityPost.commentSuccess"),
      });
    } catch (error) {
      toast({
        variant: "destructive",
        description: t("communityPost.commentError"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleSubmitReply = async (parentId, content) => {
    try {
      if (!content.trim() || !currentUser) return;

      // Moderate the reply before submitting
      const modResult = moderateInput(content, 'comment');
      if (modResult.blocked) {
        toast({
          variant: "destructive",
          title: t("communityPost.inappropriateTitle"),
          description: t("communityPost.inappropriateDesc")
        });
        return false;
      }

      // Create reply
      const replyData = {
        community_id: postId,
        user_id: currentUser.id,
        content: modResult.sanitized,
        parent_id: parentId
      };

      await Comment.create(replyData);
      
      // Refresh comments
      await loadComments();
      
      toast({
        description: t("communityPost.replySuccess"),
      });
      
      return true;
    } catch (error) {
      toast({
        variant: "destructive",
        description: t("communityPost.replyError"),
      });
      return false;
    }
  };
  
  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-gradient-to-r from-pink-200 via-purple-200 to-indigo-200 rounded-2xl"></div>
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-gray-200 dark:bg-gray-700 h-12 w-12"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-xl w-48"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-xl w-32"></div>
            </div>
          </div>
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-xl w-full max-w-md"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-xl w-full"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-xl w-full"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-xl w-3/4"></div>
          </div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl w-full"></div>
        </div>
      </div>
    );
  }
  
  if (!post) {
    return (
      <div className="max-w-4xl mx-auto py-8 text-center">
        <h2 className="text-2xl font-bold mb-4">{t("communityPost.notFound")}</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">{t("communityPost.notFoundDesc")}</p>
        <Button onClick={() => navigate(createPageUrl("Community"))}>
          {t("communityPost.returnToCommunity")}
        </Button>
      </div>
    );
  }
  
  return (
    <div className="max-w-4xl mx-auto py-4" dir={isRTL ? "rtl" : "ltr"}>
      {/* Gradient Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl mb-6 shadow-xl"
      >
        <div className="bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 px-6 py-5">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_30%_50%,white_0%,transparent_70%)]" />
          <div className={`relative flex items-center gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(createPageUrl("Community"))}
              className="text-white/80 hover:text-white hover:bg-white/15 rounded-xl shrink-0"
            >
              <ArrowLeft className={`h-5 w-5 ${isRTL ? "rotate-180" : ""}`} />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-yellow-300" />
                <p className="text-white/70 text-sm font-medium">{t("communityPost.backToCommunity")}</p>
              </div>
              <h1 className="text-xl font-bold text-white font-heading line-clamp-1">
                {post.title}
              </h1>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Post Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="mb-6"
      >
        <Card className="border-2 border-purple-100 dark:border-purple-900/30 shadow-lg rounded-2xl overflow-hidden">
          <CardHeader className="pb-3">
            {/* Author row */}
            <div className={`flex items-center gap-3 mb-3 ${isRTL ? "flex-row-reverse" : ""}`}>
              <Avatar className="h-11 w-11 ring-2 ring-purple-200 dark:ring-purple-800">
                {author?.avatar_url ? (
                  <AvatarImage src={author.avatar_url} alt={author.full_name} />
                ) : null}
                <AvatarFallback className="bg-gradient-to-br from-pink-500 via-purple-500 to-indigo-500 text-white font-bold">
                  {author?.full_name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className={isRTL ? "text-right" : ""}>
                <p className="font-semibold text-gray-900 dark:text-white">{author?.full_name || t("common.unknownUser")}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {post.created_date && format(new Date(post.created_date), 'MMM d, yyyy')}
                </p>
              </div>
              {author?.email && hookUser?.email && author.email !== hookUser.email && (
                <div className={isRTL ? "me-auto" : "ms-auto"}>
                  <FollowButton targetEmail={author.email} size="sm" />
                </div>
              )}
            </div>

            <CardTitle className="text-2xl font-heading">{post.title}</CardTitle>
            {post.tags && post.tags.length > 0 && (
              <div className={`flex flex-wrap gap-2 mt-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                {post.tags.map(tag => (
                  <Badge
                    key={tag}
                    className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-0 rounded-full px-3"
                  >
                    <Tag className="me-1 h-3 w-3" />
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-6">
            <p className={`text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed ${isRTL ? "text-right" : ""}`}>
              {post.description}
            </p>

            {/* Book card — gradient border */}
            {book && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="p-0.5 rounded-2xl shadow-md"
                style={{ background: "linear-gradient(135deg, #ec4899, #8b5cf6, #6366f1)" }}
              >
                <Card className="overflow-hidden border-0 rounded-[14px]">
                  <div className={`flex flex-col md:flex-row ${isRTL ? "md:flex-row-reverse" : ""}`}>
                    <div className="md:w-1/3 relative overflow-hidden">
                      {book.cover_image ? (
                        <img
                          src={book.cover_image}
                          alt={book.title}
                          className="w-full h-full object-cover min-h-[180px]"
                        />
                      ) : (
                        <div className="w-full min-h-[180px] bg-gradient-to-br from-pink-400 via-purple-500 to-indigo-500 flex items-center justify-center">
                          <BookOpen className="h-16 w-16 text-white/70" />
                        </div>
                      )}
                    </div>
                    <div className={`p-5 md:w-2/3 ${isRTL ? "text-right" : ""}`}>
                      <h3 className="text-xl font-bold font-heading mb-1">{book.title}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                        {t("communityPost.personalizedStoryFor")} {book.child_name}
                      </p>
                      <div className={`flex flex-wrap gap-2 ${isRTL ? "flex-row-reverse" : ""}`}>
                        <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-0 capitalize">
                          {book.genre?.replace(/_/g, ' ')}
                        </Badge>
                        <Badge variant="outline" className="border-purple-200 dark:border-purple-800">
                          {book.age_range} {t("communityPost.years")}
                        </Badge>
                        <Badge variant="outline" className="capitalize border-indigo-200 dark:border-indigo-800">
                          {book.language}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </CardContent>

          {/* Action footer */}
          <CardFooter className={`flex justify-between pt-4 border-t border-purple-100 dark:border-purple-900/30 bg-purple-50/30 dark:bg-purple-900/10 ${isRTL ? "flex-row-reverse" : ""}`}>
            <div className={`flex items-center gap-4 ${isRTL ? "flex-row-reverse" : ""}`}>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 rounded-xl hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-colors"
                  onClick={handleLike}
                >
                  <Heart className={`h-5 w-5 transition-colors ${post.likes > 0 ? 'text-red-500 fill-red-500' : 'text-gray-400'}`} />
                  <span className="font-medium">{post.likes || 0}</span>
                </Button>
              </motion.div>
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 px-3">
                <MessageSquare className="h-5 w-5" />
                <span className="font-medium">{comments.length}</span>
              </div>
            </div>

            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Button
                variant="outline"
                className="flex items-center gap-2 rounded-xl border-purple-200 dark:border-purple-800 hover:bg-gradient-to-r hover:from-purple-50 hover:to-indigo-50 dark:hover:from-purple-900/20 dark:hover:to-indigo-900/20 transition-all"
                onClick={async () => {
                  const shareUrl = `${window.location.origin}${createPageUrl("CommunityPost")}?id=${postId}`;
                  if (navigator.share) {
                    try {
                      await navigator.share({
                        title: post?.title,
                        text: post?.description,
                        url: shareUrl,
                      });
                    } catch {
                      // User cancelled share dialog — no action needed
                    }
                  } else {
                    navigator.clipboard.writeText(shareUrl).then(() => {
                      toast({ description: t("communityPost.linkCopied") });
                    });
                  }
                }}
              >
                <Share2 className="h-4 w-4 text-purple-500" />
                {t("communityPost.share")}
              </Button>
            </motion.div>
          </CardFooter>
        </Card>
      </motion.div>

      {/* Comments Section */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="mt-2"
      >
        <div className={`flex items-center gap-2 mb-5 ${isRTL ? "flex-row-reverse" : ""}`}>
          <div className="p-2 rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/40 dark:to-indigo-900/30">
            <MessageSquare className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="text-xl font-bold font-heading">
            {t("communityPost.comments")} ({comments.length})
          </h3>
        </div>

        {/* Comment form — rounded card */}
        <div className="mb-8">
          <Card className="border-2 border-purple-100 dark:border-purple-900/30 shadow-md rounded-2xl overflow-hidden">
            <CardContent className="p-4 space-y-3">
              <Textarea
                placeholder={t("communityPost.addComment")}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className={`min-h-[90px] resize-none rounded-xl border-purple-100 dark:border-purple-900/30 focus:ring-purple-400 bg-white dark:bg-gray-900 ${isRTL ? "text-right" : ""}`}
                dir={isRTL ? "rtl" : "ltr"}
              />
              <div className={`flex ${isRTL ? "justify-start" : "justify-end"}`}>
                <Button
                  onClick={handleSubmitComment}
                  disabled={!commentText.trim() || isSubmitting}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl shadow-md px-5 gap-2"
                >
                  {isSubmitting ? t("communityPost.posting") : t("communityPost.postComment")}
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Comments list */}
        <div className="space-y-4">
          {comments.length > 0 ? (
            comments.map((comment, idx) => (
              <motion.div
                key={comment.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.05 }}
              >
                <CommentItem
                  comment={comment}
                  currentUser={currentUser}
                  onSubmitReply={handleSubmitReply}
                />
              </motion.div>
            ))
          ) : (
            <div className={`text-center py-12 border-2 border-dashed border-purple-100 dark:border-purple-900/30 rounded-2xl bg-purple-50/30 dark:bg-purple-900/10`}>
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/40 dark:to-indigo-900/30 flex items-center justify-center">
                <MessageSquare className="h-8 w-8 text-purple-400 dark:text-purple-500" />
              </div>
              <p className="font-semibold text-gray-700 dark:text-gray-300">{t("communityPost.noComments")}</p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">{t("communityPost.beFirstComment")}</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}