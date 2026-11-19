import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, GripHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/i18nProvider";
import SceneCard, { sceneRoleLabel } from "./SceneCard";

export default function StoryBoard({
  scenes, onChange, onEdit, onRegenerate, regeneratingIndex, busy, characters, language, isRTL,
}) {
  const { t } = useI18n();
  const list = useRef(null);
  const drag = useRef(null);
  const frame = useRef(0);
  const announcementTimer = useRef(0);
  const [highlight, setHighlight] = useState(null);
  const [announcement, setAnnouncement] = useState("");

  const announce = useCallback((message) => {
    window.clearTimeout(announcementTimer.current);
    setAnnouncement("");
    announcementTimer.current = window.setTimeout(() => setAnnouncement(message), 500);
  }, []);

  const clearDrag = useCallback(() => {
    cancelAnimationFrame(frame.current);
    const current = drag.current;
    drag.current = null;
    if (current?.handle.hasPointerCapture(current.pointerId)) {
      current.handle.releasePointerCapture(current.pointerId);
    }
    setHighlight(null);
  }, []);

  useEffect(() => {
    function cancelOnEscape(event) {
      if (event.key !== "Escape" || !drag.current) return;
      clearDrag();
      announce(t("spxWizard.stationMoveCanceled"));
    }
    window.addEventListener("keydown", cancelOnEscape);
    return () => window.removeEventListener("keydown", cancelOnEscape);
  }, [announce, clearDrag, t]);

  useEffect(() => () => {
    cancelAnimationFrame(frame.current);
    window.clearTimeout(announcementTimer.current);
  }, []);

  useEffect(() => {
    if (busy) clearDrag();
  }, [busy, clearDrag]);

  function move(from, to, direction = null) {
    if (busy || from === to || to < 0 || to >= scenes.length) return;
    if (drag.current) clearDrag();
    const changed = [...scenes];
    const [scene] = changed.splice(from, 1);
    changed.splice(to, 0, scene);
    onChange(changed);
    announce(t("spxWizard.stationMoved", {
      name: scene.title || sceneRoleLabel(scene.role, language),
      position: to + 1,
    }));
    requestAnimationFrame(() => {
      const tile = list.current?.children[to];
      tile?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      if (!direction) return;
      const active = tile?.querySelector(`button[data-move="${direction}"]:not(:disabled)`);
      (active || tile?.querySelector("button[data-move]:not(:disabled)"))?.focus({ preventScroll: true });
    });
  }

  function locateDestination(current) {
    const tile = document.elementFromPoint(current.x, current.y)?.closest("[data-station-index]");
    const target = list.current?.contains(tile) ? Number(tile.getAttribute("data-station-index")) : null;
    if (current.target === target) return;
    current.target = target;
    setHighlight({ from: current.index, to: target });
  }

  function autoScroll(now) {
    const current = drag.current;
    if (!current?.moving) return;
    const zone = Math.min(100, innerHeight / 4);
    const velocity = current.y < zone
      ? -(zone - current.y) / zone
      : current.y > innerHeight - zone ? (current.y - innerHeight + zone) / zone : 0;
    const elapsed = Math.min(now - current.time, 32);
    current.time = now;
    if (velocity && document.scrollingElement) {
      document.scrollingElement.scrollTop += Math.sign(velocity) * Math.min(Math.abs(velocity), 1) * elapsed * 0.85;
      locateDestination(current);
    }
    frame.current = requestAnimationFrame(autoScroll);
  }

  function beginDrag(event, index) {
    if (busy || drag.current || !event.isPrimary || event.button !== 0) return;
    const handle = event.currentTarget;
    drag.current = {
      handle, index, pointerId: event.pointerId, target: null, moving: false,
      startX: event.clientX, startY: event.clientY,
    };
    handle.setPointerCapture(event.pointerId);
  }

  function followDrag(event) {
    const current = drag.current;
    if (current?.pointerId !== event.pointerId) return;
    current.x = event.clientX;
    current.y = event.clientY;
    if (!current.moving) {
      if (Math.hypot(current.x - current.startX, current.y - current.startY) < 8) return;
      current.moving = true;
      current.time = performance.now();
      frame.current = requestAnimationFrame(autoScroll);
      setHighlight({ from: current.index, to: null });
    }
    locateDestination(current);
  }

  function endDrag(event, canceled = false) {
    const current = drag.current;
    if (current?.pointerId !== event.pointerId) return;
    clearDrag();
    if (current.moving && !canceled && current.target !== null) move(current.index, current.target);
    if (current.moving && canceled) announce(t("spxWizard.stationMoveCanceled"));
  }

  const Earlier = isRTL ? ArrowRight : ArrowLeft;
  const Later = isRTL ? ArrowLeft : ArrowRight;
  return (
    <fieldset disabled={busy} className="min-w-0 space-y-3">
      <legend className="sr-only">{t("spxWizard.stationList")}</legend>
      <p className="text-sm text-gray-600 dark:text-gray-300">{t("spxWizard.stationHint")}</p>
      <ol ref={list} role="list" className={`grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,17rem),1fr))] items-start gap-4 p-0 ${highlight ? "[&_*]:cursor-grabbing" : ""}`}>
        {scenes.map((scene, index) => {
          const title = scene.title || sceneRoleLabel(scene.role, language);
          return (
            <motion.li key={scene.id || index} layout="position" data-station-index={index}
              className={`min-w-0 scroll-m-4 rounded-2xl bg-violet-50 p-2 ring-offset-2 dark:bg-violet-950/30
                ${highlight?.from === index ? "opacity-65" : ""}
                ${highlight?.to === index && highlight.from !== index ? "ring-2 ring-violet-600" : ""}`}>
              <SceneCard scene={scene} onSceneChange={(patch) => onEdit(index, patch)}
                onRegenerate={() => onRegenerate(index)} isRegenerating={regeneratingIndex === index}
                allCharacters={characters} isRTL={isRTL} language={language} sceneNumber={index + 1} />
              <div className="mt-1 flex justify-between gap-1">
                <Button type="button" variant="ghost" data-move="earlier" disabled={index === 0}
                  aria-label={t("spxWizard.stationEarlier", { name: title })} className="min-h-11 min-w-11"
                  onClick={() => move(index, index - 1, "earlier")}><Earlier size={18} aria-hidden="true" /></Button>
                <span data-drag-handle aria-hidden="true"
                  className="grid size-11 touch-none select-none place-items-center rounded-lg text-violet-700 [-webkit-user-select:none] dark:text-violet-300"
                  style={{ cursor: busy ? "default" : highlight ? "grabbing" : "grab" }}
                  onPointerDown={(event) => beginDrag(event, index)} onPointerMove={followDrag}
                  onPointerUp={endDrag} onPointerCancel={(event) => endDrag(event, true)}
                  onLostPointerCapture={(event) => endDrag(event, true)}>
                  <GripHorizontal size={22} />
                </span>
                <Button type="button" variant="ghost" data-move="later" disabled={index === scenes.length - 1}
                  aria-label={t("spxWizard.stationLater", { name: title })} className="min-h-11 min-w-11"
                  onClick={() => move(index, index + 1, "later")}><Later size={18} aria-hidden="true" /></Button>
              </div>
            </motion.li>
          );
        })}
      </ol>
      <p role="status" className="sr-only">{announcement}</p>
    </fieldset>
  );
}
