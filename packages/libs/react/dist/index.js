// ../../contracts/dist/consent-data-governance.js
var CONSENT_MAX_AGE_DAYS = 390;
var CONSENT_MAX_AGE_MS = CONSENT_MAX_AGE_DAYS * 24 * 60 * 60 * 1e3;
function isConsentExpiryFresh(expiresAt, now = Date.now()) {
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= 0)
    return false;
  if (!Number.isSafeInteger(now) || now < 0)
    return false;
  const latestPermittedExpiry = now + CONSENT_MAX_AGE_MS;
  if (!Number.isSafeInteger(latestPermittedExpiry))
    return false;
  return expiresAt >= now && expiresAt <= latestPermittedExpiry;
}

// ../../contracts/dist/browser-storage.js
var BROWSER_STORAGE_KEY = "1consent";
var BROWSER_STORAGE_SCHEMA_VERSION = 1;
function emptyBrowserStore() {
  return { schemaVersion: BROWSER_STORAGE_SCHEMA_VERSION, apps: {} };
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isOneConsentBrowserStore(value) {
  return isRecord(value) && value.schemaVersion === BROWSER_STORAGE_SCHEMA_VERSION && isRecord(value.apps);
}
function parseBrowserStore(raw) {
  if (!raw)
    return emptyBrowserStore();
  try {
    const value = JSON.parse(raw);
    return isOneConsentBrowserStore(value) ? value : emptyBrowserStore();
  } catch {
    return emptyBrowserStore();
  }
}
function isBooleanRecord(value) {
  if (!isRecord(value))
    return false;
  return Object.values(value).every((entry) => typeof entry === "boolean");
}
function isBrowserFastPathState(value) {
  if (!isRecord(value))
    return false;
  return typeof value.structuralVersion === "string" && typeof value.consentEpoch === "number" && Number.isSafeInteger(value.consentEpoch) && value.consentEpoch >= 0 && typeof value.expiresAt === "number" && Number.isSafeInteger(value.expiresAt) && value.expiresAt >= 0 && isBooleanRecord(value.services) && isBooleanRecord(value.categories) && (value.decisionIntegrity === void 0 || typeof value.decisionIntegrity === "string") && (value.tcfCmpId === void 0 || typeof value.tcfCmpId === "number" && Number.isSafeInteger(value.tcfCmpId) && value.tcfCmpId >= 0 && value.tcfCmpId <= 4095) && (value.tcfValidationVersion === void 0 || typeof value.tcfValidationVersion === "number" && Number.isSafeInteger(value.tcfValidationVersion) && value.tcfValidationVersion > 0) && (value.tcfDisclosedVendorKey === void 0 || typeof value.tcfDisclosedVendorKey === "string" && /^(?:[1-9]\d*(?:,[1-9]\d*)*)?$/.test(value.tcfDisclosedVendorKey)) && (value.tcfApiDataIntegrity === void 0 || typeof value.tcfApiDataIntegrity === "string") && (value.gpcRevocable === void 0 || value.gpcRevocable === true) && (value.posture === void 0 || value.posture === true);
}
function isFreshBrowserFastPathState(value, now = Date.now()) {
  if (!isBrowserFastPathState(value))
    return false;
  return isConsentExpiryFresh(value.expiresAt, now);
}

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
function writeAlias(map, key, granted) {
  map[key] = key in map ? map[key] === true && granted : granted;
}
function buildConsentAliasMaps(services, categories, serviceConsent, categoryConsent) {
  const state = buildConsentAliasState(services, categories, serviceConsent, categoryConsent);
  return { services: state.services, categories: state.categories };
}
function buildConsentAliasState(services, categories, serviceConsent, categoryConsent) {
  const serviceAliases = {};
  const memberCounts = /* @__PURE__ */ new Map();
  let nonEssentialGranted = false;
  for (const service of services) {
    const granted = service.essential === true || serviceConsent[service.id] === true;
    if (granted && service.essential !== true)
      nonEssentialGranted = true;
    writeAlias(serviceAliases, service.id, granted);
    if (service.catalogServiceKey) {
      writeAlias(serviceAliases, service.catalogServiceKey, granted);
    }
    if (service.tag)
      writeAlias(serviceAliases, service.tag, granted);
    if (service.name)
      writeAlias(serviceAliases, service.name, granted);
    if (service.categoryId) {
      const counts = memberCounts.get(service.categoryId) ?? { total: 0, granted: 0 };
      counts.total += 1;
      if (granted)
        counts.granted += 1;
      memberCounts.set(service.categoryId, counts);
    }
  }
  const categoryAliases = {};
  for (const category of categories) {
    const counts = memberCounts.get(category.id);
    const derived = counts !== void 0 && counts.total > 0 && counts.granted === counts.total;
    const granted = category.essential === true || categoryConsent[category.id] === true || derived;
    if (granted && category.essential !== true && categoryConsent[category.id] === true) {
      nonEssentialGranted = true;
    }
    writeAlias(categoryAliases, category.id, granted);
    writeAlias(categoryAliases, category.name, granted);
  }
  return {
    services: serviceAliases,
    categories: categoryAliases,
    nonEssentialGranted
  };
}
function hasGpcSignal() {
  if (typeof navigator === "undefined")
    return false;
  const nav = navigator;
  return nav.globalPrivacyControl === true;
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
var REACT_FASTPATH_SOURCE = '"use strict";(()=>{(()=>{var re,oe,se,ce,ae,ie,le,ue;let c=window,g=document,I=["data-1c-service","data-1c-service-tag","data-1c-tag"],F="data-1c-category",H="data-1c-resolved",fe="data-1c-once",q="1consent:config",de=33696e6,ge=I.concat(F).map(e=>`template[${e}]:not([${H}])`).join(","),u=e=>typeof e=="object"&&e!==null&&!Array.isArray(e),pe=e=>{let t=2166136261;for(let n=0;n<e.length;n++)t^=e.charCodeAt(n),t=t+((t<<1)+(t<<4)+(t<<7)+(t<<8)+(t<<24))>>>0;return t.toString(36)},_e=e=>{var r,i;let t=((r=e.services)!=null?r:[]).map(o=>{var l,s,N;return`${o.id}\\0${(l=o.name)!=null?l:""}\\0${(s=o.tag)!=null?s:""}\\0${(N=o.categoryId)!=null?N:""}\\0${o.essential?1:0}${o.catalogServiceKey?`\\0k\\0${o.catalogServiceKey}`:""}${o.usSensitive?"\\x001":""}`}).sort(),n=((i=e.categories)!=null?i:[]).map(o=>`${o.id}\\0${o.name}\\0${o.essential?1:0}`).sort();return pe(`s:${t.join("")}|c:${n.join("")}`)},me=((re=g.currentScript)==null?void 0:re.getAttribute("data-1c-app-id"))||"",ye=((oe=g.currentScript)==null?void 0:oe.getAttribute("data-1c-framework-versions"))||"{}",L={};try{L=JSON.parse(ye)}catch{}let a=c.__1CONSENT_CONFIG__,M=(se=a==null?void 0:a.consentEpoch)!=null?se:0,E=a==null?void 0:a.framework.type,h=a==null?void 0:a.machine,v=(ce=a==null?void 0:a.languages)==null?void 0:ce.primary,C=a!==void 0&&a.appId===me&&(E==="gdpr"||E==="tcf"||E==="us")&&(h==="P"||h==="S"||h==="D")&&typeof v=="string"&&v.length>0&&Number.isSafeInteger(M)&&M>=0,p=C?a:void 0,A=(ae=p==null?void 0:p.appId)!=null?ae:"",m=(ie=p==null?void 0:p.framework.id)!=null?ie:"",R=C&&E!=null?E:"",k=C&&h!=null?h:"",O=C&&v!=null?v:"",B=u(L)?L[m]:void 0,b=typeof B=="string"?B:"",y=C?M:-1,Q=JSON.stringify([A,m,R,k,O,b,y]),$=!1,D=!1,V,j,K,U=!1,X=()=>{var e,t;try{let n=c.__1CONSENT_CONFIG__;return $||D||!n||A.length===0||m.length===0||y<0||n.appId!==A||n.framework.id!==m||n.framework.type!==R||n.machine!==k||((e=n.languages)==null?void 0:e.primary)!==O||((t=n.consentEpoch)!=null?t:0)!==y||b.length===0?!1:((n!==V||n.services!==j||n.categories!==K)&&(V=n,j=n.services,K=n.categories,U=_e(n)===b),U)}catch{return!1}},S=c.__1CONSENT_REACT_FASTPATH__;if(S){try{if(S.runtimeKey===Q&&X()&&typeof S.reconcile=="function"&&S.reconcile())return}catch{}try{typeof S.destroy=="function"&&S.destroy()}catch{}c.__1CONSENT_REACT_FASTPATH__===S&&delete c.__1CONSENT_REACT_FASTPATH__}let f=null,d=null,_,w,x=()=>{},T=()=>$||D?!1:X()?!0:(D=!0,f=null,d=null,_==null||_.disconnect(),x(),c.__1CONSENT_REACT_FASTPATH__===w&&delete c.__1CONSENT_REACT_FASTPATH__,!1),Y=new Set,z=e=>{if(!e||typeof e!="object")return!1;for(let t of Object.values(e))if(typeof t!="boolean")return!1;return!0},Se=()=>navigator.globalPrivacyControl===!0;try{let e=localStorage.getItem("1consent");if(e&&A&&m&&b&&y>=0){let t=Date.now(),n=t+de,r=JSON.parse(e),i=u(r)&&u(r.apps)?r.apps[A]:void 0,o=u(i)?i.frameworks:void 0,l=u(o)?o[m]:void 0,s=u(l)?l.fastPath:void 0,N=u(l)?l.consent:void 0,J=u(l)&&"consentEpoch"in l?l.consentEpoch:0,be=u(l)&&l.type===R&&l.machine===k&&typeof J=="number"&&Number.isSafeInteger(J)&&J>=y&&l.primaryLanguage===O,Ne=(p==null?void 0:p.framework.type)!=="tcf"||u(N)&&typeof N.tcString=="string"&&((ue=(le=c.__1cTcf)==null?void 0:le.tcData)==null?void 0:ue.eventStatus)==="tcloaded"&&c.__1cTcf.tcData.tcString===N.tcString;u(r)&&r.schemaVersion===1&&be&&u(s)&&s.structuralVersion===b&&typeof s.consentEpoch=="number"&&Number.isSafeInteger(s.consentEpoch)&&s.consentEpoch>=y&&Number.isSafeInteger(t)&&t>=0&&Number.isSafeInteger(n)&&typeof s.expiresAt=="number"&&Number.isSafeInteger(s.expiresAt)&&s.expiresAt>=t&&s.expiresAt<=n&&z(s.services)&&Ne&&!(s.gpcRevocable===!0&&Se())&&(f=s.services,d=z(s.categories)?s.categories:{})}}catch{}let Te=e=>{for(let t of I){let n=e.getAttribute(t);if(n!==null)return n}return e.getAttribute(F)},Ee=e=>{for(let n of I){let r=e.getAttribute(n);if(r!==null)return f!==null&&f[r]===!0}let t=e.getAttribute(F);return t!==null?d!==null&&d[t]===!0:!1},he=e=>{let t=g.createElement("script");for(let n of e.attributes)t.setAttribute(n.name,n.value);return e.src?e.hasAttribute("async")||(t.async=!1):t.text=e.text||"",t},P=e=>{if(!T()||e.hasAttribute(H)||!Ee(e))return!1;e.setAttribute(H,"");let t=e.getAttribute(fe);if(t!==null){if(Y.has(t))return!1;Y.add(t)}let n=e.content.cloneNode(!0);if(!(n instanceof DocumentFragment))return!1;for(let r of n.querySelectorAll("script"))r.replaceWith(he(r));return e.parentNode&&e.parentNode.insertBefore(n,e.nextSibling),!0},G=e=>e instanceof HTMLTemplateElement,Z=8,Ae=()=>new Promise(e=>{let t=c.scheduler;t!=null&&t.postTask?t.postTask(e,{priority:"user-visible"}):setTimeout(e,0)}),W=e=>{if(!T())return[];let t=[];for(let i of e.querySelectorAll(ge))G(i)&&t.push(i);let n=[],r=0;for(;r<t.length&&r<Z;r++){let i=t[r];if(i&&P(i)){let o=Te(i);o!==null&&n.push(o)}}return r<t.length&&(async()=>{for(;r<t.length;r++){r%Z===0&&await Ae();let i=t[r];if(i)try{P(i)}catch{}}})(),n},ee=!1,te=()=>T()?g.readyState!=="loading"?W(g):(ee||(ee=!0,g.addEventListener("DOMContentLoaded",()=>W(g),{once:!0})),[]):[];_=new MutationObserver(e=>{if(!(!T()||g.readyState==="loading"||f===null&&d===null))for(let t of e)for(let n of t.addedNodes)G(n)?P(n):n instanceof Element&&W(n)}),_.observe(g.documentElement,{childList:!0,subtree:!0});let ne=()=>{V=void 0,j=void 0,K=void 0,T()};w={appId:A,frameworkId:m,frameworkType:R,machine:k,primaryLanguage:O,structuralVersion:b,consentEpoch:y,runtimeKey:Q,apply(e,t){if(!T())return[];f=f||{},d=d||{};for(let n of Object.keys(e))f[n]=e[n]===!0;if(t)for(let n of Object.keys(t))d[n]=t[n]===!0;return te()},resolve(e){return e!==null&&G(e)?P(e):!1},reconcile:T,destroy:()=>{$=!0,f=null,d=null,_==null||_.disconnect(),x(),c.__1CONSENT_REACT_FASTPATH__===w&&delete c.__1CONSENT_REACT_FASTPATH__}},c.__1CONSENT_REACT_FASTPATH__=w,c.addEventListener(q,ne),x=()=>c.removeEventListener(q,ne),(f!==null||d!==null)&&te()})();})();';

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

// src/use-consent.ts
import { useEffect, useState } from "react";
function readMirrorConsent(key) {
  try {
    const api = window.__1CONSENT_REACT_FASTPATH__;
    if (!api?.appId || !api.frameworkId || !api.structuralVersion || !Number.isSafeInteger(api.consentEpoch) || api.consentEpoch < 0)
      return false;
    const fastPathWindow = window;
    const config = fastPathWindow.__1CONSENT_CONFIG__;
    const liveEpoch = config?.consentEpoch ?? 0;
    if (!config || config.appId !== api.appId || config.framework.id !== api.frameworkId || !Number.isSafeInteger(liveEpoch) || liveEpoch < 0 || liveEpoch !== api.consentEpoch || config.languages.primary.length === 0) {
      return false;
    }
    const root = parseBrowserStore(localStorage.getItem(BROWSER_STORAGE_KEY));
    const framework = root.apps[api.appId]?.frameworks[api.frameworkId];
    if (!framework || framework.type !== config.framework.type || framework.machine !== config.machine || (framework.consentEpoch ?? 0) < liveEpoch || framework.primaryLanguage !== config.languages.primary) {
      return false;
    }
    if (config.framework.type === "tcf") {
      const tcString = framework.consent?.tcString;
      const tcData = fastPathWindow.__1cTcf?.tcData;
      if (typeof tcString !== "string" || tcData?.eventStatus !== "tcloaded" || tcData.tcString !== tcString) {
        return false;
      }
    }
    const fastPath = framework.fastPath;
    if (!isFreshBrowserFastPathState(fastPath)) return false;
    if (fastPath.structuralVersion !== api.structuralVersion) return false;
    if (fastPath.consentEpoch < api.consentEpoch) return false;
    if (fastPath.gpcRevocable === true && hasGpcSignal()) return false;
    return fastPath.services[key] === true || fastPath.categories[key] === true;
  } catch {
    return false;
  }
}
function isConsentEventBus(x) {
  if (!x || typeof x !== "object") return false;
  if (!("on" in x) || typeof x.on !== "function") return false;
  if ("off" in x && x.off !== void 0 && typeof x.off !== "function") return false;
  return true;
}
function getBus() {
  if (typeof window === "undefined") return void 0;
  const controller = window.__1consent;
  if (!controller || typeof controller !== "object") return void 0;
  if (!("bus" in controller)) return void 0;
  return isConsentEventBus(controller.bus) ? controller.bus : void 0;
}
function isBooleanRecord2(value) {
  return typeof value === "object" && value !== null && Object.values(value).every((entry) => typeof entry === "boolean");
}
function getLiveConsentState() {
  if (typeof window === "undefined") return void 0;
  const controller = window.__1consent;
  if (!controller || typeof controller !== "object" || !("engine" in controller)) {
    return void 0;
  }
  const engine = controller.engine;
  if (!engine || typeof engine !== "object" || !("getEnforcementConsentState" in engine) || typeof engine.getEnforcementConsentState !== "function") {
    return void 0;
  }
  const state = engine.getEnforcementConsentState();
  if (!state || typeof state !== "object" || !("categories" in state) || !("services" in state)) {
    return void 0;
  }
  return isBooleanRecord2(state.categories) && isBooleanRecord2(state.services) ? { categories: state.categories, services: state.services } : void 0;
}
function readLiveConsent(key) {
  try {
    const fastPathWindow = window;
    const config = fastPathWindow.__1CONSENT_CONFIG__;
    const state = getLiveConsentState();
    if (!config || !state) return void 0;
    const aliases = buildConsentAliasMaps(
      config.services,
      config.categories,
      state.services,
      state.categories
    );
    return aliases.services[key] === true || aliases.categories[key] === true;
  } catch {
    return void 0;
  }
}
var busWaiters = /* @__PURE__ */ new Set();
var busPoller;
function whenBusAvailable(listener) {
  const bus = getBus();
  if (bus) {
    listener(bus);
    return () => void 0;
  }
  busWaiters.add(listener);
  if (busPoller === void 0) {
    busPoller = setInterval(() => {
      const found = getBus();
      if (!found) return;
      clearInterval(busPoller);
      busPoller = void 0;
      for (const waiter of busWaiters) waiter(found);
      busWaiters.clear();
    }, 250);
  }
  return () => {
    busWaiters.delete(listener);
    if (busWaiters.size === 0 && busPoller !== void 0) {
      clearInterval(busPoller);
      busPoller = void 0;
    }
  };
}
function useConsent(key) {
  const [granted, setGranted] = useState(false);
  useEffect(() => {
    setGranted(readMirrorConsent(key));
    let disposed = false;
    let attached = null;
    const cancelWait = whenBusAvailable((bus) => {
      if (disposed) return;
      const mirrorHandler = () => {
        if (!disposed) setGranted(readMirrorConsent(key));
      };
      const externalHandler = () => {
        if (!disposed) setGranted(readLiveConsent(key) ?? readMirrorConsent(key));
      };
      bus.on("consent:changed", mirrorHandler);
      bus.on("consent:saved", mirrorHandler);
      bus.on("consent:external", externalHandler);
      attached = { bus, mirrorHandler, externalHandler };
      mirrorHandler();
    });
    return () => {
      disposed = true;
      cancelWait();
      if (attached?.bus.off) {
        attached.bus.off("consent:changed", attached.mirrorHandler);
        attached.bus.off("consent:saved", attached.mirrorHandler);
        attached.bus.off("consent:external", attached.externalHandler);
      }
    };
  }, [key]);
  return granted;
}
export {
  OneConsent,
  OneConsentProvider,
  useConsent
};
