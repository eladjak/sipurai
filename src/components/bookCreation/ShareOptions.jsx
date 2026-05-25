import React, { useState } from 'react';
import { useI18n } from "@/components/i18n/i18nProvider";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Share2,
  MessageSquare,
  Heart,
  Download,
  Copy,
  Twitter,
  Facebook,
  Instagram,
  Mail,
  BookOpen,
  Send,
  MessageCircle
} from "lucide-react";
import { Community } from "@/entities/Community";
import { Book } from "@/entities/Book";
import { useToast } from "@/components/ui/use-toast";
import { createPageUrl } from "@/utils";
import { moderateInput, getParentalControls } from "@/utils/content-moderation";

export default function ShareOptions({ book, bookId }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [shareType, setShareType] = useState("community");
  const [communityPost, setCommunityPost] = useState({
    title: book?.title || "",
    description: "",
    tags: ["story", "children"]
  });
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  
  const handleCommunityShare = async () => {
    if (!communityPost.title || !communityPost.description) {
      toast({
        variant: "destructive",
        title: t("sharing.missingInfo"),
        description: t("sharing.missingInfoDesc")
      });
      return;
    }

    // Check parental controls before sharing
    const controls = getParentalControls();
    if (controls.requireApprovalBeforePublish || !controls.allowCommunitySharing) {
      toast({
        variant: "destructive",
        title: t("sharing.parentalApprovalRequired") || "Parental Approval Required",
        description: t("sharing.shareFromCommunityPage") || "Ask your parents to share this book from the Community page where they can approve it with their PIN."
      });
      return;
    }

    // Moderate title and description before posting
    const titleMod = moderateInput(communityPost.title, 'title');
    if (titleMod.blocked) {
      toast({
        variant: "destructive",
        title: t("communityPost.inappropriateTitle") || "Inappropriate Content",
        description: t("communityPost.inappropriateDesc") || "Your post contains inappropriate content. Please revise it."
      });
      return;
    }

    const descMod = moderateInput(communityPost.description, 'description');
    if (descMod.blocked) {
      toast({
        variant: "destructive",
        title: t("communityPost.inappropriateTitle") || "Inappropriate Content",
        description: t("communityPost.inappropriateDesc") || "Your post contains inappropriate content. Please revise it."
      });
      return;
    }

    setIsLoading(true);
    try {
      await Community.create({
        book_id: bookId,
        title: titleMod.sanitized,
        description: descMod.sanitized,
        tags: communityPost.tags,
        visibility: "public"
      });

      // Mark the book itself public so its direct BookView link is readable by
      // anonymous visitors. books.is_public is the source of truth for sharing
      // (RLS: books_public_select / pages_public_select). Owner-only update, so
      // this is safe and authorized by RLS.
      if (bookId) {
        try { await Book.update(bookId, { is_public: true }); } catch { /* non-fatal */ }
      }

      toast({
        title: t("sharing.shareSuccess"),
        description: t("sharing.shareSuccessDesc"),
        className: "bg-green-100 text-green-900 dark:bg-green-900/50 dark:text-green-100"
      });
      
      // Reset form
      setCommunityPost({
        title: book?.title || "",
        description: "",
        tags: ["story", "children"]
      });
    } catch (error) {
      // silently handled
      toast({
        variant: "destructive",
        title: t("sharing.shareError"),
        description: t("sharing.shareErrorDesc")
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const copyLink = () => {
    const url = `${window.location.origin}${createPageUrl("BookView")}?id=${bookId}`;
    navigator.clipboard.writeText(url).then(() => {
      toast({
        title: t("sharing.linkCopied"),
        description: t("sharing.linkCopiedDesc")
      });
    });
  };
  
  const shareToSocialMedia = (platform) => {
    const url = `${window.location.origin}${createPageUrl("BookView")}?id=${bookId}`;
    const text = `${t("sharing.socialShareText")} ${book?.title}`;

    let shareUrl;
    switch (platform) {
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;
        window.open(shareUrl, '_blank', 'noopener,noreferrer');
        return;
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
        break;
      case 'email':
        shareUrl = `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`;
        break;
      default:
        return;
    }

    window.open(shareUrl, '_blank', 'noopener,noreferrer,width=600,height=400');
  };

  const copyForInstagram = () => {
    const url = `${window.location.origin}${createPageUrl("BookView")}?id=${bookId}`;
    const text = `${t("sharing.socialShareText")} ${book?.title}\n${url}`;
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: t("sharing.copiedForInstagram"),
        description: t("sharing.copiedForInstagramDesc")
      });
    });
  };
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MessageSquare className="h-5 w-5 mr-2 text-purple-500" />
            {t("sharing.communityTitle")}
          </CardTitle>
          <CardDescription>
            {t("sharing.communityDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="postTitle">{t("sharing.postTitle")}</Label>
              <Input
                id="postTitle"
                value={communityPost.title}
                onChange={(e) => setCommunityPost(prev => ({ ...prev, title: e.target.value }))}
                placeholder={t("sharing.postTitlePlaceholder")}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="postDescription">{t("sharing.descriptionLabel")}</Label>
              <Textarea
                id="postDescription"
                value={communityPost.description}
                onChange={(e) => setCommunityPost(prev => ({ ...prev, description: e.target.value }))}
                placeholder={t("sharing.descriptionPlaceholder")}
                className="min-h-[120px]"
              />
            </div>
            
            <div className="space-y-2">
              <Label>{t("sharing.tags")}</Label>
              <div className="flex flex-wrap gap-2">
                {communityPost.tags.map((tag, index) => (
                  <div key={index} className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full px-3 py-1 text-sm flex items-center">
                    {tag}
                    <button
                      onClick={() => setCommunityPost(prev => ({
                        ...prev,
                        tags: prev.tags.filter((_, i) => i !== index)
                      }))}
                      className="ml-2 text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200"
                    >
                      &times;
                    </button>
                  </div>
                ))}
                <Input
                  className="w-32 h-8"
                  placeholder={t("sharing.addTag")}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.target.value) {
                      e.preventDefault();
                      if (!communityPost.tags.includes(e.target.value)) {
                        setCommunityPost(prev => ({
                          ...prev,
                          tags: [...prev.tags, e.target.value]
                        }));
                      }
                      e.target.value = '';
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={handleCommunityShare}
            disabled={isLoading || !communityPost.title || !communityPost.description}
            className="w-full"
          >
            {isLoading ? (
              <>
                <span className="mr-2">{t("sharing.sharing")}</span>
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4 mr-2" />
                {t("sharing.communityTitle")}
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Share2 className="h-5 w-5 mr-2 text-blue-500" />
            {t("sharing.shareLinkTitle")}
          </CardTitle>
          <CardDescription>
            {t("sharing.shareLinkDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="relative">
              <Input
                value={`${window.location.origin}${createPageUrl("BookView")}?id=${bookId}`}
                readOnly
                className="pr-12"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full text-gray-500 hover:text-gray-700"
                onClick={copyLink}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            
            <div>
              <Label className="mb-2 block">{t("sharing.shareOnSocial")}</Label>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-full border-[#25D366] text-[#25D366] hover:bg-[#25D366] hover:text-white"
                  onClick={() => shareToSocialMedia('whatsapp')}
                  title={t("sharing.shareWhatsApp")}
                >
                  <MessageCircle className="h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-full text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  onClick={() => shareToSocialMedia('facebook')}
                  title={t("sharing.shareFacebook")}
                >
                  <Facebook className="h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-full text-blue-400 hover:text-blue-500 hover:bg-blue-50"
                  onClick={() => shareToSocialMedia('twitter')}
                  title={t("sharing.shareTwitter")}
                >
                  <Twitter className="h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-full text-pink-600 hover:text-pink-700 hover:bg-pink-50"
                  onClick={copyForInstagram}
                  title={t("sharing.copyInstagram")}
                >
                  <Instagram className="h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-full text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={() => shareToSocialMedia('email')}
                  title={t("sharing.shareEmail")}
                >
                  <Mail className="h-5 w-5" />
                </Button>
              </div>
            </div>
            
            <div>
              <Button
                variant="outline"
                className="w-full"
                onClick={copyLink}
              >
                <Copy className="h-4 w-4 mr-2" />
                {t("sharing.copyShareLink")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Send className="h-5 w-5 mr-2 text-green-500" />
            {t("sharing.inviteTitle")}
          </CardTitle>
          <CardDescription>
            {t("sharing.inviteDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inviteEmail">{t("sharing.emailLabel")}</Label>
              <Input
                id="inviteEmail"
                placeholder={t("sharing.emailPlaceholder")}
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="inviteMessage">{t("sharing.personalMessage")}</Label>
              <Textarea
                id="inviteMessage"
                placeholder={t("sharing.personalMessagePlaceholder")}
                className="min-h-[100px]"
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button
            disabled={!inviteEmail}
            onClick={() => {
              const bookUrl = `${window.location.origin}${createPageUrl("BookView")}?id=${bookId}`;
              const subject = encodeURIComponent(`${t("sharing.inviteSubject")} ${book?.title || t("sharing.aChildrensBook")}`);
              const body = encodeURIComponent(
                `${inviteMessage ? inviteMessage + '\n\n' : ''}${t("sharing.readBookHere")}\n${bookUrl}`
              );
              window.open(`mailto:${inviteEmail}?subject=${subject}&body=${body}`, '_blank');
            }}
          >
            <Send className="h-4 w-4 mr-2" />
            {t("sharing.sendInvitation")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}