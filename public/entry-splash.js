/**
 * App-entry choreography — the gate that reveals the book-opening splash.
 *
 * THIS LIVES IN ITS OWN FILE FOR ONE REASON: production serves
 *   Content-Security-Policy: script-src 'self' ...
 * with no 'unsafe-inline' and no nonce. As an inline <script> this code was
 * silently blocked in production — the markup shipped, the gate never ran, and
 * the splash never played for a single visitor. It was verified in a browser
 * that did not carry the header, so the check was true where it ran and false
 * where it mattered.
 *
 * Do NOT move this back inline, and do NOT add 'unsafe-inline' to script-src to
 * make it work — weakening the whole site's script policy for an entry
 * animation is a bad trade. `script-src 'self'` allows this file as-is.
 */
(function(){try{
        var el=document.getElementById("sp-entry");
        if(!el||el.dataset.armed)return; el.dataset.armed="1";
        var rm=false; try{rm=!!(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches);}catch(e){}
        var seen=null; try{seen=localStorage.getItem("sipurai-entry-seen-v1");}catch(e){}
        if(rm||seen){ if(el.parentNode)el.parentNode.removeChild(el); return; }
        /* Storage blocked (private mode) -> skip entirely, never replay per navigation. */
        try{localStorage.setItem("sipurai-entry-seen-v1","1");}catch(e){ if(el.parentNode)el.parentNode.removeChild(el); return; }
        el.hidden=false;
        el.classList.add("go");
        function gone(){ if(el&&el.parentNode)el.parentNode.removeChild(el); el=null; }
        el.addEventListener("animationend",function(ev){ if(ev.target&&ev.target.id==="sp-entry")gone(); });
        setTimeout(gone,2600);
      }catch(e){}})();
