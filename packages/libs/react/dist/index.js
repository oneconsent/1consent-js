// src/client-provider.tsx
import { useLayoutEffect, useState, useSyncExternalStore } from "react";

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

// ../../contracts/dist/consent-fastpath.js
var RUNTIME_CONFIG_EVENT = "1consent:config";
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
function computeStructuralVersion(services, categories) {
  const serviceParts = services.map((s) => `${s.id}\0${s.name ?? ""}\0${s.tag ?? ""}\0${s.categoryId ?? ""}\0${s.essential ? 1 : 0}${s.catalogServiceKey ? `\0k\0${s.catalogServiceKey}` : ""}${s.usSensitive ? "\x001" : ""}`).sort();
  const categoryParts = categories.map((c) => `${c.id}\0${c.name}\0${c.essential ? 1 : 0}`).sort();
  return fnv1a36(`s:${serviceParts.join("")}|c:${categoryParts.join("")}`);
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

// ../react-fastpath/dist/generated/engine-source.js
var REACT_FASTPATH_SOURCE = '"use strict";(()=>{var We=/^[A-Za-z0-9_-]{1,64}$/;var ze=/^[\\da-f]{8}(-[\\da-f]{4}){3}-[\\da-f]{12}$/i,Ye=(t,o,a)=>typeof t=="string"&&o.test(t)&&!(a!=null&&a.test(t)),ce=t=>Ye(t,We,ze);var tt=1440*60*1e3;function qe(t){return typeof t=="object"&&t!==null&&!Array.isArray(t)}function ae(t){return qe(t)&&ce(t.appId)&&ce(t.frameworkId)}var Je="1consent";function De(t){return typeof t=="string"&&/^1consent-wix-[A-Za-z0-9]{1,64}$/.test(t)}function ue(t){var o;return(o=t.browserStorageScope)!=null?o:Je}function Fe(){let t=[],o=!1,a=!1,y,A,M=()=>{var m;if(!(o||a)){for(o=!0;!a&&t.length>0;){let l=t.shift();if(!l)break;if(!l.slot.isConnected||!l.allowed())continue;let i;try{i=l.recreate(l.source)}catch(I){console.error("[1Consent] A consent-gated script could not be activated.",I);continue}let d=i.hasAttribute("type")?i.type.trim().toLowerCase():i.getAttribute("language")?`text/${(m=i.getAttribute("language"))==null?void 0:m.trim().toLowerCase()}`:"",V=d===""||/^(?:application|text)\\/(?:x-)?(?:java|ecma)script$/.test(d)||/^text\\/(?:javascript1\\.[0-5]|jscript|livescript)$/.test(d);if(i.src&&V&&!i.hasAttribute("async")&&!i.defer&&!i.noModule){let I=new MutationObserver(()=>{i.isConnected||_()}),_=()=>{y===h&&(h(),o=!1,M())},h=()=>{I.disconnect(),i.removeEventListener("load",_),i.removeEventListener("error",_),y=void 0,A=void 0};y=h,A=()=>{(!i.isConnected||!l.allowed())&&(h(),o=!1)},i.addEventListener("load",_),i.addEventListener("error",_),I.observe(l.slot.ownerDocument,{childList:!0,subtree:!0}),l.slot.replaceWith(i),i.isConnected||_();return}l.slot.replaceWith(i)}o=!1}};return{activate(m,l,i,d){let V=Array.from(m.querySelectorAll("script"),_=>{let h=document.createComment("1c-script");return _.replaceWith(h),{source:_,slot:h,allowed:i,recreate:d}}),I=!o;o=!0,t.push(...V);try{l(m)}finally{I&&(o=!1),M()}},setPaused(m){a=m},recheck(){if(!a){A==null||A();for(let m=t.length-1;m>=0;m--){let l=t[m];l&&(!l.slot.isConnected||!l.allowed())&&t.splice(m,1)}}},flush:M,clear(){t.length=0,y==null||y(),o=!1}}}var de="1consent";function Xe(t){return typeof t=="object"&&t!==null&&"createPolicy"in t}var pe=t=>t,H;function fe(t,o){if(H===void 0){H=null;let a=Reflect.get(globalThis,"trustedTypes");if(Xe(a))try{H=a.createPolicy(de,{createHTML:pe,createScript:pe,createScriptURL:pe})}catch(y){console.warn(`[1Consent] Allow the "${de}" Trusted Types policy: trusted-types ${de} \'allow-duplicates\'`,y)}}return H?H[t](o):o}function Ze(t,o){Reflect.set(t,"src",fe("createScriptURL",o))}function Me(t,o){Reflect.set(t,"text",fe("createScript",o))}function Ve(t,o,a){let y=o.toLowerCase();y==="src"?Ze(t,a):y.startsWith("on")?Reflect.apply(t.setAttribute,t,[o,fe("createScript",a)]):t.setAttribute(o,a)}(()=>{var Oe,Re,xe,Pe,ke,Le,ve;let t=window,o=document,a=["data-1c-service","data-1c-service-tag","data-1c-tag"],y="data-1c-category",A="data-1c-resolved",M="data-1c-once",m="1consent:config",l=33696e6,i=a.concat(y).map(e=>`template[${e}]:not([${A}])`).join(","),d=e=>typeof e=="object"&&e!==null&&!Array.isArray(e),V=e=>{let r=2166136261;for(let n=0;n<e.length;n++)r^=e.charCodeAt(n),r=r+((r<<1)+(r<<4)+(r<<7)+(r<<8)+(r<<24))>>>0;return r.toString(36)},I=e=>{var s,c;let r=((s=e.services)!=null?s:[]).map(p=>{var S,f,F;return`${p.id}\\0${(S=p.name)!=null?S:""}\\0${(f=p.tag)!=null?f:""}\\0${(F=p.categoryId)!=null?F:""}\\0${p.essential?1:0}${p.catalogServiceKey?`\\0k\\0${p.catalogServiceKey}`:""}${p.usSensitive?"\\x001":""}`}).sort(),n=((c=e.categories)!=null?c:[]).map(p=>`${p.id}\\0${p.name}\\0${p.essential?1:0}`).sort();return V(`s:${r.join("")}|c:${n.join("")}`)},_=((Oe=o.currentScript)==null?void 0:Oe.getAttribute("data-1c-app-id"))||"",h=((Re=o.currentScript)==null?void 0:Re.getAttribute("data-1c-framework-versions"))||"{}",Y={};try{Y=JSON.parse(h)}catch{}let u=t.__1CONSENT_CONFIG__,B=u==null?void 0:u.publicIdentity,q=(xe=u==null?void 0:u.consentEpoch)!=null?xe:0,R=u==null?void 0:u.framework.type,x=u==null?void 0:u.machine,$=(Pe=u==null?void 0:u.languages)==null?void 0:Pe.primary,N=u!==void 0&&(u.browserStorageScope===void 0||De(u.browserStorageScope))&&ae(B)&&B.appId===_&&(R==="gdpr"||R==="tcf"||R==="us")&&(x==="P"||x==="S"||x==="D")&&typeof $=="string"&&$.length>0&&Number.isSafeInteger(q)&&q>=0,g=N?u:void 0,P=(ke=g==null?void 0:g.appId)!=null?ke:"",k=(Le=g==null?void 0:g.framework.id)!=null?Le:"",j=N&&R!=null?R:"",G=N&&x!=null?x:"",U=N&&$!=null?$:"",le=N?B.appId:"",J=N?B.frameworkId:"",ye=d(Y)?Y[J]:void 0,L=typeof ye=="string"?ye:"",O=N?q:-1,X=ue(g!=null?g:{}),me=JSON.stringify([X,P,k,le,J,j,G,U,L,O]),Z=!1,Q=!1,ee,te,re,ge=!1,Se=()=>{var e,r;try{let n=t.__1CONSENT_CONFIG__;return Z||Q||!n||P.length===0||k.length===0||O<0||n.appId!==P||ue(n)!==X||n.framework.id!==k||!ae(n.publicIdentity)||n.publicIdentity.appId!==le||n.publicIdentity.frameworkId!==J||n.framework.type!==j||n.machine!==G||((e=n.languages)==null?void 0:e.primary)!==U||((r=n.consentEpoch)!=null?r:0)!==O||L.length===0?!1:((n!==ee||n.services!==te||n.categories!==re)&&(ee=n,te=n.services,re=n.categories,ge=I(n)===L),ge)}catch{return!1}},T=t.__1CONSENT_REACT_FASTPATH__;if(T){try{if(T.runtimeKey===me&&T.supportsPendingConsent===!0&&typeof T.updateConsent=="function"&&typeof T.promote=="function"&&Se()&&typeof T.reconcile=="function"&&T.reconcile())return}catch{}try{typeof T.destroy=="function"&&T.destroy()}catch{}t.__1CONSENT_REACT_FASTPATH__===T&&delete t.__1CONSENT_REACT_FASTPATH__}let E=null,b=null,v,_e=!1,C,D=Fe(),K,ne=()=>{},w=()=>Z||Q?!1:Se()?!0:(Q=!0,D.clear(),E=null,b=null,C==null||C.disconnect(),ne(),t.__1CONSENT_REACT_FASTPATH__===K&&delete t.__1CONSENT_REACT_FASTPATH__,!1),Ee=new Set,be=e=>{if(!e||typeof e!="object")return!1;for(let r of Object.values(e))if(typeof r!="boolean")return!1;return!0},$e=()=>navigator.globalPrivacyControl===!0;try{let e=localStorage.getItem(X);if(e&&P&&k&&L&&O>=0){let r=Date.now(),n=r+l,s=JSON.parse(e),c=d(s)&&d(s.apps)?s.apps[P]:void 0,p=d(c)?c.frameworks:void 0,S=d(p)?p[k]:void 0,f=d(S)?S.fastPath:void 0,F=d(S)?S.consent:void 0,ie=d(S)&&"consentEpoch"in S?S.consentEpoch:0,Ue=d(S)&&S.type===j&&S.machine===G&&typeof ie=="number"&&Number.isSafeInteger(ie)&&ie>=O&&S.primaryLanguage===U,z=(g==null?void 0:g.framework.type)==="tcf"?(ve=t.__1cTcf)==null?void 0:ve.tcData:void 0,Ke=(g==null?void 0:g.framework.type)!=="tcf"||d(F)&&typeof F.tcString=="string"&&(z==null?void 0:z.eventStatus)==="tcloaded"&&z.tcString===F.tcString;d(s)&&s.schemaVersion===1&&Ue&&d(f)&&f.structuralVersion===L&&typeof f.consentEpoch=="number"&&Number.isSafeInteger(f.consentEpoch)&&f.consentEpoch>=O&&Number.isSafeInteger(r)&&r>=0&&Number.isSafeInteger(n)&&typeof f.expiresAt=="number"&&Number.isSafeInteger(f.expiresAt)&&f.expiresAt>=r&&f.expiresAt<=n&&be(f.services)&&Ke&&!(f.gpcRevocable===!0&&$e())&&(v=f.expiresAt,E=f.services,b=be(f.categories)?f.categories:{})}}catch{}let He=e=>{for(let r of a){let n=e.getAttribute(r);if(n!==null)return n}return e.getAttribute(y)},Te=e=>{if(_e||v!==void 0&&Date.now()>v)return!1;for(let n of a){let s=e.getAttribute(n);if(s!==null)return E!==null&&E[s]===!0}let r=e.getAttribute(y);return r!==null?b!==null&&b[r]===!0:!1},Be=e=>{let r=o.createElement("script");for(let n of e.attributes)Ve(r,n.name,n.value);return e.src?e.hasAttribute("async")||(r.async=!1):Me(r,e.text||""),r},W=e=>{if(!w()||e.hasAttribute(A)||!Te(e))return!1;e.setAttribute(A,"");let r=e.getAttribute(M);if(r!==null){if(Ee.has(r))return!1;Ee.add(r)}let n=e.content.cloneNode(!0);return n instanceof DocumentFragment?(D.activate(n,s=>e.after(s),()=>e.isConnected&&w()&&Te(e),Be),!0):!1},oe=e=>e instanceof HTMLTemplateElement,Ae=8,je=()=>new Promise(e=>{let r=t.scheduler;r!=null&&r.postTask?r.postTask(e,{priority:"user-visible"}):setTimeout(e,0)}),se=e=>{if(!w())return[];let r=[];for(let c of e.querySelectorAll(i))oe(c)&&r.push(c);let n=[],s=0;for(;s<r.length&&s<Ae;s++){let c=r[s];if(c&&W(c)){let p=He(c);p!==null&&n.push(p)}}return s<r.length&&(async()=>{for(;s<r.length;s++){s%Ae===0&&await je();let c=r[s];if(c)try{W(c)}catch{}}})(),n},he=!1,Ie=()=>w()?o.readyState!=="loading"?se(o):(he||(he=!0,o.addEventListener("DOMContentLoaded",()=>se(o),{once:!0})),[]):[];C=new MutationObserver(e=>{if(!(!w()||o.readyState==="loading"||E===null&&b===null))for(let r of e)for(let n of r.addedNodes)oe(n)?W(n):n instanceof Element&&se(n)}),C.observe(o.documentElement,{childList:!0,subtree:!0});let Ce=()=>{ee=void 0,te=void 0,re=void 0,w()},Ge=()=>{Z=!0,D.clear(),E=null,b=null,C==null||C.disconnect(),ne(),t.__1CONSENT_REACT_FASTPATH__===K&&delete t.__1CONSENT_REACT_FASTPATH__},we=(e,r,n,s=!1)=>{if(w()){_e=s,D.setPaused(s),v!==void 0&&Date.now()>v&&(E=null,b=null),n!==void 0&&(v=n===0?void 0:n),E=E||{},b=b||{};for(let c of Object.keys(e))E[c]=e[c]===!0;if(r)for(let c of Object.keys(r))b[c]=r[c]===!0;D.recheck()}},Ne=()=>(D.flush(),Ie());K={appId:P,frameworkId:k,frameworkType:j,machine:G,primaryLanguage:U,structuralVersion:L,consentEpoch:O,runtimeKey:me,apply(e,r){return we(e,r),Ne()},supportsPendingConsent:!0,updateConsent:we,promote:Ne,resolve(e){return e!==null&&oe(e)?W(e):!1},reconcile:w,destroy:Ge},t.__1CONSENT_REACT_FASTPATH__=K,t.addEventListener(m,Ce),ne=()=>t.removeEventListener(m,Ce),(E!==null||b!==null)&&Ie()})();})();';

// ../../shared/dist/trusted-types.js
var ONECONSENT_TRUSTED_TYPES_POLICY = "1consent";
function isTrustedTypesFactory(value) {
  return typeof value === "object" && value !== null && "createPolicy" in value;
}
var pass = (input) => input;
var policy;
function trusted(kind, input) {
  if (policy === void 0) {
    policy = null;
    const types = Reflect.get(globalThis, "trustedTypes");
    if (isTrustedTypesFactory(types)) {
      try {
        policy = types.createPolicy(ONECONSENT_TRUSTED_TYPES_POLICY, {
          createHTML: pass,
          createScript: pass,
          createScriptURL: pass
        });
      } catch (error) {
        console.warn(`[1Consent] Allow the "${ONECONSENT_TRUSTED_TYPES_POLICY}" Trusted Types policy: trusted-types ${ONECONSENT_TRUSTED_TYPES_POLICY} 'allow-duplicates'`, error);
      }
    }
  }
  return policy ? policy[kind](input) : input;
}
function setScriptSource(script, url) {
  Reflect.set(script, "src", trusted("createScriptURL", url));
}
function setScriptText(script, text) {
  Reflect.set(script, "text", trusted("createScript", text));
}
function isTrustedHTML(value) {
  const types = Reflect.get(globalThis, "trustedTypes");
  return isTrustedTypesFactory(types) && types.isHTML(value);
}
function trustedHTML(markup) {
  return trusted("createHTML", markup);
}

// src/client-scripts.ts
function setNonce(script, nonce) {
  if (nonce) script.nonce = nonce;
}
function findLoader(cmpSrc) {
  const target = new URL(cmpSrc, document.baseURI);
  for (const script of document.scripts) {
    if (!script.src) continue;
    const source = new URL(script.src);
    if (source.origin === target.origin && source.pathname === target.pathname) return script;
  }
  return void 0;
}
function insertEngine({ appId, frameworkVersions, nonce }) {
  const script = document.createElement("script");
  script.setAttribute("data-1c-react-fastpath", "");
  script.setAttribute("data-1c-app-id", appId);
  script.setAttribute("data-1c-framework-versions", frameworkVersions);
  setNonce(script, nonce);
  setScriptText(script, REACT_FASTPATH_SOURCE);
  document.head.appendChild(script);
  script.remove();
}
function mountClientScripts(options) {
  try {
    return startClientScripts(options);
  } catch (error) {
    console.error("[1Consent] OneConsentProvider could not load the CMP.", error);
    return () => void 0;
  }
}
function startClientScripts(options) {
  const win = window;
  if (win.__1CONSENT_CONFIG__ !== void 0) {
    insertEngine(options);
    return () => void 0;
  }
  const { cmpSrc, nonce } = options;
  let loader = cmpSrc === void 0 ? void 0 : findLoader(cmpSrc);
  const stop = () => {
    window.removeEventListener(RUNTIME_CONFIG_EVENT, start);
    loader?.removeEventListener("load", start);
  };
  function start() {
    if (win.__1CONSENT_CONFIG__ === void 0) return;
    stop();
    try {
      insertEngine(options);
    } catch (error) {
      console.error(
        "[1Consent] OneConsentProvider could not start the consent engine.",
        error
      );
    }
  }
  window.addEventListener(RUNTIME_CONFIG_EVENT, start);
  if (cmpSrc !== void 0 && loader === void 0) {
    loader = document.createElement("script");
    setScriptSource(loader, cmpSrc);
    setNonce(loader, nonce);
    document.head.appendChild(loader);
  }
  loader?.addEventListener("load", start);
  return stop;
}

// ../../shared/dist/public-package-urls.js
var PUBLIC_PACKAGE_SERVICE_URLS = {
  local: {
    mcp: "https://mcp.1consent.local",
    dashboard: "https://dashboard.1consent.local",
    cmpApi: "https://cmp.1consent.local",
    cmpBootstrap: "https://web.cmp.1consent.local"
  },
  develop: {
    mcp: "https://mcp.1consent.dev",
    dashboard: "https://dashboard.1consent.dev",
    cmpApi: "https://cmp.1consent.dev",
    cmpBootstrap: "https://web.cmp.1consent.dev"
  },
  production: {
    mcp: "https://mcp.1consent.app",
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
var MANUAL_CMP_BOOTSTRAP_PREFIX = "/manual/id/";
function getCmpScriptUrl(appId, opts = {}) {
  const stage = opts.stage ?? "live";
  if (opts.frameworkId && stage !== "preview") {
    throw new Error("Framework override is available in Preview only");
  }
  const urls = getPublicPackageServiceUrls(opts.env);
  const baseUrl = stage === "preview" ? urls.cmpApi : opts.edge === false ? urls.cmpApi : urls.cmpBootstrap;
  const path = opts.manualBlocking ? MANUAL_CMP_BOOTSTRAP_PREFIX : "/id/";
  const base = `${baseUrl}${path}${appId}.${PUBLISH_STAGE_SUFFIX[stage]}`;
  return opts.frameworkId ? `${base}?frameworkId=${opts.frameworkId}` : base;
}

// src/provider.tsx
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
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
    cmpSrc !== void 0 && /* @__PURE__ */ jsx("script", { src: cmpSrc, nonce }),
    /* @__PURE__ */ jsx(
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

// src/client-provider.tsx
import { jsx as jsx2 } from "react/jsx-runtime";
var subscribeNever = () => () => void 0;
function OneConsentProvider2(props) {
  const rendering = useSyncExternalStore(
    subscribeNever,
    () => "client",
    () => "server-html"
  );
  const [scriptsFrom] = useState(rendering);
  const { appId, cmpSrc, frameworkVersions } = resolveProviderSources(props);
  const { nonce } = props;
  useLayoutEffect(() => {
    if (scriptsFrom === "server-html") return;
    return mountClientScripts({ appId, cmpSrc, frameworkVersions, nonce });
  }, [scriptsFrom, appId, cmpSrc, frameworkVersions, nonce]);
  if (scriptsFrom === "server-html") return /* @__PURE__ */ jsx2(OneConsentProvider, { ...props });
  return props.children;
}

// ../../contracts/dist/browser-storage.js
var BROWSER_STORAGE_KEY = "1consent";
function browserStorageKey(config) {
  return config.browserStorageScope ?? BROWSER_STORAGE_KEY;
}
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

// src/one-consent.tsx
import { useMemo } from "react";

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
function serializeNode(node, rawText, rawHTML) {
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
    return node.map((child) => serializeNode(child, rawText, rawHTML)).join("");
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
    const raw = isPlainObject(innerHtml) ? innerHtml.__html : void 0;
    if (typeof raw === "string" || isTrustedHTML(raw)) {
      html += String(raw);
      rawHTML.push(raw);
    } else if ("children" in props && props.children !== void 0) {
      if (!isReactNode(props.children)) {
        throw new Error(
          `[1Consent] Unsupported children on <${tag}> inside <OneConsent> \u2014 expected plain HTML, text, or arrays thereof.`
        );
      }
      html += serializeNode(props.children, RAW_TEXT_ELEMENTS.has(tag), rawHTML);
    }
    return `${html}</${tag}>`;
  }
  throw new Error("[1Consent] Unsupported child in <OneConsent> \u2014 expected plain HTML.");
}
function isReactNode(x) {
  return x === null || x === void 0 || typeof x === "string" || typeof x === "number" || typeof x === "boolean" || Array.isArray(x) || isValidElement(x);
}
function serializeChildren(children, rawHTML = []) {
  return Children.toArray(children).map((child) => serializeNode(child, false, rawHTML)).join("");
}

// src/one-consent.tsx
import { jsx as jsx3 } from "react/jsx-runtime";
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
  const rawHTML = [];
  const content = serializeChildren(children, rawHTML);
  const rawTrusted = rawHTML.every(isTrustedHTML);
  if (/<\/template/i.test(content)) {
    throw new Error(
      "[1Consent] <OneConsent> children must not contain a nested `</template>`."
    );
  }
  const onceAttr = props.once ? ` ${ONCE_TEMPLATE_ATTR}="${fnv1a36(`${attr}=${key}|${content}`)}"` : "";
  const nonceAttr = nonce ? ` nonce="${escapeAttribute(nonce)}"` : "";
  const html = `<template ${attr}="${escapeAttribute(key)}"${onceAttr}>${content}</template><script${nonceAttr}>window.__1CONSENT_REACT_FASTPATH__&&window.__1CONSENT_REACT_FASTPATH__.resolve(document.currentScript.previousElementSibling);</script>`;
  const markup = useMemo(() => rawTrusted ? trustedHTML(html) : html, [html, rawTrusted]);
  return /* @__PURE__ */ jsx3(
    "div",
    {
      "data-1c-slot": "",
      style: { display: "contents" },
      suppressHydrationWarning: true,
      dangerouslySetInnerHTML: { __html: markup }
    }
  );
}

// src/use-consent.ts
import { useEffect, useState as useState2 } from "react";
function getLoadedEngine() {
  if (typeof window === "undefined") return void 0;
  const controller = window.__1consent;
  if (!controller || typeof controller !== "object" || !("engine" in controller)) {
    return void 0;
  }
  const engine = controller.engine;
  if (!engine || typeof engine !== "object" || !("getEnforcementConsentState" in engine) || typeof engine.getEnforcementConsentState !== "function") {
    return void 0;
  }
  const read = engine.getEnforcementConsentState;
  return { getEnforcementConsentState: () => read.call(engine) };
}
var liveVersion;
function liveStructuralVersion(config) {
  if (liveVersion?.services !== config.services || liveVersion.categories !== config.categories) {
    liveVersion = {
      services: config.services,
      categories: config.categories,
      version: computeStructuralVersion(config.services, config.categories)
    };
  }
  return liveVersion.version;
}
function stampedStructuralVersion(config, liveEpoch) {
  const api = window.__1CONSENT_REACT_FASTPATH__;
  if (!api?.appId || !api.frameworkId || !api.structuralVersion || api.appId !== config.appId || api.frameworkId !== config.framework.id || api.consentEpoch !== liveEpoch) {
    return void 0;
  }
  return api.structuralVersion;
}
function readMirrorConsent(key) {
  try {
    const fastPathWindow = window;
    const config = fastPathWindow.__1CONSENT_CONFIG__;
    const liveEpoch = config?.consentEpoch ?? 0;
    if (!config || !Number.isSafeInteger(liveEpoch) || liveEpoch < 0 || config.languages.primary.length === 0) {
      return false;
    }
    const cmpLoaded = getLoadedEngine() !== void 0;
    const structuralVersion = cmpLoaded ? liveStructuralVersion(config) : stampedStructuralVersion(config, liveEpoch);
    if (!structuralVersion) return false;
    const root = parseBrowserStore(localStorage.getItem(browserStorageKey(config)));
    const framework = root.apps[config.appId]?.frameworks[config.framework.id];
    if (!framework || framework.type !== config.framework.type || framework.machine !== config.machine || (framework.consentEpoch ?? 0) < liveEpoch || framework.primaryLanguage !== config.languages.primary) {
      return false;
    }
    if (config.framework.type === "tcf") {
      const tcString = framework.consent?.tcString;
      const tcData = fastPathWindow.__1cTcf?.tcData;
      if (typeof tcString !== "string" || tcData?.tcString !== tcString || tcData.eventStatus !== "tcloaded" && tcData.eventStatus !== "useractioncomplete") {
        return false;
      }
    }
    const fastPath = framework.fastPath;
    if (!isFreshBrowserFastPathState(fastPath)) return false;
    if (fastPath.structuralVersion !== structuralVersion) return false;
    if (fastPath.consentEpoch < liveEpoch) return false;
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
  const state = getLoadedEngine()?.getEnforcementConsentState();
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
  const [granted, setGranted] = useState2(false);
  useEffect(() => {
    setGranted(readMirrorConsent(key));
    let disposed = false;
    let attached = null;
    const cancelWait = whenBusAvailable((bus) => {
      if (disposed) return;
      const afterListeners = (read) => () => {
        queueMicrotask(() => {
          if (!disposed) setGranted(read());
        });
      };
      const mirrorHandler = afterListeners(() => readMirrorConsent(key));
      const externalHandler = afterListeners(
        () => readLiveConsent(key) ?? readMirrorConsent(key)
      );
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
  OneConsentProvider2 as OneConsentProvider,
  useConsent
};
