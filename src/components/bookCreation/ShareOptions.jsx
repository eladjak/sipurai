import { useCallback, useEffect, useId, useRef, useState } from "react";
import { BookOpen, Copy, Facebook, Instagram, Mail, MessageCircle, Twitter } from "lucide-react";
import { useI18n } from "@/components/i18n/i18nProvider";
import { BookControlButton } from "@/components/bookControls/BookControls";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Book } from "@/entities/Book";
import { Community } from "@/entities/Community";
import { unshareBook } from "@/lib/ownerApi";
import { createPageUrl } from "@/utils";
import { getParentalControls, isPinSet, moderateInput, verifyParentalPin } from "@/utils/content-moderation";
import { publishBookShare, readOwnerSharingState, readOwnerVisibility } from "./bookSharing";

export default function ShareOptions({ book, bookId }) {
  return <BookSharing key={JSON.stringify([book?.created_by, bookId])} book={book} bookId={bookId} />;
}

function BookSharing({ book, bookId }) {
  const { t, isRTL } = useI18n();
  const { toast } = useToast();
  const fieldId = useId();
  const [coverFailed, setCoverFailed] = useState(false);
  const [visibility, setVisibility] = useState(null);
  const [readFailed, setReadFailed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [listingReadFailed, setListingReadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shareType, setShareType] = useState("");
  const [publicAck, setPublicAck] = useState(false);
  const [pin, setPin] = useState("");
  const [notice, setNotice] = useState("");
  const [copyFailed, setCopyFailed] = useState(false);
  const [cleanupRequired, setCleanupRequired] = useState(false);
  const [communityPost, setCommunityPost] = useState({
    title: book?.title || "",
    description: "",
    tags: ["story", "children"]
  });
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const pending = useRef(false);
  const mounted = useRef(false);
  const heading = useRef(null);
  const readVersion = useRef(0);
  const ownerId = book?.id === bookId ? book?.created_by : null;
  const controls = getParentalControls();
  const isShared = visibility === true;
  const isCommunity = shareType === "community";
  const url = isShared && !busy && !checking
    ? `${window.location.origin}${createPageUrl("BookView")}?id=${encodeURIComponent(bookId)}`
    : null;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const refreshSharing = useCallback(async ({ conceal = true } = {}) => {
    if (pending.current || !mounted.current) return false;
    const version = ++readVersion.current;
    if (conceal) {
      setChecking(true);
      setCopyFailed(false);
    }
    const state = await readOwnerSharingState({ Book, Community, bookId, ownerId });
    if (!mounted.current || version !== readVersion.current) return false;
    setVisibility(state.visibility);
    if (state.visibility !== true) setCopyFailed(false);
    setReadFailed(state.visibility === null);
    setListingReadFailed(state.listingReadFailed);
    if (state.visibility !== null && !state.listingReadFailed) {
      setCleanupRequired(state.cleanupRequired);
    }
    setChecking(false);
    return state.visibility === true;
  }, [bookId, ownerId]);

  useEffect(() => {
    void refreshSharing();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshSharing();
    };
    const refreshOnFocus = () => void refreshSharing();
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      readVersion.current += 1;
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshSharing]);

  const handlePublish = async () => {
    if (pending.current || checking || listingReadFailed || cleanupRequired || visibility === null || !ownerId || !publicAck
      || !["link", "community"].includes(shareType)) return;
    if (!getParentalControls().allowCommunitySharing) {
      setNotice("sharing.publicationDisabled");
      return;
    }

    let post;
    if (isCommunity) {
      if (!communityPost.title.trim() || !communityPost.description.trim()) {
        setNotice("sharing.missingInfoDesc");
        return;
      }
      const title = moderateInput(communityPost.title, 'title');
      const description = moderateInput(communityPost.description, 'description');
      if (title.blocked || description.blocked) {
        setNotice("communityPost.inappropriateDesc");
        return;
      }
      post = {
        title: title.sanitized,
        description: description.sanitized,
        tags: communityPost.tags
      };
    }

    pending.current = true;
    setBusy(true);
    setNotice("");
    try {
      const needsPin = getParentalControls().requireApprovalBeforePublish;
      const pinVerified = needsPin && isPinSet() && pin && await verifyParentalPin(pin) === true;
      if (!mounted.current) return;
      setPin("");
      const currentControls = getParentalControls();
      if (!currentControls.allowCommunitySharing) {
        setNotice("sharing.publicationDisabled");
        return;
      }
      if (currentControls.requireApprovalBeforePublish && !pinVerified) {
        setNotice("sharing.pinRequired");
        return;
      }

      const result = await publishBookShare({
        Book, Community, bookId, ownerId, post, isCurrent: () => mounted.current
      });
      if (!mounted.current) return;
      setVisibility(result.visibility);
      setReadFailed(result.visibility === null);
      setListingReadFailed(result.listingReadFailed === true);
      if (result.cleanupRequired) setCleanupRequired(true);
      if (result.error) {
        setNotice(result.error);
        return;
      }

      setNotice(isCommunity ? "sharing.shareSuccessDesc" : "sharing.linkReady");
      setPublicAck(false);
      setShareType("");
      setPin("");
    } catch {
      if (mounted.current) setNotice("sharing.shareErrorDesc");
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const stopSharing = async (id) => {
    if (pending.current) throw new Error("Share operation in progress");
    pending.current = true;
    readVersion.current += 1;
    setChecking(false);
    setBusy(true);
    setCopyFailed(false);
    try {
      return await unshareBook(id);
    } catch (error) {
      const value = await readOwnerVisibility(Book, id, ownerId);
      if (mounted.current) {
        setVisibility(value);
        setReadFailed(value === null);
        setCleanupRequired(true);
        setNotice(value === false ? "sharing.cleanupPending" : "");
      }
      throw error;
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const copy = async (instagram = false) => {
    if (!url || pending.current) return;
    if (!await refreshSharing({ conceal: false })) return;
    const version = readVersion.current;
    const text = instagram ? `${t("sharing.socialShareText")} ${book?.title ?? ""}\n${url}` : url;
    try {
      await navigator.clipboard.writeText(text);
      if (!mounted.current || pending.current || version !== readVersion.current) return;
      setCopyFailed(false);
      toast({ title: t(instagram ? "sharing.copiedForInstagram" : "sharing.linkCopied") });
    } catch {
      if (mounted.current && !pending.current && version === readVersion.current) setCopyFailed(true);
    }
  };

  const socialText = `${t("sharing.socialShareText")} ${book?.title ?? ""}`;
  const socialLinks = url ? [
    { label: "shareWhatsApp", Icon: MessageCircle, href: `https://wa.me/?text=${encodeURIComponent(`${socialText}\n${url}`)}` },
    { label: "shareFacebook", Icon: Facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
    { label: "shareTwitter", Icon: Twitter, href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(socialText)}&url=${encodeURIComponent(url)}` }
  ] : [];

  const selectShareType = (type) => {
    setShareType(type);
    setPublicAck(false);
    setPin("");
    setNotice("");
  };

  return (
    <div className="grid min-w-0 gap-5" dir={isRTL ? "rtl" : "ltr"}>
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle ref={heading} tabIndex={-1} className="flex min-w-0 items-center gap-3 break-words">
            {book?.cover_image && !coverFailed
              ? <img src={book.cover_image} onError={() => setCoverFailed(true)} alt="" className="size-12 shrink-0 rounded-md object-cover" />
              : <BookOpen aria-hidden="true" className="size-5 shrink-0" />}
            <span className="min-w-0 [overflow-wrap:anywhere]">{book?.title || t("bookControls.untitled")}</span>
          </CardTitle>
          <CardDescription role="status">
            {checking ? t("sharing.checkingVisibility")
              : readFailed ? t("sharing.visibilityUnavailable")
              : t(isShared ? "sharing.publicStatus" : "sharing.privateStatus")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {listingReadFailed && !checking && <p role="status">{t("sharing.listingCheckFailed")}</p>}
          {(readFailed || listingReadFailed) && (
            <Button type="button" variant="outline" className="min-h-11 justify-self-start" disabled={checking || busy}
              onClick={() => void refreshSharing()}>
              {t("sharing.checkAgain")}
            </Button>
          )}
          {visibility !== null && !controls.allowCommunitySharing && <p>{t("sharing.publicationDisabled")}</p>}
          {!checking && !listingReadFailed && visibility !== null && controls.allowCommunitySharing && !cleanupRequired && (
            <div className="flex flex-wrap gap-2">
              {!isShared && <Button type="button" className="min-h-11" disabled={busy} aria-pressed={shareType === "link"} onClick={() => selectShareType("link")}>
                {t("sharing.enablePublicLink")}
              </Button>}
              <Button type="button" variant="outline" className="min-h-11" disabled={busy} aria-pressed={isCommunity} onClick={() => selectShareType("community")}>
                {t("sharing.communityTitle")}
              </Button>
            </div>
          )}
          {shareType && !checking && !listingReadFailed && visibility !== null && controls.allowCommunitySharing && !cleanupRequired && (
            <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void handlePublish(); }}>
              <fieldset className="grid min-w-0 gap-4" disabled={busy}>
                {isCommunity && <>
                  <div className="grid gap-2">
                    <Label htmlFor={`${fieldId}-title`}>{t("sharing.postTitle")}</Label>
                    <Input id={`${fieldId}-title`} className="min-h-11" required value={communityPost.title}
                      placeholder={t("sharing.postTitlePlaceholder")}
                      onChange={(e) => setCommunityPost(prev => ({ ...prev, title: e.target.value }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`${fieldId}-description`}>{t("sharing.descriptionLabel")}</Label>
                    <Textarea id={`${fieldId}-description`} className="min-h-24" required value={communityPost.description}
                      placeholder={t("sharing.descriptionPlaceholder")}
                      onChange={(e) => setCommunityPost(prev => ({ ...prev, description: e.target.value }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`${fieldId}-tags`}>{t("sharing.addTag")}</Label>
                    <Input id={`${fieldId}-tags`} className="min-h-11" onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      const tag = e.currentTarget.value.trim();
                      if (tag && !communityPost.tags.includes(tag)) {
                        setCommunityPost(prev => ({ ...prev, tags: [...prev.tags, tag] }));
                      }
                      e.currentTarget.value = "";
                    }} />
                    <div className="flex flex-wrap gap-2">
                      {communityPost.tags.map(tag => (
                        <Button type="button" key={tag} variant="outline" className="min-h-11 max-w-full whitespace-normal [overflow-wrap:anywhere]"
                          aria-label={`${t("sharing.removeTag")} ${tag}`} onClick={() => setCommunityPost(prev => ({
                            ...prev, tags: prev.tags.filter(value => value !== tag)
                          }))}>
                          {tag} <span aria-hidden="true">×</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                </>}
                <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                  <input type="checkbox" className="mt-1 size-5 shrink-0 accent-purple-700" checked={publicAck}
                    onChange={(e) => setPublicAck(e.target.checked)} />
                  <span>{t(isCommunity ? "sharing.publicAck" : "sharing.linkAck")}</span>
                </label>
                {controls.requireApprovalBeforePublish && (
                  <div className="grid gap-2">
                    <Label htmlFor={`${fieldId}-pin`}>{t("sharing.parentalApprovalRequired")}</Label>
                    <Input id={`${fieldId}-pin`} className="min-h-11" dir="ltr" inputMode="numeric" type="password"
                      autoComplete="off" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value)} />
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" className="min-h-11" disabled={!publicAck}>
                    {busy ? t("sharing.sharing") : t(isCommunity ? "sharing.publishListing" : "sharing.confirmPublicLink")}
                  </Button>
                  <Button type="button" variant="ghost" className="min-h-11" onClick={() => selectShareType("")}>
                    {t("bookControls.cancel")}
                  </Button>
                </div>
              </fieldset>
            </form>
          )}
          <p role="status" className="text-sm">
            {cleanupRequired && visibility === false ? t("sharing.cleanupPending")
              : notice && t(notice)}
          </p>
          {(isShared || cleanupRequired) && (
            <BookControlButton kind="unshare" book={{ ...book, id: bookId }} onAction={stopSharing} onChanged={() => {
              setVisibility(false);
              setReadFailed(false);
              setListingReadFailed(false);
              setCleanupRequired(false);
              selectShareType("");
              setInviteEmail("");
              setInviteMessage("");
              heading.current?.focus();
            }} />
          )}
        </CardContent>
      </Card>

      {url && <>
        <Card className="min-w-0">
          <CardHeader><CardTitle>{t("sharing.shareLinkTitle")}</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <p id={`${fieldId}-copy-status`} role="status" className="text-sm">
              {copyFailed && t("sharing.manualCopy")}
            </p>
            {copyFailed && <div className="grid min-w-0 gap-2">
              <Label htmlFor={`${fieldId}-link`}>{t("sharing.publicLinkLabel")}</Label>
              <Input id={`${fieldId}-link`} dir="ltr" value={url} readOnly className="min-h-11"
                aria-describedby={`${fieldId}-copy-status`} />
            </div>}
            <Button type="button" variant="outline" className="min-h-11 justify-self-start gap-2" onClick={() => copy()}>
              <Copy aria-hidden="true" className="size-4" /> {t("sharing.copyShareLink")}
            </Button>
            <div className="flex flex-wrap gap-2">
              {socialLinks.map(({ label, Icon, href }) => (
                <Button type="button" key={label} variant="outline" size="icon" className="size-11"
                  aria-label={t(`sharing.${label}`)} onClick={async () => {
                    if (await refreshSharing({ conceal: false })) window.location.assign(href);
                  }}>
                  <Icon aria-hidden="true" className="size-5" />
                </Button>
              ))}
              <Button type="button" variant="outline" size="icon" className="size-11"
                aria-label={t("sharing.copyInstagram")} onClick={() => copy(true)}>
                <Instagram aria-hidden="true" className="size-5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader><CardTitle>{t("sharing.emailDraft")}</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={async (e) => {
              e.preventDefault();
              if (!await refreshSharing({ conceal: false })) return;
              const subject = encodeURIComponent(`${t("sharing.inviteSubject")} ${book?.title || t("sharing.aChildrensBook")}`);
              const body = encodeURIComponent(`${inviteMessage ? inviteMessage + '\n\n' : ''}${t("sharing.readBookHere")}\n${url}`);
              window.location.href = `mailto:${encodeURIComponent(inviteEmail).replace("%40", "@")}?subject=${subject}&body=${body}`;
            }}>
              <div className="grid gap-2">
                <Label htmlFor={`${fieldId}-email`}>{t("sharing.emailLabel")}</Label>
                <Input id={`${fieldId}-email`} className="min-h-11" dir="ltr" type="email"
                  value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`${fieldId}-message`}>{t("sharing.personalMessage")}</Label>
                <Textarea id={`${fieldId}-message`} className="min-h-24" value={inviteMessage}
                  placeholder={t("sharing.personalMessagePlaceholder")} onChange={(e) => setInviteMessage(e.target.value)} />
              </div>
              <Button type="submit" className="min-h-11 justify-self-start gap-2">
                <Mail aria-hidden="true" className="size-4" /> {t("sharing.emailDraft")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </>}
    </div>
  );
}
