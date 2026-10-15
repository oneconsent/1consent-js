// ../../shared/dist/public-package-urls.js
var PUBLIC_PACKAGE_SERVICE_URLS = {
  local: {
    dashboard: "https://dashboard.1consent.local",
    cmpApi: "https://cmp.1consent.local",
    cmpBootstrap: "https://web.cmp.1consent.local"
  },
  develop: {
    dashboard: "https://dashboard.1consent.dev",
    cmpApi: "https://cmp.1consent.dev",
    cmpBootstrap: "https://web.cmp.1consent.dev"
  },
  production: {
    dashboard: "https://dashboard.1consent.app",
    cmpApi: "https://cmp.1consent.app",
    cmpBootstrap: "https://web.cmp.1consent.app"
  }
};
function detectPublicPackageEnvironment() {
  const explicit = (typeof process !== "undefined" && (process.env?.APP_ENV || process.env?.NEXT_PUBLIC_APP_ENV) || "").toLowerCase();
  if (explicit === "local" || explicit === "develop" || explicit === "production") {
    return explicit;
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) {
      return "local";
    }
    if (host === "1consent.dev" || host.endsWith(".1consent.dev") || host.includes("develop") || host.includes("preview")) {
      return "develop";
    }
    return "production";
  }
  const nodeEnv = process.env?.NODE_ENV;
  if (nodeEnv === "development" || nodeEnv === "test")
    return "local";
  if (process.env?.VERCEL_ENV === "preview")
    return "develop";
  return "production";
}
function getPublicPackageServiceUrls(env) {
  return PUBLIC_PACKAGE_SERVICE_URLS[env ?? detectPublicPackageEnvironment()];
}
var PUBLISH_STAGE_SUFFIX = {
  preview: "preview.js",
  live: "js",
  staging: "staging.js"
};
function getCmpScriptUrl(appId, opts = {}) {
  const stage = opts.stage ?? "live";
  if (opts.frameworkId && stage !== "preview") {
    throw new Error("Framework override is available in Preview only");
  }
  const urls = getPublicPackageServiceUrls(opts.env);
  const baseUrl = stage === "preview" ? urls.cmpApi : opts.edge === false ? urls.cmpApi : urls.cmpBootstrap;
  const base = `${baseUrl}/id/${appId}.${PUBLISH_STAGE_SUFFIX[stage]}`;
  return opts.frameworkId ? `${base}?frameworkId=${opts.frameworkId}` : base;
}

// ../../contracts/dist/consent-fastpath.js
var SERVICE_TEMPLATE_ATTRS = ["data-1c-service", "data-1c-service-tag", "data-1c-tag"];
var CATEGORY_TEMPLATE_ATTR = "data-1c-category";
var ONCE_TEMPLATE_ATTR = "data-1c-once";
function fnv1a36(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) >>> 0;
  }
  return hash.toString(36);
}

