import{c as d}from"./index-CxufyEEq.js";import{g as y}from"./Core-BYCV2Ea1.js";/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const p=[["path",{d:"M5 12h14",key:"1ays0h"}]],w=d("Minus",p),u="/api/ai/tts";async function l({text:t,provider:e="openai",voice:i,format:s,instructions:n}){if(!t||typeof t!="string")throw new Error("synthesize: text required");const a=await y(),o=await fetch(u,{method:"POST",headers:{"Content-Type":"application/json",...a},body:JSON.stringify({text:t,provider:e,voice:i,format:s,instructions:n})});if(!o.ok){const h=await o.text();throw new Error(`TTS failed (${o.status}): ${h.substring(0,300)}`)}const c=o.headers.get("content-type")??"audio/mpeg",r=await o.blob();return{url:URL.createObjectURL(r),blob:r,mimeType:c}}const g={openai:["alloy","echo","fable","onyx","nova","shimmer","coral","sage"],gemini:["Kore","Charon","Fenrir","Aoede","Puck","Leda","Zephyr","Orus"]};function O(t,e="hebrew"){return t==="gemini"?e==="hebrew"||e==="yiddish"?"Aoede":"Kore":e==="hebrew"||e==="yiddish"?"shimmer":"nova"}export{w as M,g as V,O as g,l as s};
