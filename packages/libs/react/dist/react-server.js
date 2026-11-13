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
var REACT_FASTPATH_SOURCE = '"use strict";(()=>{var $e=/^[A-Za-z0-9_-]{1,64}$/;var He=/^[\\da-f]{8}(-[\\da-f]{4}){3}-[\\da-f]{12}$/i,je=(r,s,y)=>typeof r=="string"&&s.test(r)&&!(y!=null&&y.test(r)),ie=r=>je(r,$e,He);var ze=1440*60*1e3;function Ge(r){return typeof r=="object"&&r!==null&&!Array.isArray(r)}function ce(r){return Ge(r)&&ie(r.appId)&&ie(r.frameworkId)}var Ke="1consent";function Pe(r){return typeof r=="string"&&/^1consent-wix-[A-Za-z0-9]{1,64}$/.test(r)}function ae(r){var s;return(s=r.browserStorageScope)!=null?s:Ke}function ke(){let r=[],s=!1,y=!1,b,A,F=()=>{var l;if(!(s||y)){for(s=!0;!y&&r.length>0;){let f=r.shift();if(!f)break;if(!f.slot.isConnected||!f.allowed())continue;let i=f.recreate(f.source),u=i.hasAttribute("type")?i.type.trim().toLowerCase():i.getAttribute("language")?`text/${(l=i.getAttribute("language"))==null?void 0:l.trim().toLowerCase()}`:"",M=u===""||/^(?:application|text)\\/(?:x-)?(?:java|ecma)script$/.test(u)||/^text\\/(?:javascript1\\.[0-5]|jscript|livescript)$/.test(u);if(i.src&&M&&!i.hasAttribute("async")&&!i.defer&&!i.noModule){let N=new MutationObserver(()=>{i.isConnected||S()}),S=()=>{b===I&&(I(),s=!1,F())},I=()=>{N.disconnect(),i.removeEventListener("load",S),i.removeEventListener("error",S),b=void 0,A=void 0};b=I,A=()=>{(!i.isConnected||!f.allowed())&&(I(),s=!1)},i.addEventListener("load",S),i.addEventListener("error",S),N.observe(f.slot.ownerDocument,{childList:!0,subtree:!0}),f.slot.replaceWith(i),i.isConnected||S();return}f.slot.replaceWith(i)}s=!1}};return{activate(l,f,i,u){let M=Array.from(l.querySelectorAll("script"),S=>{let I=document.createComment("1c-script");return S.replaceWith(I),{source:S,slot:I,allowed:i,recreate:u}}),N=!s;s=!0,r.push(...M);try{f(l)}finally{N&&(s=!1),F()}},setPaused(l){y=l},recheck(){if(!y){A==null||A();for(let l=r.length-1;l>=0;l--){let f=r[l];f&&(!f.slot.isConnected||!f.allowed())&&r.splice(l,1)}}},flush:F,clear(){r.length=0,b==null||b(),s=!1}}}(()=>{var Te,Ce,we,Oe,Ne,Re,xe;let r=window,s=document,y=["data-1c-service","data-1c-service-tag","data-1c-tag"],b="data-1c-category",A="data-1c-resolved",F="data-1c-once",l="1consent:config",f=33696e6,i=y.concat(b).map(e=>`template[${e}]:not([${A}])`).join(","),u=e=>typeof e=="object"&&e!==null&&!Array.isArray(e),M=e=>{let t=2166136261;for(let n=0;n<e.length;n++)t^=e.charCodeAt(n),t=t+((t<<1)+(t<<4)+(t<<7)+(t<<8)+(t<<24))>>>0;return t.toString(36)},N=e=>{var o,c;let t=((o=e.services)!=null?o:[]).map(d=>{var g,p,V;return`${d.id}\\0${(g=d.name)!=null?g:""}\\0${(p=d.tag)!=null?p:""}\\0${(V=d.categoryId)!=null?V:""}\\0${d.essential?1:0}${d.catalogServiceKey?`\\0k\\0${d.catalogServiceKey}`:""}${d.usSensitive?"\\x001":""}`}).sort(),n=((c=e.categories)!=null?c:[]).map(d=>`${d.id}\\0${d.name}\\0${d.essential?1:0}`).sort();return M(`s:${t.join("")}|c:${n.join("")}`)},S=((Te=s.currentScript)==null?void 0:Te.getAttribute("data-1c-app-id"))||"",I=((Ce=s.currentScript)==null?void 0:Ce.getAttribute("data-1c-framework-versions"))||"{}",z={};try{z=JSON.parse(I)}catch{}let a=r.__1CONSENT_CONFIG__,$=a==null?void 0:a.publicIdentity,q=(we=a==null?void 0:a.consentEpoch)!=null?we:0,R=a==null?void 0:a.framework.type,x=a==null?void 0:a.machine,B=(Oe=a==null?void 0:a.languages)==null?void 0:Oe.primary,w=a!==void 0&&(a.browserStorageScope===void 0||Pe(a.browserStorageScope))&&ce($)&&$.appId===S&&(R==="gdpr"||R==="tcf"||R==="us")&&(x==="P"||x==="S"||x==="D")&&typeof B=="string"&&B.length>0&&Number.isSafeInteger(q)&&q>=0,m=w?a:void 0,P=(Ne=m==null?void 0:m.appId)!=null?Ne:"",k=(Re=m==null?void 0:m.framework.id)!=null?Re:"",H=w&&R!=null?R:"",j=w&&x!=null?x:"",G=w&&B!=null?B:"",ue=w?$.appId:"",Y=w?$.frameworkId:"",de=u(z)?z[Y]:void 0,v=typeof de=="string"?de:"",O=w?q:-1,J=ae(m!=null?m:{}),pe=JSON.stringify([J,P,k,ue,Y,H,j,G,v,O]),X=!1,Z=!1,Q,ee,te,fe=!1,le=()=>{var e,t;try{let n=r.__1CONSENT_CONFIG__;return X||Z||!n||P.length===0||k.length===0||O<0||n.appId!==P||ae(n)!==J||n.framework.id!==k||!ce(n.publicIdentity)||n.publicIdentity.appId!==ue||n.publicIdentity.frameworkId!==Y||n.framework.type!==H||n.machine!==j||((e=n.languages)==null?void 0:e.primary)!==G||((t=n.consentEpoch)!=null?t:0)!==O||v.length===0?!1:((n!==Q||n.services!==ee||n.categories!==te)&&(Q=n,ee=n.services,te=n.categories,fe=N(n)===v),fe)}catch{return!1}},h=r.__1CONSENT_REACT_FASTPATH__;if(h){try{if(h.runtimeKey===pe&&h.supportsPendingConsent===!0&&typeof h.updateConsent=="function"&&typeof h.promote=="function"&&le()&&typeof h.reconcile=="function"&&h.reconcile())return}catch{}try{typeof h.destroy=="function"&&h.destroy()}catch{}r.__1CONSENT_REACT_FASTPATH__===h&&delete r.__1CONSENT_REACT_FASTPATH__}let _=null,E=null,L,me=!1,T,D=ke(),K,ne=()=>{},C=()=>X||Z?!1:le()?!0:(Z=!0,D.clear(),_=null,E=null,T==null||T.disconnect(),ne(),r.__1CONSENT_REACT_FASTPATH__===K&&delete r.__1CONSENT_REACT_FASTPATH__,!1),ge=new Set,ye=e=>{if(!e||typeof e!="object")return!1;for(let t of Object.values(e))if(typeof t!="boolean")return!1;return!0},ve=()=>navigator.globalPrivacyControl===!0;try{let e=localStorage.getItem(J);if(e&&P&&k&&v&&O>=0){let t=Date.now(),n=t+f,o=JSON.parse(e),c=u(o)&&u(o.apps)?o.apps[P]:void 0,d=u(c)?c.frameworks:void 0,g=u(d)?d[k]:void 0,p=u(g)?g.fastPath:void 0,V=u(g)?g.consent:void 0,se=u(g)&&"consentEpoch"in g?g.consentEpoch:0,Me=u(g)&&g.type===H&&g.machine===j&&typeof se=="number"&&Number.isSafeInteger(se)&&se>=O&&g.primaryLanguage===G,W=(m==null?void 0:m.framework.type)==="tcf"?(xe=r.__1cTcf)==null?void 0:xe.tcData:void 0,Be=(m==null?void 0:m.framework.type)!=="tcf"||u(V)&&typeof V.tcString=="string"&&(W==null?void 0:W.eventStatus)==="tcloaded"&&W.tcString===V.tcString;u(o)&&o.schemaVersion===1&&Me&&u(p)&&p.structuralVersion===v&&typeof p.consentEpoch=="number"&&Number.isSafeInteger(p.consentEpoch)&&p.consentEpoch>=O&&Number.isSafeInteger(t)&&t>=0&&Number.isSafeInteger(n)&&typeof p.expiresAt=="number"&&Number.isSafeInteger(p.expiresAt)&&p.expiresAt>=t&&p.expiresAt<=n&&ye(p.services)&&Be&&!(p.gpcRevocable===!0&&ve())&&(L=p.expiresAt,_=p.services,E=ye(p.categories)?p.categories:{})}}catch{}let Le=e=>{for(let t of y){let n=e.getAttribute(t);if(n!==null)return n}return e.getAttribute(b)},Se=e=>{if(me||L!==void 0&&Date.now()>L)return!1;for(let n of y){let o=e.getAttribute(n);if(o!==null)return _!==null&&_[o]===!0}let t=e.getAttribute(b);return t!==null?E!==null&&E[t]===!0:!1},De=e=>{let t=s.createElement("script");for(let n of e.attributes)t.setAttribute(n.name,n.value);return e.src?e.hasAttribute("async")||(t.async=!1):t.text=e.text||"",t},U=e=>{if(!C()||e.hasAttribute(A)||!Se(e))return!1;e.setAttribute(A,"");let t=e.getAttribute(F);if(t!==null){if(ge.has(t))return!1;ge.add(t)}let n=e.content.cloneNode(!0);return n instanceof DocumentFragment?(D.activate(n,o=>e.after(o),()=>e.isConnected&&C()&&Se(e),De),!0):!1},re=e=>e instanceof HTMLTemplateElement,_e=8,Ve=()=>new Promise(e=>{let t=r.scheduler;t!=null&&t.postTask?t.postTask(e,{priority:"user-visible"}):setTimeout(e,0)}),oe=e=>{if(!C())return[];let t=[];for(let c of e.querySelectorAll(i))re(c)&&t.push(c);let n=[],o=0;for(;o<t.length&&o<_e;o++){let c=t[o];if(c&&U(c)){let d=Le(c);d!==null&&n.push(d)}}return o<t.length&&(async()=>{for(;o<t.length;o++){o%_e===0&&await Ve();let c=t[o];if(c)try{U(c)}catch{}}})(),n},Ee=!1,be=()=>C()?s.readyState!=="loading"?oe(s):(Ee||(Ee=!0,s.addEventListener("DOMContentLoaded",()=>oe(s),{once:!0})),[]):[];T=new MutationObserver(e=>{if(!(!C()||s.readyState==="loading"||_===null&&E===null))for(let t of e)for(let n of t.addedNodes)re(n)?U(n):n instanceof Element&&oe(n)}),T.observe(s.documentElement,{childList:!0,subtree:!0});let he=()=>{Q=void 0,ee=void 0,te=void 0,C()},Fe=()=>{X=!0,D.clear(),_=null,E=null,T==null||T.disconnect(),ne(),r.__1CONSENT_REACT_FASTPATH__===K&&delete r.__1CONSENT_REACT_FASTPATH__},Ae=(e,t,n,o=!1)=>{if(C()){me=o,D.setPaused(o),L!==void 0&&Date.now()>L&&(_=null,E=null),n!==void 0&&(L=n===0?void 0:n),_=_||{},E=E||{};for(let c of Object.keys(e))_[c]=e[c]===!0;if(t)for(let c of Object.keys(t))E[c]=t[c]===!0;D.recheck()}},Ie=()=>(D.flush(),be());K={appId:P,frameworkId:k,frameworkType:H,machine:j,primaryLanguage:G,structuralVersion:v,consentEpoch:O,runtimeKey:pe,apply(e,t){return Ae(e,t),Ie()},supportsPendingConsent:!0,updateConsent:Ae,promote:Ie,resolve(e){return e!==null&&re(e)?U(e):!1},reconcile:C,destroy:Fe},r.__1CONSENT_REACT_FASTPATH__=K,r.addEventListener(l,he),ne=()=>r.removeEventListener(l,he),(_!==null||E!==null)&&be()})();})();';