// src/serialize.ts
import { Children, isValidElement } from "react";
var VOID_ELEMENTS = /* @__PURE__ */ new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr"
]);
var RAW_TEXT_ELEMENTS = /* @__PURE__ */ new Set(["script", "style"]);
var SKIPPED_PROPS = /* @__PURE__ */ new Set(["children", "key", "ref", "dangerouslySetInnerHTML"]);
var PROP_TO_ATTR = {
  className: "class",
  htmlFor: "for",
  acceptCharset: "accept-charset",
  httpEquiv: "http-equiv"
};
var UNITLESS_STYLE_PROPS = /* @__PURE__ */ new Set([
  "animationIterationCount",
  "aspectRatio",
  "columnCount",
  "columns",
  "flex",
  "flexGrow",
  "flexShrink",
  "fontWeight",
  "gridArea",
  "gridColumn",
  "gridColumnEnd",
  "gridColumnStart",
  "gridRow",
  "gridRowEnd",
  "gridRowStart",
  "lineClamp",
  "lineHeight",
  "opacity",
  "order",
  "orphans",
  "scale",
  "tabSize",
  "widows",
  "zIndex",
  "zoom"
]);
var VALID_ATTR_NAME = /^[a-zA-Z_][a-zA-Z0-9_:.-]*$/;
function escapeText(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttribute(value) {
  return escapeText(value).replace(/"/g, "&quot;");
}
function attributeName(prop) {
  const mapped = PROP_TO_ATTR[prop];
  if (mapped) return mapped;
  return prop.toLowerCase();
}
function serializeStyle(style) {
  const declarations = [];
  for (const [prop, value] of Object.entries(style)) {
    if (value === null || value === void 0 || value === "") continue;
    const cssProp = prop.startsWith("--") ? prop : prop.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`);
    const css = typeof value === "number" && value !== 0 && !UNITLESS_STYLE_PROPS.has(prop) ? `${value}px` : String(value);
    declarations.push(`${cssProp}:${css}`);
  }
  return declarations.join(";");
}
function isPlainObject(x) {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}
function serializeProps(tag, props) {
  let html = "";
  for (const [prop, value] of Object.entries(props)) {
    if (SKIPPED_PROPS.has(prop)) continue;
    if (value === null || value === void 0 || value === false) continue;
    if (typeof value === "function") {
      throw new Error(
        `[1Consent] <OneConsent> children cannot carry event handlers or function props (found "${prop}" on <${tag}>). Consent-gated content is inert HTML \u2014 attach behavior inside the script itself.`
      );
    }
    if (prop === "style") {
      if (!isPlainObject(value)) continue;
      const css = serializeStyle(value);
      if (css) html += ` style="${escapeAttribute(css)}"`;
      continue;
    }
    const attr = attributeName(prop);
    if (!VALID_ATTR_NAME.test(attr)) {
      throw new Error(
        `[1Consent] Invalid attribute name "${prop}" on <${tag}> inside <OneConsent> \u2014 attribute names must match ${String(VALID_ATTR_NAME)}.`
      );
    }
    if (value === true) {
      html += ` ${attr}`;
    } else {
      html += ` ${attr}="${escapeAttribute(String(value))}"`;
    }
  }
  return html;
}
function serializeNode(node, rawText) {
  if (node === null || node === void 0 || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") {
    const text = String(node);
    if (rawText) {
      if (/<\/(script|style)/i.test(text)) {
        throw new Error(
          "[1Consent] Inline script/style content must not contain a closing `</script>`/`</style>` sequence \u2014 split or escape it (e.g. `<\\/script>`)."
        );
      }
      return text;
    }
    return escapeText(text);
  }
  if (Array.isArray(node)) {
    return node.map((child) => serializeNode(child, rawText)).join("");
  }
  if (isValidElement(node)) {
    const { type } = node;
    if (typeof type !== "string") {
      throw new Error(
        "[1Consent] <OneConsent> children must be plain HTML elements (<script>, <iframe>, <img>, \u2026). Component children cannot be gated as inert HTML \u2014 wrap the component's own output instead."
      );
    }
    const props = isPlainObject(node.props) ? node.props : {};
    const tag = type.toLowerCase();
    let html = `<${tag}${serializeProps(tag, props)}>`;
    if (VOID_ELEMENTS.has(tag)) return html;
    const innerHtml = props.dangerouslySetInnerHTML;
    if (isPlainObject(innerHtml) && typeof innerHtml.__html === "string") {
      html += innerHtml.__html;
    } else if ("children" in props && props.children !== void 0) {
      if (!isReactNode(props.children)) {
        throw new Error(
          `[1Consent] Unsupported children on <${tag}> inside <OneConsent> \u2014 expected plain HTML, text, or arrays thereof.`
        );
      }
      html += serializeNode(props.children, RAW_TEXT_ELEMENTS.has(tag));
    }
    return `${html}</${tag}>`;
  }
  throw new Error("[1Consent] Unsupported child in <OneConsent> \u2014 expected plain HTML.");
}
function isReactNode(x) {
  return x === null || x === void 0 || typeof x === "string" || typeof x === "number" || typeof x === "boolean" || Array.isArray(x) || isValidElement(x);
}
function serializeChildren(children) {
  return Children.toArray(children).map((child) => serializeNode(child, false)).join("");
}

// src/one-consent.tsx
import { jsx } from "react/jsx-runtime";
var SERVICE_ATTR = SERVICE_TEMPLATE_ATTRS[0] ?? "data-1c-service";
function OneConsent(props) {
  const { nonce, children } = props;
  const attr = props.service !== void 0 ? SERVICE_ATTR : CATEGORY_TEMPLATE_ATTR;
  const key = props.service !== void 0 ? props.service : props.category;
  if (typeof key !== "string" || key.length === 0) {
    throw new Error(
      "[1Consent] <OneConsent> requires a non-empty `service` or `category` prop."
    );
  }
  const content = serializeChildren(children);
  if (/<\/template/i.test(content)) {
    throw new Error(
      "[1Consent] <OneConsent> children must not contain a nested `</template>`."
    );
  }
  const onceAttr = props.once ? ` ${ONCE_TEMPLATE_ATTR}="${fnv1a36(`${attr}=${key}|${content}`)}"` : "";
  const nonceAttr = nonce ? ` nonce="${escapeAttribute(nonce)}"` : "";
  const html = `<template ${attr}="${escapeAttribute(key)}"${onceAttr}>${content}</template><script${nonceAttr}>window.__1CONSENT_REACT_FASTPATH__&&window.__1CONSENT_REACT_FASTPATH__.resolve(document.currentScript.previousElementSibling);</script>`;
  return /* @__PURE__ */ jsx(
    "div",
    {
      "data-1c-slot": "",
      style: { display: "contents" },
      suppressHydrationWarning: true,
      dangerouslySetInnerHTML: { __html: html }
    }
  );
}

// ../react-fastpath/dist/generated/engine-source.js
var REACT_FASTPATH_SOURCE = '"use strict";(()=>{function ve(){let o=[],c=!1,E=!1,h,b,F=()=>{var f;if(!(c||E)){for(c=!0;!E&&o.length>0;){let d=o.shift();if(!d)break;if(!d.slot.isConnected||!d.allowed())continue;let s=d.recreate(d.source),a=s.hasAttribute("type")?s.type.trim().toLowerCase():s.getAttribute("language")?`text/${(f=s.getAttribute("language"))==null?void 0:f.trim().toLowerCase()}`:"",H=a===""||/^(?:application|text)\\/(?:x-)?(?:java|ecma)script$/.test(a)||/^text\\/(?:javascript1\\.[0-5]|jscript|livescript)$/.test(a);if(s.src&&H&&!s.hasAttribute("async")&&!s.defer&&!s.noModule){let w=new MutationObserver(()=>{s.isConnected||m()}),m=()=>{h===A&&(A(),c=!1,F())},A=()=>{w.disconnect(),s.removeEventListener("load",m),s.removeEventListener("error",m),h=void 0,b=void 0};h=A,b=()=>{(!s.isConnected||!d.allowed())&&(A(),c=!1)},s.addEventListener("load",m),s.addEventListener("error",m),w.observe(d.slot.ownerDocument,{childList:!0,subtree:!0}),d.slot.replaceWith(s),s.isConnected||m();return}d.slot.replaceWith(s)}c=!1}};return{activate(f,d,s,a){let H=Array.from(f.querySelectorAll("script"),m=>{let A=document.createComment("1c-script");return m.replaceWith(A),{source:m,slot:A,allowed:s,recreate:a}}),w=!c;c=!0,o.push(...H);try{d(f)}finally{w&&(c=!1),F()}},setPaused(f){E=f},recheck(){if(!E){b==null||b();for(let f=o.length-1;f>=0;f--){let d=o[f];d&&(!d.slot.isConnected||!d.allowed())&&o.splice(f,1)}}},flush:F,clear(){o.length=0,h==null||h(),c=!1}}}(()=>{var _e,ye,he,Se,be,Ae,Te,Ee;let o=window,c=document,E=["data-1c-service","data-1c-service-tag","data-1c-tag"],h="data-1c-category",b="data-1c-resolved",F="data-1c-once",f="1consent:config",d=33696e6,s=E.concat(h).map(e=>`template[${e}]:not([${b}])`).join(","),a=e=>typeof e=="object"&&e!==null&&!Array.isArray(e),H=e=>{let t=2166136261;for(let n=0;n<e.length;n++)t^=e.charCodeAt(n),t=t+((t<<1)+(t<<4)+(t<<7)+(t<<8)+(t<<24))>>>0;return t.toString(36)},w=e=>{var r,i;let t=((r=e.services)!=null?r:[]).map(l=>{var g,u,M;return`${l.id}\\0${(g=l.name)!=null?g:""}\\0${(u=l.tag)!=null?u:""}\\0${(M=l.categoryId)!=null?M:""}\\0${l.essential?1:0}${l.catalogServiceKey?`\\0k\\0${l.catalogServiceKey}`:""}${l.usSensitive?"\\x001":""}`}).sort(),n=((i=e.categories)!=null?i:[]).map(l=>`${l.id}\\0${l.name}\\0${l.essential?1:0}`).sort();return H(`s:${t.join("")}|c:${n.join("")}`)},m=((_e=c.currentScript)==null?void 0:_e.getAttribute("data-1c-app-id"))||"",A=((ye=c.currentScript)==null?void 0:ye.getAttribute("data-1c-framework-versions"))||"{}",q={};try{q=JSON.parse(A)}catch{}let p=o.__1CONSENT_CONFIG__,J=(he=p==null?void 0:p.consentEpoch)!=null?he:0,k=p==null?void 0:p.framework.type,O=p==null?void 0:p.machine,D=(Se=p==null?void 0:p.languages)==null?void 0:Se.primary,j=p!==void 0&&p.appId===m&&(k==="gdpr"||k==="tcf"||k==="us")&&(O==="P"||O==="S"||O==="D")&&typeof D=="string"&&D.length>0&&Number.isSafeInteger(J)&&J>=0,T=j?p:void 0,P=(be=T==null?void 0:T.appId)!=null?be:"",N=(Ae=T==null?void 0:T.framework.id)!=null?Ae:"",V=j&&k!=null?k:"",x=j&&O!=null?O:"",K=j&&D!=null?D:"",ne=a(q)?q[N]:void 0,I=typeof ne=="string"?ne:"",R=j?J:-1,re=JSON.stringify([P,N,V,x,K,I,R]),B=!1,Q=!1,U,X,Y,oe=!1,se=()=>{var e,t;try{let n=o.__1CONSENT_CONFIG__;return B||Q||!n||P.length===0||N.length===0||R<0||n.appId!==P||n.framework.id!==N||n.framework.type!==V||n.machine!==x||((e=n.languages)==null?void 0:e.primary)!==K||((t=n.consentEpoch)!=null?t:0)!==R||I.length===0?!1:((n!==U||n.services!==X||n.categories!==Y)&&(U=n,X=n.services,Y=n.categories,oe=w(n)===I),oe)}catch{return!1}},S=o.__1CONSENT_REACT_FASTPATH__;if(S){try{if(S.runtimeKey===re&&S.supportsPendingConsent===!0&&typeof S.updateConsent=="function"&&typeof S.promote=="function"&&se()&&typeof S.reconcile=="function"&&S.reconcile())return}catch{}try{typeof S.destroy=="function"&&S.destroy()}catch{}o.__1CONSENT_REACT_FASTPATH__===S&&delete o.__1CONSENT_REACT_FASTPATH__}let _=null,y=null,L,ie=!1,v,$=ve(),G,z=()=>{},C=()=>B||Q?!1:se()?!0:(Q=!0,$.clear(),_=null,y=null,v==null||v.disconnect(),z(),o.__1CONSENT_REACT_FASTPATH__===G&&delete o.__1CONSENT_REACT_FASTPATH__,!1),ce=new Set,ae=e=>{if(!e||typeof e!="object")return!1;for(let t of Object.values(e))if(typeof t!="boolean")return!1;return!0},Ce=()=>navigator.globalPrivacyControl===!0;try{let e=localStorage.getItem("1consent");if(e&&P&&N&&I&&R>=0){let t=Date.now(),n=t+d,r=JSON.parse(e),i=a(r)&&a(r.apps)?r.apps[P]:void 0,l=a(i)?i.frameworks:void 0,g=a(l)?l[N]:void 0,u=a(g)?g.fastPath:void 0,M=a(g)?g.consent:void 0,te=a(g)&&"consentEpoch"in g?g.consentEpoch:0,Oe=a(g)&&g.type===V&&g.machine===x&&typeof te=="number"&&Number.isSafeInteger(te)&&te>=R&&g.primaryLanguage===K,Pe=(T==null?void 0:T.framework.type)!=="tcf"||a(M)&&typeof M.tcString=="string"&&((Ee=(Te=o.__1cTcf)==null?void 0:Te.tcData)==null?void 0:Ee.eventStatus)==="tcloaded"&&o.__1cTcf.tcData.tcString===M.tcString;a(r)&&r.schemaVersion===1&&Oe&&a(u)&&u.structuralVersion===I&&typeof u.consentEpoch=="number"&&Number.isSafeInteger(u.consentEpoch)&&u.consentEpoch>=R&&Number.isSafeInteger(t)&&t>=0&&Number.isSafeInteger(n)&&typeof u.expiresAt=="number"&&Number.isSafeInteger(u.expiresAt)&&u.expiresAt>=t&&u.expiresAt<=n&&ae(u.services)&&Pe&&!(u.gpcRevocable===!0&&Ce())&&(L=u.expiresAt,_=u.services,y=ae(u.categories)?u.categories:{})}}catch{}let Ne=e=>{for(let t of E){let n=e.getAttribute(t);if(n!==null)return n}return e.getAttribute(h)},le=e=>{if(ie||L!==void 0&&Date.now()>L)return!1;for(let n of E){let r=e.getAttribute(n);if(r!==null)return _!==null&&_[r]===!0}let t=e.getAttribute(h);return t!==null?y!==null&&y[t]===!0:!1},Re=e=>{let t=c.createElement("script");for(let n of e.attributes)t.setAttribute(n.name,n.value);return e.src?e.hasAttribute("async")||(t.async=!1):t.text=e.text||"",t},W=e=>{if(!C()||e.hasAttribute(b)||!le(e))return!1;e.setAttribute(b,"");let t=e.getAttribute(F);if(t!==null){if(ce.has(t))return!1;ce.add(t)}let n=e.content.cloneNode(!0);return n instanceof DocumentFragment?($.activate(n,r=>e.after(r),()=>e.isConnected&&C()&&le(e),Re),!0):!1},Z=e=>e instanceof HTMLTemplateElement,ue=8,we=()=>new Promise(e=>{let t=o.scheduler;t!=null&&t.postTask?t.postTask(e,{priority:"user-visible"}):setTimeout(e,0)}),ee=e=>{if(!C())return[];let t=[];for(let i of e.querySelectorAll(s))Z(i)&&t.push(i);let n=[],r=0;for(;r<t.length&&r<ue;r++){let i=t[r];if(i&&W(i)){let l=Ne(i);l!==null&&n.push(l)}}return r<t.length&&(async()=>{for(;r<t.length;r++){r%ue===0&&await we();let i=t[r];if(i)try{W(i)}catch{}}})(),n},de=!1,fe=()=>C()?c.readyState!=="loading"?ee(c):(de||(de=!0,c.addEventListener("DOMContentLoaded",()=>ee(c),{once:!0})),[]):[];v=new MutationObserver(e=>{if(!(!C()||c.readyState==="loading"||_===null&&y===null))for(let t of e)for(let n of t.addedNodes)Z(n)?W(n):n instanceof Element&&ee(n)}),v.observe(c.documentElement,{childList:!0,subtree:!0});let pe=()=>{U=void 0,X=void 0,Y=void 0,C()},ke=()=>{B=!0,$.clear(),_=null,y=null,v==null||v.disconnect(),z(),o.__1CONSENT_REACT_FASTPATH__===G&&delete o.__1CONSENT_REACT_FASTPATH__},ge=(e,t,n,r=!1)=>{if(C()){ie=r,$.setPaused(r),L!==void 0&&Date.now()>L&&(_=null,y=null),n!==void 0&&(L=n===0?void 0:n),_=_||{},y=y||{};for(let i of Object.keys(e))_[i]=e[i]===!0;if(t)for(let i of Object.keys(t))y[i]=t[i]===!0;$.recheck()}},me=()=>($.flush(),fe());G={appId:P,frameworkId:N,frameworkType:V,machine:x,primaryLanguage:K,structuralVersion:I,consentEpoch:R,runtimeKey:re,apply(e,t){return ge(e,t),me()},supportsPendingConsent:!0,updateConsent:ge,promote:me,resolve(e){return e!==null&&Z(e)?W(e):!1},reconcile:C,destroy:ke},o.__1CONSENT_REACT_FASTPATH__=G,o.addEventListener(f,pe),z=()=>o.removeEventListener(f,pe),(_!==null||y!==null)&&fe()})();})();';

// src/provider.tsx
import { Fragment, jsx as jsx2, jsxs } from "react/jsx-runtime";
function resolveEnvAppId() {
  if (typeof process === "undefined" || !process?.env) return void 0;
  return process.env.NEXT_PUBLIC_1CONSENT_APP_ID;
}
function OneConsentProvider({
  appId,
  fastPathVersions,
  nonce,
  cmpSrc,
  // Auto-detection maps a customer's NODE_ENV=development to 1Consent's
  // internal "local" zone (unreachable outside our stack) — default to
  // production and let internal setups override explicitly.
  environment = "production",
  loadCmp = true,
  children
}) {
  const resolvedAppId = appId ?? resolveEnvAppId();
  const resolvedCmpSrc = cmpSrc ?? (resolvedAppId !== void 0 ? getCmpScriptUrl(resolvedAppId, { env: environment }) : void 0);
  if (loadCmp && resolvedCmpSrc === void 0) {
    throw new Error(
      "[1Consent] Missing App ID: pass the `appId` prop to <OneConsentProvider> or set the NEXT_PUBLIC_1CONSENT_APP_ID environment variable."
    );
  }
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    loadCmp && resolvedCmpSrc !== void 0 && /* @__PURE__ */ jsx2("script", { src: resolvedCmpSrc, nonce }),
    /* @__PURE__ */ jsx2(
      "script",
      {
        "data-1c-react-fastpath": "",
        "data-1c-app-id": resolvedAppId ?? "",
        "data-1c-framework-versions": JSON.stringify(fastPathVersions ?? {}),
        nonce,
        dangerouslySetInnerHTML: { __html: REACT_FASTPATH_SOURCE }
      }
    ),
    children
  ] });
}
export {
  OneConsent,
  OneConsentProvider
};
