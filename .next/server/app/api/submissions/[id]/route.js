"use strict";(()=>{var e={};e.id=130,e.ids=[130],e.modules={2934:e=>{e.exports=require("next/dist/client/components/action-async-storage.external.js")},4580:e=>{e.exports=require("next/dist/client/components/request-async-storage.external.js")},5869:e=>{e.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},4300:e=>{e.exports=require("buffer")},6113:e=>{e.exports=require("crypto")},2361:e=>{e.exports=require("events")},7147:e=>{e.exports=require("fs")},3685:e=>{e.exports=require("http")},5687:e=>{e.exports=require("https")},1808:e=>{e.exports=require("net")},2037:e=>{e.exports=require("os")},1017:e=>{e.exports=require("path")},2781:e=>{e.exports=require("stream")},4404:e=>{e.exports=require("tls")},7310:e=>{e.exports=require("url")},3837:e=>{e.exports=require("util")},9796:e=>{e.exports=require("zlib")},5650:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>x,patchFetch:()=>_,requestAsyncStorage:()=>f,routeModule:()=>m,serverHooks:()=>b,staticGenerationAsyncStorage:()=>L});var n={};r.r(n),r.d(n,{DELETE:()=>g,GET:()=>N,PATCH:()=>E,dynamic:()=>l});var i=r(9303),s=r(8716),a=r(670),o=r(7070),u=r(1615),c=r(4191),d=r(7999),p=r(9074);let l="force-dynamic";function T(){let e=u.cookies().get("teacher_session")?.value;return(0,d.mc)(e)}async function N(e,{params:t}){await (0,c.a)();let{rows:r}=await (0,c.i)`
    SELECT student_name, objective_band, grammar_score, grammar_total,
           reading_score, reading_total, listening_score, listening_total,
           writing_word_count, writing_band, writing_feedback, final_band, graded
    FROM submissions WHERE id = ${t.id} LIMIT 1
  `;return 0===r.length?o.NextResponse.json({error:"Kh\xf4ng t\xecm thấy b\xe0i l\xe0m."},{status:404}):o.NextResponse.json(r[0])}async function g(e,{params:t}){if(!T())return o.NextResponse.json({error:"Bạn cần đăng nhập với vai tr\xf2 gi\xe1o vi\xean."},{status:401});await (0,c.a)();let{rowCount:r}=await (0,c.i)`DELETE FROM submissions WHERE id = ${t.id}`;return 0===r?o.NextResponse.json({error:"Kh\xf4ng t\xecm thấy b\xe0i l\xe0m."},{status:404}):o.NextResponse.json({ok:!0})}async function E(e,{params:t}){if(!T())return o.NextResponse.json({error:"Bạn cần đăng nhập với vai tr\xf2 gi\xe1o vi\xean."},{status:401});await (0,c.a)();let r=await e.json(),n=Number(r.writingBand),i=(r.writingFeedback||"").toString().slice(0,4e3);if(Number.isNaN(n)||n<0||n>9)return o.NextResponse.json({error:"Điểm Writing phải trong khoảng 0–9."},{status:400});let{rows:s}=await (0,c.i)`SELECT objective_band FROM submissions WHERE id = ${t.id} LIMIT 1`;if(0===s.length)return o.NextResponse.json({error:"Kh\xf4ng t\xecm thấy b\xe0i l\xe0m."},{status:404});let a=(0,p.nr)((Number(s[0].objective_band)+n)/2);return await (0,c.i)`
    UPDATE submissions
    SET writing_band = ${n},
        writing_feedback = ${i},
        final_band = ${a},
        graded = TRUE,
        graded_at = now()
    WHERE id = ${t.id}
  `,o.NextResponse.json({ok:!0,finalBand:a})}let m=new i.AppRouteRouteModule({definition:{kind:s.x.APP_ROUTE,page:"/api/submissions/[id]/route",pathname:"/api/submissions/[id]",filename:"route",bundlePath:"app/api/submissions/[id]/route"},resolvedPagePath:"/workspaces/IELTS-PLACEMENT-TEST/app/api/submissions/[id]/route.js",nextConfigOutput:"",userland:n}),{requestAsyncStorage:f,staticGenerationAsyncStorage:L,serverHooks:b}=m,x="/api/submissions/[id]/route";function _(){return(0,a.patchFetch)({serverHooks:b,staticGenerationAsyncStorage:L})}},7999:(e,t,r)=>{r.d(t,{Ls:()=>c,mc:()=>u,nH:()=>d,rs:()=>o});var n=r(6113),i=r.n(n);let s="teacher_session";function a(e){return i().createHmac("sha256",process.env.SESSION_SECRET||"dev-only-insecure-secret").update(e).digest("hex")}function o(){let e=Date.now()+288e5,t=Buffer.from(JSON.stringify({exp:e})).toString("base64url");return`${t}.${a(t)}`}function u(e){if(!e||"string"!=typeof e)return!1;let[t,r]=e.split(".");if(!t||!r||a(t)!==r)return!1;try{let e=JSON.parse(Buffer.from(t,"base64url").toString());return"number"==typeof e.exp&&e.exp>Date.now()}catch{return!1}}let c={name:s,maxAge:28800};function d(){let{cookies:e}=r(1615),{redirect:t}=r(8585);u(e().get(s)?.value)||t("/teacher/login")}},4191:(e,t,r)=>{r.d(t,{a:()=>s,i:()=>n.i6});var n=r(8462);let i=!1;async function s(){i||(await (0,n.i6)`
    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      student_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      answers JSONB NOT NULL,
      grammar_score INT NOT NULL,
      grammar_total INT NOT NULL,
      reading_score INT NOT NULL,
      reading_total INT NOT NULL,
      listening_score INT NOT NULL,
      listening_total INT NOT NULL,
      objective_band NUMERIC NOT NULL,
      writing_text TEXT NOT NULL,
      writing_word_count INT NOT NULL,
      writing_band NUMERIC,
      writing_feedback TEXT,
      final_band NUMERIC,
      graded BOOLEAN NOT NULL DEFAULT FALSE,
      graded_at TIMESTAMPTZ,
      content_snapshot JSONB
    );
  `,await (0,n.i6)`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS content_snapshot JSONB;`,await (0,n.i6)`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `,i=!0)}},9074:(e,t,r)=>{function n(e,t){let r=t>0?e/t:0;return r>=.9?8:r>=.75?7:r>=.6?6:r>=.45?5:r>=.25?4:3}function i(e){return Math.round(2*e)/2}r.d(t,{ic:()=>n,nr:()=>i})},8238:(e,t)=>{Object.defineProperty(t,"__esModule",{value:!0}),Object.defineProperty(t,"ReflectAdapter",{enumerable:!0,get:function(){return r}});class r{static get(e,t,r){let n=Reflect.get(e,t,r);return"function"==typeof n?n.bind(e):n}static set(e,t,r,n){return Reflect.set(e,t,r,n)}static has(e,t){return Reflect.has(e,t)}static deleteProperty(e,t){return Reflect.deleteProperty(e,t)}}}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),n=t.X(0,[948,54,462,972],()=>r(5650));module.exports=n})();