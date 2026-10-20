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
var REACT_FASTPATH_SOURCE = '"use strict";(()=>{var He=1440*60*1e3;function De(r){return typeof r=="object"&&r!==null&&!Array.isArray(r)}function Fe(r){return typeof r=="string"&&/^[A-Za-z0-9_-]{1,64}$/.test(r)&&!/^[\\da-f]{8}(-[\\da-f]{4}){3}-[\\da-f]{12}$/i.test(r)}function se(r){return De(r)&&[r.appId,r.frameworkId].every(Fe)}function Oe(){let r=[],c=!1,T=!1,E,h,F=()=>{var p;if(!(c||T)){for(c=!0;!T&&r.length>0;){let d=r.shift();if(!d)break;if(!d.slot.isConnected||!d.allowed())continue;let s=d.recreate(d.source),a=s.hasAttribute("type")?s.type.trim().toLowerCase():s.getAttribute("language")?`text/${(p=s.getAttribute("language"))==null?void 0:p.trim().toLowerCase()}`:"",H=a===""||/^(?:application|text)\\/(?:x-)?(?:java|ecma)script$/.test(a)||/^text\\/(?:javascript1\\.[0-5]|jscript|livescript)$/.test(a);if(s.src&&H&&!s.hasAttribute("async")&&!s.defer&&!s.noModule){let O=new MutationObserver(()=>{s.isConnected||y()}),y=()=>{E===b&&(b(),c=!1,F())},b=()=>{O.disconnect(),s.removeEventListener("load",y),s.removeEventListener("error",y),E=void 0,h=void 0};E=b,h=()=>{(!s.isConnected||!d.allowed())&&(b(),c=!1)},s.addEventListener("load",y),s.addEventListener("error",y),O.observe(d.slot.ownerDocument,{childList:!0,subtree:!0}),d.slot.replaceWith(s),s.isConnected||y();return}d.slot.replaceWith(s)}c=!1}};return{activate(p,d,s,a){let H=Array.from(p.querySelectorAll("script"),y=>{let b=document.createComment("1c-script");return y.replaceWith(b),{source:y,slot:b,allowed:s,recreate:a}}),O=!c;c=!0,r.push(...H);try{d(p)}finally{O&&(c=!1),F()}},setPaused(p){T=p},recheck(){if(!T){h==null||h();for(let p=r.length-1;p>=0;p--){let d=r[p];d&&(!d.slot.isConnected||!d.allowed())&&r.splice(p,1)}}},flush:F,clear(){r.length=0,E==null||E(),c=!1}}}(()=>{var he,be,Te,Ce,Ie,Ne,ve;let r=window,c=document,T=["data-1c-service","data-1c-service-tag","data-1c-tag"],E="data-1c-category",h="data-1c-resolved",F="data-1c-once",p="1consent:config",d=33696e6,s=T.concat(E).map(e=>`template[${e}]:not([${h}])`).join(","),a=e=>typeof e=="object"&&e!==null&&!Array.isArray(e),H=e=>{let t=2166136261;for(let n=0;n<e.length;n++)t^=e.charCodeAt(n),t=t+((t<<1)+(t<<4)+(t<<7)+(t<<8)+(t<<24))>>>0;return t.toString(36)},O=e=>{var o,i;let t=((o=e.services)!=null?o:[]).map(u=>{var m,l,D;return`${u.id}\\0${(m=u.name)!=null?m:""}\\0${(l=u.tag)!=null?l:""}\\0${(D=u.categoryId)!=null?D:""}\\0${u.essential?1:0}${u.catalogServiceKey?`\\0k\\0${u.catalogServiceKey}`:""}${u.usSensitive?"\\x001":""}`}).sort(),n=((i=e.categories)!=null?i:[]).map(u=>`${u.id}\\0${u.name}\\0${u.essential?1:0}`).sort();return H(`s:${t.join("")}|c:${n.join("")}`)},y=((he=c.currentScript)==null?void 0:he.getAttribute("data-1c-app-id"))||"",b=((be=c.currentScript)==null?void 0:be.getAttribute("data-1c-framework-versions"))||"{}",q={};try{q=JSON.parse(b)}catch{}let f=r.__1CONSENT_CONFIG__,j=f==null?void 0:f.publicIdentity,z=(Te=f==null?void 0:f.consentEpoch)!=null?Te:0,R=f==null?void 0:f.framework.type,w=f==null?void 0:f.machine,$=(Ce=f==null?void 0:f.languages)==null?void 0:Ce.primary,N=f!==void 0&&se(j)&&j.appId===y&&(R==="gdpr"||R==="tcf"||R==="us")&&(w==="P"||w==="S"||w==="D")&&typeof $=="string"&&$.length>0&&Number.isSafeInteger(z)&&z>=0,g=N?f:void 0,k=(Ie=g==null?void 0:g.appId)!=null?Ie:"",P=(Ne=g==null?void 0:g.framework.id)!=null?Ne:"",V=N&&R!=null?R:"",G=N&&w!=null?w:"",B=N&&$!=null?$:"",ie=N?j.appId:"",J=N?j.frameworkId:"",ce=a(q)?q[J]:void 0,L=typeof ce=="string"?ce:"",v=N?z:-1,ae=JSON.stringify([k,P,ie,J,V,G,B,L,v]),Y=!1,X=!1,Q,Z,ee,ue=!1,le=()=>{var e,t;try{let n=r.__1CONSENT_CONFIG__;return Y||X||!n||k.length===0||P.length===0||v<0||n.appId!==k||n.framework.id!==P||!se(n.publicIdentity)||n.publicIdentity.appId!==ie||n.publicIdentity.frameworkId!==J||n.framework.type!==V||n.machine!==G||((e=n.languages)==null?void 0:e.primary)!==B||((t=n.consentEpoch)!=null?t:0)!==v||L.length===0?!1:((n!==Q||n.services!==Z||n.categories!==ee)&&(Q=n,Z=n.services,ee=n.categories,ue=O(n)===L),ue)}catch{return!1}},A=r.__1CONSENT_REACT_FASTPATH__;if(A){try{if(A.runtimeKey===ae&&A.supportsPendingConsent===!0&&typeof A.updateConsent=="function"&&typeof A.promote=="function"&&le()&&typeof A.reconcile=="function"&&A.reconcile())return}catch{}try{typeof A.destroy=="function"&&A.destroy()}catch{}r.__1CONSENT_REACT_FASTPATH__===A&&delete r.__1CONSENT_REACT_FASTPATH__}let _=null,S=null,x,de=!1,C,M=Oe(),U,te=()=>{},I=()=>Y||X?!1:le()?!0:(X=!0,M.clear(),_=null,S=null,C==null||C.disconnect(),te(),r.__1CONSENT_REACT_FASTPATH__===U&&delete r.__1CONSENT_REACT_FASTPATH__,!1),fe=new Set,pe=e=>{if(!e||typeof e!="object")return!1;for(let t of Object.values(e))if(typeof t!="boolean")return!1;return!0},Re=()=>navigator.globalPrivacyControl===!0;try{let e=localStorage.getItem("1consent");if(e&&k&&P&&L&&v>=0){let t=Date.now(),n=t+d,o=JSON.parse(e),i=a(o)&&a(o.apps)?o.apps[k]:void 0,u=a(i)?i.frameworks:void 0,m=a(u)?u[P]:void 0,l=a(m)?m.fastPath:void 0,D=a(m)?m.consent:void 0,oe=a(m)&&"consentEpoch"in m?m.consentEpoch:0,xe=a(m)&&m.type===V&&m.machine===G&&typeof oe=="number"&&Number.isSafeInteger(oe)&&oe>=v&&m.primaryLanguage===B,W=(g==null?void 0:g.framework.type)==="tcf"?(ve=r.__1cTcf)==null?void 0:ve.tcData:void 0,Me=(g==null?void 0:g.framework.type)!=="tcf"||a(D)&&typeof D.tcString=="string"&&(W==null?void 0:W.eventStatus)==="tcloaded"&&W.tcString===D.tcString;a(o)&&o.schemaVersion===1&&xe&&a(l)&&l.structuralVersion===L&&typeof l.consentEpoch=="number"&&Number.isSafeInteger(l.consentEpoch)&&l.consentEpoch>=v&&Number.isSafeInteger(t)&&t>=0&&Number.isSafeInteger(n)&&typeof l.expiresAt=="number"&&Number.isSafeInteger(l.expiresAt)&&l.expiresAt>=t&&l.expiresAt<=n&&pe(l.services)&&Me&&!(l.gpcRevocable===!0&&Re())&&(x=l.expiresAt,_=l.services,S=pe(l.categories)?l.categories:{})}}catch{}let we=e=>{for(let t of T){let n=e.getAttribute(t);if(n!==null)return n}return e.getAttribute(E)},me=e=>{if(de||x!==void 0&&Date.now()>x)return!1;for(let n of T){let o=e.getAttribute(n);if(o!==null)return _!==null&&_[o]===!0}let t=e.getAttribute(E);return t!==null?S!==null&&S[t]===!0:!1},ke=e=>{let t=c.createElement("script");for(let n of e.attributes)t.setAttribute(n.name,n.value);return e.src?e.hasAttribute("async")||(t.async=!1):t.text=e.text||"",t},K=e=>{if(!I()||e.hasAttribute(h)||!me(e))return!1;e.setAttribute(h,"");let t=e.getAttribute(F);if(t!==null){if(fe.has(t))return!1;fe.add(t)}let n=e.content.cloneNode(!0);return n instanceof DocumentFragment?(M.activate(n,o=>e.after(o),()=>e.isConnected&&I()&&me(e),ke),!0):!1},ne=e=>e instanceof HTMLTemplateElement,ge=8,Pe=()=>new Promise(e=>{let t=r.scheduler;t!=null&&t.postTask?t.postTask(e,{priority:"user-visible"}):setTimeout(e,0)}),re=e=>{if(!I())return[];let t=[];for(let i of e.querySelectorAll(s))ne(i)&&t.push(i);let n=[],o=0;for(;o<t.length&&o<ge;o++){let i=t[o];if(i&&K(i)){let u=we(i);u!==null&&n.push(u)}}return o<t.length&&(async()=>{for(;o<t.length;o++){o%ge===0&&await Pe();let i=t[o];if(i)try{K(i)}catch{}}})(),n},ye=!1,_e=()=>I()?c.readyState!=="loading"?re(c):(ye||(ye=!0,c.addEventListener("DOMContentLoaded",()=>re(c),{once:!0})),[]):[];C=new MutationObserver(e=>{if(!(!I()||c.readyState==="loading"||_===null&&S===null))for(let t of e)for(let n of t.addedNodes)ne(n)?K(n):n instanceof Element&&re(n)}),C.observe(c.documentElement,{childList:!0,subtree:!0});let Se=()=>{Q=void 0,Z=void 0,ee=void 0,I()},Le=()=>{Y=!0,M.clear(),_=null,S=null,C==null||C.disconnect(),te(),r.__1CONSENT_REACT_FASTPATH__===U&&delete r.__1CONSENT_REACT_FASTPATH__},Ee=(e,t,n,o=!1)=>{if(I()){de=o,M.setPaused(o),x!==void 0&&Date.now()>x&&(_=null,S=null),n!==void 0&&(x=n===0?void 0:n),_=_||{},S=S||{};for(let i of Object.keys(e))_[i]=e[i]===!0;if(t)for(let i of Object.keys(t))S[i]=t[i]===!0;M.recheck()}},Ae=()=>(M.flush(),_e());U={appId:k,frameworkId:P,frameworkType:V,machine:G,primaryLanguage:B,structuralVersion:L,consentEpoch:v,runtimeKey:ae,apply(e,t){return Ee(e,t),Ae()},supportsPendingConsent:!0,updateConsent:Ee,promote:Ae,resolve(e){return e!==null&&ne(e)?K(e):!1},reconcile:I,destroy:Le},r.__1CONSENT_REACT_FASTPATH__=U,r.addEventListener(p,Se),te=()=>r.removeEventListener(p,Se),(_!==null||S!==null)&&_e()})();})();';

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