// src/provider.tsx
import { Fragment, jsx as jsx2, jsxs } from "react/jsx-runtime";
function resolveEnvAppId() {
  if (typeof process === "undefined" || !process?.env) return void 0;
  return process.env.NEXT_PUBLIC_1CONSENT_APP_ID;
}
function resolveProviderSources({
  appId,
  fastPathVersions,
  cmpSrc,
  // Auto-detection maps a customer's NODE_ENV=development to 1Consent's
  // internal "local" zone (unreachable outside our stack) — default to
  // production and let internal setups override explicitly.
  environment = "production",
  loadCmp = true
}) {
  const resolvedAppId = appId ?? resolveEnvAppId();
  const resolvedCmpSrc = cmpSrc ?? (resolvedAppId !== void 0 ? getCmpScriptUrl(resolvedAppId, { env: environment }) : void 0);
  if (loadCmp && resolvedCmpSrc === void 0) {
    throw new Error(
      "[1Consent] Missing App ID: pass the `appId` prop to <OneConsentProvider> or set the NEXT_PUBLIC_1CONSENT_APP_ID environment variable."
    );
  }
  return {
    appId: resolvedAppId ?? "",
    cmpSrc: loadCmp ? resolvedCmpSrc : void 0,
    frameworkVersions: JSON.stringify(fastPathVersions ?? {})
  };
}
function OneConsentProvider(props) {
  const { appId, cmpSrc, frameworkVersions } = resolveProviderSources(props);
  const { nonce, children } = props;
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    cmpSrc !== void 0 && /* @__PURE__ */ jsx2("script", { src: cmpSrc, nonce }),
    /* @__PURE__ */ jsx2(
      "script",
      {
        "data-1c-react-fastpath": "",
        "data-1c-app-id": appId,
        "data-1c-framework-versions": frameworkVersions,
        nonce,
        children: REACT_FASTPATH_SOURCE
      }
    ),
    children
  ] });
}
export {
  OneConsent,
  OneConsentProvider
};
