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
var REACT_FASTPATH_SOURCE = '"use strict";(()=>{(()=>{var re,oe,se,ce,ie,ae,le,ue;let c=window,p=document,I=["data-1c-service","data-1c-service-tag","data-1c-tag"],F="data-1c-category",H="data-1c-resolved",fe="data-1c-once",q="1consent:config",de=33696e6,pe=I.concat(F).map(e=>`template[${e}]:not([${H}])`).join(","),u=e=>typeof e=="object"&&e!==null&&!Array.isArray(e),ge=e=>{let t=2166136261;for(let n=0;n<e.length;n++)t^=e.charCodeAt(n),t=t+((t<<1)+(t<<4)+(t<<7)+(t<<8)+(t<<24))>>>0;return t.toString(36)},_e=e=>{var r,a;let t=((r=e.services)!=null?r:[]).map(s=>{var l,o,N;return`${s.id}\\0${(l=s.name)!=null?l:""}\\0${(o=s.tag)!=null?o:""}\\0${(N=s.categoryId)!=null?N:""}\\0${s.essential?1:0}${s.usSensitive?"\\x001":""}`}).sort(),n=((a=e.categories)!=null?a:[]).map(s=>`${s.id}\\0${s.name}\\0${s.essential?1:0}`).sort();return ge(`s:${t.join("")}|c:${n.join("")}`)},me=((re=p.currentScript)==null?void 0:re.getAttribute("data-1c-app-id"))||"",ye=((oe=p.currentScript)==null?void 0:oe.getAttribute("data-1c-framework-versions"))||"{}",L={};try{L=JSON.parse(ye)}catch{}let i=c.__1CONSENT_CONFIG__,M=(se=i==null?void 0:i.consentEpoch)!=null?se:0,E=i==null?void 0:i.framework.type,h=i==null?void 0:i.machine,v=(ce=i==null?void 0:i.languages)==null?void 0:ce.primary,C=i!==void 0&&i.appId===me&&(E==="gdpr"||E==="tcf"||E==="us")&&(h==="P"||h==="S"||h==="D")&&typeof v=="string"&&v.length>0&&Number.isSafeInteger(M)&&M>=0,g=C?i:void 0,A=(ie=g==null?void 0:g.appId)!=null?ie:"",m=(ae=g==null?void 0:g.framework.id)!=null?ae:"",R=C&&E!=null?E:"",O=C&&h!=null?h:"",k=C&&v!=null?v:"",B=u(L)?L[m]:void 0,b=typeof B=="string"?B:"",y=C?M:-1,Q=JSON.stringify([A,m,R,O,k,b,y]),$=!1,D=!1,V,j,x,U=!1,X=()=>{var e,t;try{let n=c.__1CONSENT_CONFIG__;return $||D||!n||A.length===0||m.length===0||y<0||n.appId!==A||n.framework.id!==m||n.framework.type!==R||n.machine!==O||((e=n.languages)==null?void 0:e.primary)!==k||((t=n.consentEpoch)!=null?t:0)!==y||b.length===0?!1:((n!==V||n.services!==j||n.categories!==x)&&(V=n,j=n.services,x=n.categories,U=_e(n)===b),U)}catch{return!1}},S=c.__1CONSENT_REACT_FASTPATH__;if(S){try{if(S.runtimeKey===Q&&X()&&typeof S.reconcile=="function"&&S.reconcile())return}catch{}try{typeof S.destroy=="function"&&S.destroy()}catch{}c.__1CONSENT_REACT_FASTPATH__===S&&delete c.__1CONSENT_REACT_FASTPATH__}let f=null,d=null,_,w,G=()=>{},T=()=>$||D?!1:X()?!0:(D=!0,f=null,d=null,_==null||_.disconnect(),G(),c.__1CONSENT_REACT_FASTPATH__===w&&delete c.__1CONSENT_REACT_FASTPATH__,!1),Y=new Set,z=e=>{if(!e||typeof e!="object")return!1;for(let t of Object.values(e))if(typeof t!="boolean")return!1;return!0},Se=()=>navigator.globalPrivacyControl===!0;try{let e=localStorage.getItem("1consent");if(e&&A&&m&&b&&y>=0){let t=Date.now(),n=t+de,r=JSON.parse(e),a=u(r)&&u(r.apps)?r.apps[A]:void 0,s=u(a)?a.frameworks:void 0,l=u(s)?s[m]:void 0,o=u(l)?l.fastPath:void 0,N=u(l)?l.consent:void 0,J=u(l)&&"consentEpoch"in l?l.consentEpoch:0,be=u(l)&&l.type===R&&l.machine===O&&typeof J=="number"&&Number.isSafeInteger(J)&&J>=y&&l.primaryLanguage===k,Ne=(g==null?void 0:g.framework.type)!=="tcf"||u(N)&&typeof N.tcString=="string"&&((ue=(le=c.__1cTcf)==null?void 0:le.tcData)==null?void 0:ue.eventStatus)==="tcloaded"&&c.__1cTcf.tcData.tcString===N.tcString;u(r)&&r.schemaVersion===1&&be&&u(o)&&o.structuralVersion===b&&typeof o.consentEpoch=="number"&&Number.isSafeInteger(o.consentEpoch)&&o.consentEpoch>=y&&Number.isSafeInteger(t)&&t>=0&&Number.isSafeInteger(n)&&typeof o.expiresAt=="number"&&Number.isSafeInteger(o.expiresAt)&&o.expiresAt>=t&&o.expiresAt<=n&&z(o.services)&&Ne&&!(o.gpcRevocable===!0&&Se())&&(f=o.services,d=z(o.categories)?o.categories:{})}}catch{}let Te=e=>{for(let t of I){let n=e.getAttribute(t);if(n!==null)return n}return e.getAttribute(F)},Ee=e=>{for(let n of I){let r=e.getAttribute(n);if(r!==null)return f!==null&&f[r]===!0}let t=e.getAttribute(F);return t!==null?d!==null&&d[t]===!0:!1},he=e=>{let t=p.createElement("script");for(let n of e.attributes)t.setAttribute(n.name,n.value);return e.src?e.hasAttribute("async")||(t.async=!1):t.text=e.text||"",t},P=e=>{if(!T()||e.hasAttribute(H)||!Ee(e))return!1;e.setAttribute(H,"");let t=e.getAttribute(fe);if(t!==null){if(Y.has(t))return!1;Y.add(t)}let n=e.content.cloneNode(!0);if(!(n instanceof DocumentFragment))return!1;for(let r of n.querySelectorAll("script"))r.replaceWith(he(r));return e.parentNode&&e.parentNode.insertBefore(n,e.nextSibling),!0},K=e=>e instanceof HTMLTemplateElement,Z=8,Ae=()=>new Promise(e=>{let t=c.scheduler;t!=null&&t.postTask?t.postTask(e,{priority:"user-visible"}):setTimeout(e,0)}),W=e=>{if(!T())return[];let t=[];for(let a of e.querySelectorAll(pe))K(a)&&t.push(a);let n=[],r=0;for(;r<t.length&&r<Z;r++){let a=t[r];if(a&&P(a)){let s=Te(a);s!==null&&n.push(s)}}return r<t.length&&(async()=>{for(;r<t.length;r++){r%Z===0&&await Ae();let a=t[r];if(a)try{P(a)}catch{}}})(),n},ee=!1,te=()=>T()?p.readyState!=="loading"?W(p):(ee||(ee=!0,p.addEventListener("DOMContentLoaded",()=>W(p),{once:!0})),[]):[];_=new MutationObserver(e=>{if(!(!T()||p.readyState==="loading"||f===null&&d===null))for(let t of e)for(let n of t.addedNodes)K(n)?P(n):n instanceof Element&&W(n)}),_.observe(p.documentElement,{childList:!0,subtree:!0});let ne=()=>{V=void 0,j=void 0,x=void 0,T()};w={appId:A,frameworkId:m,frameworkType:R,machine:O,primaryLanguage:k,structuralVersion:b,consentEpoch:y,runtimeKey:Q,apply(e,t){if(!T())return[];f=f||{},d=d||{};for(let n of Object.keys(e))f[n]=e[n]===!0;if(t)for(let n of Object.keys(t))d[n]=t[n]===!0;return te()},resolve(e){return e!==null&&K(e)?P(e):!1},reconcile:T,destroy:()=>{$=!0,f=null,d=null,_==null||_.disconnect(),G(),c.__1CONSENT_REACT_FASTPATH__===w&&delete c.__1CONSENT_REACT_FASTPATH__}},c.__1CONSENT_REACT_FASTPATH__=w,c.addEventListener(q,ne),G=()=>c.removeEventListener(q,ne),(f!==null||d!==null)&&te()})();})();';

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
