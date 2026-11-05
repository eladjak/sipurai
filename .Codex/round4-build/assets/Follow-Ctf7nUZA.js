import{c as i,x as a,z as c,p as l}from"./index-CxufyEEq.js";/**
 * @license lucide-react v0.475.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y=[["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}],["line",{x1:"19",x2:"19",y1:"8",y2:"14",key:"1bvyxn"}],["line",{x1:"22",x2:"16",y1:"11",y2:"11",key:"1shjgl"}]],u=i("UserPlus",y);async function w(r){const{error:e}=await a.rpc("follow_user",{target_email:r});if(e)throw new Error(e.message)}async function p(r){const{error:e}=await a.rpc("unfollow_user",{target_email:r});if(e)throw new Error(e.message)}async function m({targetEmail:r,type:e,title:o="",message:t="",link:n=""}){const{error:s}=await a.rpc("notify_user",{target_email:r,p_type:e,p_title:o,p_message:t,p_link:n});if(s)throw new Error(s.message)}const _=c(l("follows"));export{_ as F,u as U,w as f,m as n,p as u};
